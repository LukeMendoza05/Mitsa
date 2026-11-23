import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

describe("Mitsa Fireworks Inventory Foundation SQL", () => {
  let db: PGlite;
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const factor = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const staffId = "22222222-2222-4222-8222-222222222222";
  const staffSession = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  let businessId: string;
  let shopId: string;

  const claims = (sub: string, sess: string, aal = "aal2") =>
    JSON.stringify({
      sub,
      session_id: sess,
      role: "authenticated",
      aud: "authenticated",
      is_anonymous: false,
      exp: 4102444800,
      aal,
      amr: [
        { method: "password", timestamp: Date.now() / 1000 },
        { method: "totp", timestamp: Date.now() / 1000 },
      ],
    });

  const asOwner = async () => {
    await db.exec("set session authorization authenticator; set role authenticated");
    await db.query("select set_config('request.jwt.claims',$1,false)", [claims(ownerId, session)]);
  };

  const asStaff = async () => {
    await db.exec("set session authorization authenticator; set role authenticated");
    await db.query("select set_config('request.jwt.claims',$1,false)", [claims(staffId, staffSession, "aal1")]);
  };

  const asOperator = async () => {
    await db.exec("reset role; set session authorization postgres");
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role authenticator login noinherit;
      create role authenticated nologin;
      create role anon nologin;
      create role supabase_auth_admin nologin;
      create role service_role nologin;
      grant authenticated to authenticator;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,deleted_at timestamptz,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz,factor_id uuid,aal text);
      create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users,status text,factor_type text);
      alter table auth.sessions enable row level security;
      create function auth.uid() returns uuid language sql as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid(),auth.jwt() to authenticated;
    `);

    await db.exec(`
      create schema extensions;
      create function extensions.dearmor(text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
      create function extensions.pgp_pub_encrypt(text,bytea,text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
      create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'hex')$$;
    `);

    // Run core migrations
    const baseMigrations = [
      "20261012053948_foundation_security_proof.sql",
      "20261012054416_foundation_identity.sql",
      "20261012060403_foundation_membership_lock_policy.sql",
      "20261012060628_foundation_current_session_policy.sql",
      "20261012070606_foundation_verified_actor_adapter.sql",
      "20261013181012_mitsa_workspace_foundation.sql",
      "20261013181135_mitsa_membership_commands.sql",
      "20261013185440_mitsa_account_security_terms.sql",
      "20261013223908_mitsa_registration_boundary.sql",
      "20261014001000_mitsa_reenrollment_session.sql",
      "20261014014343_mitsa_account_workspace_interfaces.sql",
      "20261122180000_mitsa_inventory_foundation.sql",
    ];

    for (const file of baseMigrations) {
      if (file.includes("foundation_verified_actor_adapter")) {
        await db.exec("revoke usage on schema auth from app_authz,app_command");
      }
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      try {
        await db.exec(sql);
      } catch (error) {
        const pg = error as { message: string; position?: number };
        throw new Error(`Failed in migration ${file}: ${pg.message} (pos: ${pg.position})`, { cause: error });
      }
    }

    // Seed test users (before mfa factors)
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@mitsa.invalid',now())", [ownerId]);
    await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')", [session, ownerId, factor]);

    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'staff@mitsa.invalid',now())", [staffId]);
    await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,null,'aal1')", [staffSession, staffId]);

    // Setup MFA binding for owner: prepare permit first, then insert factor, then bind
    await asOwner();
    const permit = (await db.query<{ permit: string }>("select api.mitsa_prepare_enrollment() permit")).rows[0].permit;
    await asOperator();
    await db.query("insert into auth.mfa_factors values($1,$2,'verified','totp')", [factor, ownerId]);
    await asOwner();
    await db.query("select api.mitsa_bind_factor($1,$2)", [factor, permit]);

    // Accept legal terms so owner can create workspaces
    await asOperator();
    const terms = (
      await db.query<{ id: string }>(
        "insert into private.legal_versions(kind,version,content,content_hash,status) values('terms','test-v1','Test Agreement',encode(sha256(convert_to('Test Agreement','UTF8')),'hex'),'test') returning id"
      )
    ).rows[0].id;
    await db.query("update private.release_gates set test_terms_id=$1 where singleton", [terms]);
    await asOwner();
    await db.query("select api.mitsa_accept_terms($1)", [terms]);

    // Create a workspace and shop
    const ws = (
      await db.query<{ mitsa_create_workspace: { id: string; locationId: string } }>(
        "select api.mitsa_create_workspace('Mitsa Bocaue Hub', 'Bocaue Main Stall', 'shop', gen_random_uuid())"
      )
    ).rows[0].mitsa_create_workspace;

    businessId = ws.id;
    shopId = ws.locationId;

    // Assign staff to workspace and shop
    await asOperator();
    await db.query("insert into private.memberships(business_id, user_id, role) values($1, $2, 'staff')", [businessId, staffId]);
    await db.query("insert into private.shop_assignments(business_id, user_id, shop_id) values($1, $2, $3)", [businessId, staffId, shopId]);
  }, 60000);

  afterAll(async () => {
    if (db) await db.close();
  });

  it("creates and lists categories", async () => {
    await asOwner();
    const res = await db.query<{ mitsa_manage_category: { id: string; name: string } }>(
      "select api.mitsa_manage_category($1, 'Sparklers', 'create', null, 1)",
      [businessId]
    );
    expect(res.rows[0].mitsa_manage_category.name).toBe("Sparklers");

    await db.query("select api.mitsa_manage_category($1, 'Fountains', 'create', null, 2)", [businessId]);

    const list = await db.query<{ mitsa_list_categories: Array<{ id: string; name: string }> }>(
      "select api.mitsa_list_categories($1)",
      [businessId]
    );
    expect(list.rows[0].mitsa_list_categories.length).toBe(2);
    expect(list.rows[0].mitsa_list_categories[0].name).toBe("Sparklers");
  });

  it("creates a product with auto-generated FW-00001 code", async () => {
    await asOwner();
    const catRes = await db.query<{ mitsa_list_categories: Array<{ id: string }> }>(
      "select api.mitsa_list_categories($1)",
      [businessId]
    );
    const catId = catRes.rows[0].mitsa_list_categories[0].id;

    const prodRes = await db.query<{ mitsa_create_product: { id: string; displayCode: string; name: string } }>(
      `select api.mitsa_create_product(
        $1, 'Silver Dragon Sparkler 36"', 'box', 250.00, 150.00, $2,
        'SKU-SPK-36', null, 10, false, '1.4G', 'UN0336', '36 inch premium sparklers'
      )`,
      [businessId, catId]
    );

    expect(prodRes.rows[0].mitsa_create_product.displayCode).toBe("FW-00001");
    expect(prodRes.rows[0].mitsa_create_product.name).toBe('Silver Dragon Sparkler 36"');

    // Create second product -> should be FW-00002
    const prod2 = await db.query<{ mitsa_create_product: { displayCode: string } }>(
      `select api.mitsa_create_product(
        $1, 'Golden Fountain 5-inch', 'pc', 180.00, 100.00, $2,
        null, null, 5, false, '1.4G', 'UN0336', null
      )`,
      [businessId, catId]
    );
    expect(prod2.rows[0].mitsa_create_product.displayCode).toBe("FW-00002");
  });

  it("records stock in and increases stock level", async () => {
    await asOwner();
    const prods = await db.query<{ mitsa_list_products: Array<{ id: string; displayCode: string }> }>(
      "select api.mitsa_list_products($1)",
      [businessId]
    );
    const prodId = prods.rows[0].mitsa_list_products[0].id;

    const key = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const items = JSON.stringify([
      {
        productId: prodId,
        quantity: 50,
        unitCost: 150.00,
      },
    ]);

    const res = await db.query<{ mitsa_record_stock_in: { success: boolean; totalQuantity: number } }>(
      "select api.mitsa_record_stock_in($1, $2, $3, 'Supplier Inv #1042', $4)",
      [businessId, shopId, items, key]
    );

    expect(res.rows[0].mitsa_record_stock_in.success).toBe(true);
    expect(res.rows[0].mitsa_record_stock_in.totalQuantity).toBe(50);

    // Verify product stock reflects 50
    const prod = await db.query<{ mitsa_get_product: { totalQuantity: number } }>(
      "select api.mitsa_get_product($1, $2)",
      [businessId, prodId]
    );
    expect(prod.rows[0].mitsa_get_product.totalQuantity).toBe(50);
  });

  it("records a sale as staff at assigned shop and updates daily summary", async () => {
    await asStaff();
    const prods = await db.query<{ mitsa_list_products: Array<{ id: string; displayCode: string }> }>(
      "select api.mitsa_list_products($1, $2)",
      [businessId, shopId]
    );
    const prodId = prods.rows[0].mitsa_list_products[0].id;

    const key = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const saleItems = JSON.stringify([
      {
        productId: prodId,
        quantity: 5,
        unitPrice: 250.00,
      },
    ]);

    const res = await db.query<{ mitsa_record_sale: { total: number; totalQuantity: number; payment: string } }>(
      "select api.mitsa_record_sale($1, $2, $3, 'cash', 'Customer Walk-in', $4)",
      [businessId, shopId, saleItems, key]
    );

    expect(Number(res.rows[0].mitsa_record_sale.total)).toBe(1250.00);
    expect(res.rows[0].mitsa_record_sale.totalQuantity).toBe(5);

    // Remaining stock should be 45 (50 - 5)
    const prod = await db.query<{ mitsa_get_product: { totalQuantity: number } }>(
      "select api.mitsa_get_product($1, $2)",
      [businessId, prodId]
    );
    expect(prod.rows[0].mitsa_get_product.totalQuantity).toBe(45);
  });

  it("rejects sales with insufficient stock", async () => {
    await asStaff();
    const prods = await db.query<{ mitsa_list_products: Array<{ id: string }> }>(
      "select api.mitsa_list_products($1, $2)",
      [businessId, shopId]
    );
    const prodId = prods.rows[0].mitsa_list_products[0].id;

    const key = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const oversizedSale = JSON.stringify([
      {
        productId: prodId,
        quantity: 9999, // more than the 45 remaining
        unitPrice: 250.00,
      },
    ]);

    await expect(
      db.query("select api.mitsa_record_sale($1, $2, $3, 'cash', 'Big Order', $4)", [
        businessId,
        shopId,
        oversizedSale,
        key,
      ])
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("returns dashboard summary with today's sales and metrics", async () => {
    await asOwner();
    const dashboard = await db.query<{
      mitsa_dashboard_summary: {
        todaySales: number;
        todayTransactions: number;
        todayItemsSold: number;
        totalProducts: number;
      };
    }>("select api.mitsa_dashboard_summary($1)", [businessId]);

    const data = dashboard.rows[0].mitsa_dashboard_summary;
    expect(Number(data.todaySales)).toBe(1250.00);
    expect(Number(data.todayTransactions)).toBe(1);
    expect(Number(data.todayItemsSold)).toBe(5);
    expect(Number(data.totalProducts)).toBe(2);
  });

  it("generates BIR inventory report with quantities and costs", async () => {
    await asOwner();
    const report = await db.query<{
      mitsa_inventory_report: Array<{
        displayCode: string;
        productName: string;
        quantityOnHand: number;
        unitCost: number;
        totalCost: number;
      }>;
    }>("select api.mitsa_inventory_report($1)", [businessId]);

    const items = report.rows[0].mitsa_inventory_report;
    expect(items.length).toBe(1); // Only the 1 item that has > 0 stock (45 units)
    expect(items[0].displayCode).toBe("FW-00002");
    expect(Number(items[0].quantityOnHand)).toBe(45);
    expect(Number(items[0].unitCost)).toBe(100.00); // Golden Fountain cost was 100.00
    expect(Number(items[0].totalCost)).toBe(4500.00); // 45 * 100.00
  });

  it("transfers stock between two shops", async () => {
    await asOperator();
    // Create second location as operator
    const shop2Id = (
      await db.query<{ id: string }>(
        "insert into private.shops(business_id, id, name, kind) values($1, gen_random_uuid(), 'Meycauayan Warehouse', 'warehouse') returning id",
        [businessId]
      )
    ).rows[0].id;

    await asOwner();
    const prods = await db.query<{ mitsa_list_products: Array<{ id: string; displayCode: string }> }>(
      "select api.mitsa_list_products($1)",
      [businessId]
    );
    const prodId = prods.rows[0].mitsa_list_products[0].id;

    const key = "11112222-3333-4444-5555-666677778888";
    const transferItems = JSON.stringify([
      {
        productId: prodId,
        quantity: 10,
      },
    ]);

    const res = await db.query<{ mitsa_transfer_stock: { success: boolean; totalQuantity: number } }>(
      "select api.mitsa_transfer_stock($1, $2, $3, $4, 'Restock Meycauayan', $5)",
      [businessId, shopId, shop2Id, transferItems, key]
    );

    expect(res.rows[0].mitsa_transfer_stock.success).toBe(true);
    expect(res.rows[0].mitsa_transfer_stock.totalQuantity).toBe(10);

    // Source shop now has 35 (45 - 10)
    const prodMain = await db.query<{ mitsa_get_product: { locations: Array<{ shopId: string; quantity: number }> } }>(
      "select api.mitsa_get_product($1, $2)",
      [businessId, prodId]
    );
    const locMain = prodMain.rows[0].mitsa_get_product.locations.find((l) => l.shopId === shopId);
    const locDest = prodMain.rows[0].mitsa_get_product.locations.find((l) => l.shopId === shop2Id);
    expect(Number(locMain?.quantity)).toBe(35);
    expect(Number(locDest?.quantity)).toBe(10);
  });

  it("adjusts stock manually with audit and reason", async () => {
    await asOwner();
    const prods = await db.query<{ mitsa_list_products: Array<{ id: string }> }>(
      "select api.mitsa_list_products($1)",
      [businessId]
    );
    const prodId = prods.rows[0].mitsa_list_products[0].id;

    const key = "22223333-4444-5555-6666-777788889999";
    const res = await db.query<{ mitsa_adjust_stock: { success: boolean; delta: number; newQuantity: number } }>(
      "select api.mitsa_adjust_stock($1, $2, $3, null, 30, 'Physical inventory recount loss', $4)",
      [businessId, shopId, prodId, key]
    );

    expect(res.rows[0].mitsa_adjust_stock.success).toBe(true);
    expect(res.rows[0].mitsa_adjust_stock.delta).toBe(-5); // 35 -> 30
    expect(res.rows[0].mitsa_adjust_stock.newQuantity).toBe(30);
  });

  it("queries movement history", async () => {
    await asOwner();
    const history = await db.query<{
      mitsa_movement_history: Array<{
        movementType: string;
        quantity: number;
        productCode: string;
      }>;
    }>("select api.mitsa_movement_history($1)", [businessId]);

    const movements = history.rows[0].mitsa_movement_history;
    expect(movements.length).toBeGreaterThanOrEqual(4); // stock_in, sale, transfer_out, transfer_in, adjustment
    expect(movements.some((m) => m.movementType === "stock_in")).toBe(true);
    expect(movements.some((m) => m.movementType === "sale")).toBe(true);
    expect(movements.some((m) => m.movementType === "adjustment")).toBe(true);
  });
});
