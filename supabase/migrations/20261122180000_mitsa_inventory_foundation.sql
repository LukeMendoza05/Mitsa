-- Mitsa Fireworks Inventory Management System - Foundation Migration
-- Phase 1: Retailer MVP (Products, Batches, Stock Movements, Levels, Summaries, Alerts)

do $$ begin
  if exists (select 1 from pg_tables where schemaname='foundation_probe' and tablename='environment_identity') then
    assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment';
  end if;
end $$;

grant usage, create on schema private to app_workspace;
grant usage on schema api to app_workspace;

-- ============================================================================
-- 1. EXTEND MITSA_REQUIRE FOR INVENTORY ACTIONS
-- ============================================================================
create or replace function private.mitsa_require(p_business uuid, p_action text, p_shop uuid default null) returns text
language plpgsql security invoker set search_path='' as $$
declare
  r text := private.mitsa_role(p_business);
begin
  if r is null or (r in ('owner','admin') and not private.mitsa_mfa_ready()) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_shop is not null and not exists(
    select 1 from private.shops s
    where s.business_id=p_business and s.id=p_shop and s.active
      and (r in ('owner','admin') or exists(
        select 1 from private.shop_assignments a
        where a.business_id=p_business and a.shop_id=p_shop and a.user_id=private.current_actor()
      ))
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  if not (
    case p_action
      when 'view' then true
      when 'manage-staff' then r in ('owner','admin')
      when 'audit' then r in ('owner','admin')
      when 'manage-locations' then r in ('owner','admin')
      when 'owner' then r='owner'
      when 'financial' then r='owner' or (r='admin' and (select admin_financial_access from private.businesses where id=p_business))
      -- Inventory actions:
      when 'inventory-view' then true
      when 'inventory-operate' then true  -- staff can perform sales and stock-in at their assigned location
      when 'inventory-manage' then r in ('owner','admin')  -- manage catalog, categories, adjustments
      else false
    end
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  return r;
end $$;
revoke all on function private.mitsa_require(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.mitsa_require(uuid,text,uuid) to app_workspace;

-- ============================================================================
-- 2. PRODUCT CATEGORIES
-- ============================================================================
create table if not exists private.product_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id),
  name        text not null check(length(btrim(name)) between 1 and 100),
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique(business_id, name)
);
create index if not exists product_categories_biz_idx on private.product_categories(business_id, sort_order);

-- ============================================================================
-- 3. PRODUCTS (Auto-ID, optional SKU, optional Barcode)
-- ============================================================================
create table if not exists private.products (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references private.businesses(id),
  category_id   uuid references private.product_categories(id) on delete set null,
  display_code  text not null,
  sku           text,
  barcode       text,
  name          text not null check(length(btrim(name)) between 1 and 200),
  description   text,
  unit          text not null default 'pc'
                  check(unit in ('pc','box','pack','case','kg','g','roll','set','bundle','tube','shot')),
  selling_price numeric(12,2) not null default 0 check(selling_price >= 0),
  cost_price    numeric(12,2) not null default 0 check(cost_price >= 0),
  track_batches boolean not null default false,
  min_stock     integer not null default 0 check(min_stock >= 0),
  hazard_class  text check(hazard_class in ('1.1G','1.2G','1.3G','1.4G','1.4S', null)),
  un_number     text,
  is_prohibited boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(business_id, display_code)
);
create index if not exists products_biz_cat_idx on private.products(business_id, category_id);
create index if not exists products_biz_active_idx on private.products(business_id, active);
create unique index if not exists products_biz_sku_idx on private.products(business_id, sku) where sku is not null and btrim(sku) <> '';

-- Auto-generated FW-XXXXX code per business
create or replace function private.mitsa_next_product_code(p_business uuid)
returns text language sql stable security definer set search_path='' as $$
  select 'FW-' || lpad(
    (coalesce(
      (select max(substring(display_code from 'FW-(\d+)')::integer)
       from private.products where business_id = p_business and display_code ~ '^FW-\d+$'), 0
    ) + 1)::text, 5, '0')
$$;
revoke all on function private.mitsa_next_product_code(uuid) from public,anon,authenticated;
grant execute on function private.mitsa_next_product_code(uuid) to app_workspace;

-- ============================================================================
-- 4. BATCHES (Optional Lot Tracking)
-- ============================================================================
create table if not exists private.batches (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references private.businesses(id),
  product_id      uuid not null references private.products(id) on delete cascade,
  batch_number    text not null check(length(btrim(batch_number)) between 1 and 100),
  manufacture_date date,
  expiry_date     date,
  supplier_info   text,
  notes           text,
  status          text not null default 'active'
                    check(status in ('active','expired','recalled','disposed')),
  created_at      timestamptz not null default now(),
  unique(business_id, product_id, batch_number)
);
create index if not exists batches_product_idx on private.batches(product_id, status);

-- ============================================================================
-- 5. STOCK LEVELS (Inventory on Hand per Product × Location × Batch)
-- ============================================================================
create table if not exists private.stock_levels (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id),
  product_id  uuid not null references private.products(id) on delete cascade,
  shop_id     uuid not null,
  batch_id    uuid references private.batches(id) on delete cascade,
  quantity    integer not null default 0,
  updated_at  timestamptz not null default now(),
  foreign key(business_id, shop_id) references private.shops(business_id, id)
);
create index if not exists stock_levels_lookup_idx on private.stock_levels(business_id, shop_id, product_id);
create unique index if not exists stock_levels_unbatched_idx
  on private.stock_levels(business_id, product_id, shop_id) where batch_id is null;
create unique index if not exists stock_levels_batched_idx
  on private.stock_levels(business_id, product_id, shop_id, batch_id) where batch_id is not null;

-- ============================================================================
-- 6. STOCK MOVEMENTS (Immutable Ledger)
-- ============================================================================
create table if not exists private.stock_movements (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references private.businesses(id),
  product_id          uuid not null references private.products(id),
  batch_id            uuid references private.batches(id),
  movement_type       text not null check(movement_type in (
    'stock_in', 'sale', 'transfer_out', 'transfer_in', 'adjustment', 'return', 'disposal'
  )),
  quantity            integer not null,
  shop_id             uuid not null,
  counterpart_shop_id uuid,
  transfer_pair_id    uuid references private.stock_movements(id),
  unit_price          numeric(12,2),
  total_amount        numeric(14,2),
  payment_method      text check(payment_method in ('cash','gcash','maya','bank','credit', null)),
  reference           text,
  notes               text,
  actor_id            uuid not null,
  created_at          timestamptz not null default now(),
  foreign key(business_id, shop_id) references private.shops(business_id, id),
  check(
    (movement_type in ('stock_in','transfer_in','return') and quantity > 0) or
    (movement_type in ('sale','transfer_out','disposal') and quantity < 0) or
    (movement_type = 'adjustment')
  )
);
create index if not exists stock_movements_biz_time_idx on private.stock_movements(business_id, created_at desc);
create index if not exists stock_movements_shop_idx on private.stock_movements(shop_id, created_at desc);
create index if not exists stock_movements_product_idx on private.stock_movements(product_id, created_at desc);

-- ============================================================================
-- 7. DAILY SUMMARIES (Pre-aggregated Per Location)
-- ============================================================================
create table if not exists private.daily_summaries (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references private.businesses(id),
  shop_id           uuid not null,
  summary_date      date not null,
  total_sales       numeric(14,2) not null default 0,
  total_items_sold  integer not null default 0,
  transaction_count integer not null default 0,
  cash_total        numeric(14,2) not null default 0,
  gcash_total       numeric(14,2) not null default 0,
  maya_total        numeric(14,2) not null default 0,
  bank_total        numeric(14,2) not null default 0,
  credit_total      numeric(14,2) not null default 0,
  stock_value       numeric(16,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key(business_id, shop_id) references private.shops(business_id, id),
  unique(business_id, shop_id, summary_date)
);
create index if not exists daily_summaries_lookup_idx on private.daily_summaries(business_id, shop_id, summary_date desc);

-- ============================================================================
-- 8. STOCK ALERTS
-- ============================================================================
create table if not exists private.stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id),
  product_id  uuid not null references private.products(id) on delete cascade,
  shop_id     uuid not null,
  alert_type  text not null check(alert_type in ('low_stock','out_of_stock','expiring_soon','expired')),
  threshold   integer not null default 0,
  current_qty integer not null default 0,
  status      text not null default 'active' check(status in ('active','acknowledged','resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key(business_id, shop_id) references private.shops(business_id, id)
);
create index if not exists stock_alerts_active_idx on private.stock_alerts(business_id, status, created_at desc);

-- ============================================================================
-- 9. RLS POLICIES & IMMUTABILITY
-- ============================================================================
do $$ declare t record; begin
  for t in select unnest(array[
    'product_categories','products','batches',
    'stock_levels','stock_movements','daily_summaries','stock_alerts'
  ]) as name loop
    execute format('alter table private.%I enable row level security', t.name);
    execute format('alter table private.%I force row level security', t.name);
    execute format('grant select, insert, update, delete on private.%I to app_workspace', t.name);
    execute format('drop policy if exists workspace_command on private.%I', t.name);
    execute format('create policy workspace_command on private.%I to app_workspace using(true) with check(true)', t.name);
  end loop;
end $$;

-- Movements are strictly append-only
revoke update, delete on private.stock_movements from app_workspace;
drop trigger if exists immutable_stock_movements on private.stock_movements;
create trigger immutable_stock_movements
  before update or delete on private.stock_movements
  for each row execute function private.reject_history_mutation();

-- ============================================================================
-- 10. RPC FUNCTIONS (Business Logic in private.*, wrappers in api.*)
-- ============================================================================

-- A. CATEGORIES: LIST
create or replace function private.mitsa_list_categories(p_business uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
begin
  perform private.mitsa_require(p_business, 'inventory-view');
  return coalesce(
    (select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'sortOrder', sort_order, 'active', active
    ) order by sort_order, name)
    from private.product_categories where business_id = p_business),
    '[]'::jsonb
  );
end $$;

-- B. CATEGORIES: MANAGE
create or replace function private.mitsa_manage_category(
  p_business uuid, p_name text, p_action text, p_category_id uuid default null, p_sort_order integer default 0
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  cid uuid;
begin
  perform private.mitsa_require(p_business, 'inventory-manage');
  if p_action = 'create' then
    if p_name is null or length(btrim(p_name)) not between 1 and 100 then
      raise exception 'invalid category name' using errcode='22023';
    end if;
    insert into private.product_categories(business_id, name, sort_order)
      values (p_business, btrim(p_name), coalesce(p_sort_order, 0))
      returning id into cid;
    perform private.mitsa_audit(p_business, 'category.created', cid, jsonb_build_object('name', btrim(p_name)));
    return jsonb_build_object('id', cid, 'name', btrim(p_name));
  elsif p_action = 'update' then
    if p_category_id is null or p_name is null or length(btrim(p_name)) not between 1 and 100 then
      raise exception 'invalid category data' using errcode='22023';
    end if;
    update private.product_categories set name = btrim(p_name), sort_order = coalesce(p_sort_order, sort_order)
      where id = p_category_id and business_id = p_business;
    if not found then raise exception 'category not found' using errcode='42501'; end if;
    perform private.mitsa_audit(p_business, 'category.updated', p_category_id);
    return jsonb_build_object('id', p_category_id, 'name', btrim(p_name));
  elsif p_action = 'toggle-active' then
    update private.product_categories set active = not active
      where id = p_category_id and business_id = p_business returning active into cid;
    if not found then raise exception 'category not found' using errcode='42501'; end if;
    return jsonb_build_object('id', p_category_id);
  else
    raise exception 'invalid action' using errcode='22023';
  end if;
end $$;

-- C. PRODUCTS: LIST
create or replace function private.mitsa_list_products(
  p_business uuid,
  p_shop uuid default null,
  p_category_id uuid default null,
  p_search text default null,
  p_active_only boolean default true
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
begin
  perform private.mitsa_require(p_business, 'inventory-view', p_shop);
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'displayCode', p.display_code,
          'name', p.name,
          'description', p.description,
          'sku', p.sku,
          'barcode', p.barcode,
          'unit', p.unit,
          'sellingPrice', p.selling_price,
          'costPrice', p.cost_price,
          'minStock', p.min_stock,
          'trackBatches', p.track_batches,
          'hazardClass', p.hazard_class,
          'unNumber', p.un_number,
          'isProhibited', p.is_prohibited,
          'active', p.active,
          'categoryId', p.category_id,
          'categoryName', c.name,
          'stockQuantity', coalesce((
            select sum(sl.quantity)
            from private.stock_levels sl
            where sl.product_id = p.id
              and (p_shop is null or sl.shop_id = p_shop)
          ), 0)
        )
        order by p.name, p.display_code
      )
      from private.products p
      left join private.product_categories c on c.id = p.category_id
      where p.business_id = p_business
        and (not p_active_only or p.active)
        and (p_category_id is null or p.category_id = p_category_id)
        and (
          p_search is null or btrim(p_search) = '' or
          p.name ilike '%' || btrim(p_search) || '%' or
          p.display_code ilike '%' || btrim(p_search) || '%' or
          coalesce(p.sku, '') ilike '%' || btrim(p_search) || '%' or
          coalesce(p.barcode, '') ilike '%' || btrim(p_search) || '%'
        )
    ),
    '[]'::jsonb
  );
end $$;

-- D. PRODUCTS: GET SINGLE WITH STOCK BREAKDOWN
create or replace function private.mitsa_get_product(
  p_business uuid, p_product_id uuid
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  v_prod record;
  loc_stock jsonb;
  batches jsonb;
begin
  perform private.mitsa_require(p_business, 'inventory-view');
  select p.id, p.display_code, p.name, p.description, p.sku, p.barcode,
         p.unit, p.selling_price, p.cost_price, p.min_stock, p.track_batches,
         p.hazard_class, p.un_number, p.is_prohibited, p.active,
         p.category_id, c.name as category_name
  into v_prod
  from private.products p
  left join private.product_categories c on c.id = p.category_id
  where p.id = p_product_id and p.business_id = p_business;

  if not found then raise exception 'product not found' using errcode='42501'; end if;

  -- Stock per location using subquery to avoid nested aggregates
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'shopId', sub.id,
          'shopName', sub.name,
          'shopKind', sub.kind,
          'quantity', sub.qty
        )
      )
      from (
        select s.id, s.name, s.kind, coalesce(sum(sl.quantity), 0) as qty
        from private.shops s
        left join private.stock_levels sl on sl.shop_id = s.id and sl.product_id = p_product_id
        where s.business_id = p_business and s.active
        group by s.id, s.name, s.kind
      ) sub
    ),
    '[]'::jsonb
  ) into loc_stock;

  -- Active batches
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'batchNumber', b.batch_number,
          'manufactureDate', b.manufacture_date,
          'expiryDate', b.expiry_date,
          'status', b.status,
          'quantity', coalesce((select sum(quantity) from private.stock_levels where batch_id = b.id), 0)
        ) order by b.expiry_date nulls last, b.created_at desc
      )
      from private.batches b
      where b.product_id = p_product_id and b.business_id = p_business and b.status = 'active'
    ),
    '[]'::jsonb
  ) into batches;

  return jsonb_build_object(
    'id', v_prod.id,
    'displayCode', v_prod.display_code,
    'name', v_prod.name,
    'description', v_prod.description,
    'sku', v_prod.sku,
    'barcode', v_prod.barcode,
    'unit', v_prod.unit,
    'sellingPrice', v_prod.selling_price,
    'costPrice', v_prod.cost_price,
    'minStock', v_prod.min_stock,
    'trackBatches', v_prod.track_batches,
    'hazardClass', v_prod.hazard_class,
    'unNumber', v_prod.un_number,
    'isProhibited', v_prod.is_prohibited,
    'active', v_prod.active,
    'categoryId', v_prod.category_id,
    'categoryName', v_prod.category_name,
    'totalQuantity', coalesce((select sum(quantity) from private.stock_levels where product_id = p_product_id), 0),
    'locations', loc_stock,
    'batches', batches
  );
end $$;

-- E. PRODUCTS: CREATE
create or replace function private.mitsa_create_product(
  p_business uuid,
  p_name text,
  p_unit text,
  p_selling_price numeric,
  p_cost_price numeric default 0,
  p_category_id uuid default null,
  p_sku text default null,
  p_barcode text default null,
  p_min_stock integer default 0,
  p_track_batches boolean default false,
  p_hazard_class text default null,
  p_un_number text default null,
  p_description text default null
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  pid uuid := gen_random_uuid();
  code text;
  clean_sku text := nullif(btrim(coalesce(p_sku, '')), '');
  clean_barcode text := nullif(btrim(coalesce(p_barcode, '')), '');
begin
  perform private.mitsa_require(p_business, 'inventory-manage');
  if p_name is null or length(btrim(p_name)) not between 1 and 200 then
    raise exception 'invalid product name' using errcode='22023';
  end if;
  if p_unit not in ('pc','box','pack','case','kg','g','roll','set','bundle','tube','shot') then
    raise exception 'invalid unit' using errcode='22023';
  end if;
  if p_selling_price is null or p_selling_price < 0 or p_cost_price is null or p_cost_price < 0 then
    raise exception 'invalid price' using errcode='22023';
  end if;

  code := private.mitsa_next_product_code(p_business);

  insert into private.products(
    id, business_id, category_id, display_code, sku, barcode,
    name, description, unit, selling_price, cost_price,
    track_batches, min_stock, hazard_class, un_number
  ) values (
    pid, p_business, p_category_id, code, clean_sku, clean_barcode,
    btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    p_unit, p_selling_price, coalesce(p_cost_price, 0),
    coalesce(p_track_batches, false), coalesce(p_min_stock, 0),
    p_hazard_class, nullif(btrim(coalesce(p_un_number, '')), '')
  );

  perform private.mitsa_audit(p_business, 'product.created', pid, jsonb_build_object('code', code, 'name', btrim(p_name)));
  return jsonb_build_object('id', pid, 'displayCode', code, 'name', btrim(p_name));
end $$;

-- F. PRODUCTS: UPDATE
create or replace function private.mitsa_update_product(
  p_business uuid,
  p_product_id uuid,
  p_name text,
  p_unit text,
  p_selling_price numeric,
  p_cost_price numeric default 0,
  p_category_id uuid default null,
  p_sku text default null,
  p_barcode text default null,
  p_min_stock integer default 0,
  p_active boolean default true,
  p_hazard_class text default null,
  p_un_number text default null,
  p_description text default null
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  clean_sku text := nullif(btrim(coalesce(p_sku, '')), '');
  clean_barcode text := nullif(btrim(coalesce(p_barcode, '')), '');
begin
  perform private.mitsa_require(p_business, 'inventory-manage');
  if p_name is null or length(btrim(p_name)) not between 1 and 200 then
    raise exception 'invalid product name' using errcode='22023';
  end if;
  if p_unit not in ('pc','box','pack','case','kg','g','roll','set','bundle','tube','shot') then
    raise exception 'invalid unit' using errcode='22023';
  end if;
  if p_selling_price is null or p_selling_price < 0 or p_cost_price is null or p_cost_price < 0 then
    raise exception 'invalid price' using errcode='22023';
  end if;

  update private.products set
    name = btrim(p_name),
    unit = p_unit,
    selling_price = p_selling_price,
    cost_price = coalesce(p_cost_price, 0),
    category_id = p_category_id,
    sku = clean_sku,
    barcode = clean_barcode,
    min_stock = coalesce(p_min_stock, 0),
    active = coalesce(p_active, true),
    hazard_class = p_hazard_class,
    un_number = nullif(btrim(coalesce(p_un_number, '')), ''),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    updated_at = now()
  where id = p_product_id and business_id = p_business;

  if not found then raise exception 'product not found' using errcode='42501'; end if;
  perform private.mitsa_audit(p_business, 'product.updated', p_product_id);
  return jsonb_build_object('id', p_product_id, 'name', btrim(p_name));
end $$;

-- G. STOCK IN (Receive Inventory)
create or replace function private.mitsa_record_stock_in(
  p_business uuid,
  p_shop uuid,
  p_items jsonb,
  p_reference text,
  p_key uuid
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  actor uuid := private.current_actor();
  fingerprint text;
  previous private.access_commands;
  item record;
  batch_uuid uuid;
  total_qty integer := 0;
begin
  perform private.mitsa_require(p_business, 'inventory-operate', p_shop);
  if p_key is null then raise exception 'command key required' using errcode='22023'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'no items provided' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_key::text, 9101));
  fingerprint := encode(sha256(convert_to(
    jsonb_build_array('stock_in', p_shop, p_items, p_reference)::text, 'UTF8'
  )), 'hex');
  select * into previous from private.access_commands where actor_id = actor and command_key = p_key;
  if found then
    if previous.request_hash <> fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if;
    return previous.outcome;
  end if;

  for item in select * from jsonb_to_recordset(p_items) as x(
    "productId" uuid,
    "batchNumber" text,
    "expiryDate" date,
    "quantity" integer,
    "unitCost" numeric
  ) loop
    if item."quantity" is null or item."quantity" <= 0 then
      raise exception 'quantity must be positive' using errcode='22023';
    end if;
    if not exists(select 1 from private.products where id = item."productId" and business_id = p_business and active) then
      raise exception 'product not found or inactive' using errcode='22023';
    end if;

    -- Handle optional batch creation
    batch_uuid := null;
    if item."batchNumber" is not null and btrim(item."batchNumber") <> '' then
      insert into private.batches(business_id, product_id, batch_number, expiry_date)
        values (p_business, item."productId", btrim(item."batchNumber"), item."expiryDate")
        on conflict (business_id, product_id, batch_number) do update set
          expiry_date = coalesce(excluded.expiry_date, private.batches.expiry_date)
        returning id into batch_uuid;
    end if;

    -- Record movement
    insert into private.stock_movements(
      business_id, product_id, batch_id, movement_type,
      quantity, shop_id, unit_price, total_amount,
      reference, actor_id
    ) values (
      p_business, item."productId", batch_uuid, 'stock_in',
      item."quantity", p_shop, item."unitCost",
      item."quantity" * coalesce(item."unitCost", 0),
      nullif(btrim(coalesce(p_reference, '')), ''), actor
    );

    -- Upsert stock level
    if batch_uuid is null then
      insert into private.stock_levels(business_id, product_id, shop_id, batch_id, quantity, updated_at)
        values (p_business, item."productId", p_shop, null, item."quantity", now())
        on conflict (business_id, product_id, shop_id) where batch_id is null
        do update set quantity = private.stock_levels.quantity + excluded.quantity, updated_at = now();
    else
      insert into private.stock_levels(business_id, product_id, shop_id, batch_id, quantity, updated_at)
        values (p_business, item."productId", p_shop, batch_uuid, item."quantity", now())
        on conflict (business_id, product_id, shop_id, batch_id) where batch_id is not null
        do update set quantity = private.stock_levels.quantity + excluded.quantity, updated_at = now();
    end if;

    total_qty := total_qty + item."quantity";
  end loop;

  -- Resolve any low stock alerts if stock is now above min_stock
  update private.stock_alerts sa
  set status = 'resolved', resolved_at = now()
  where sa.business_id = p_business and sa.shop_id = p_shop and sa.status = 'active'
    and (select coalesce(sum(quantity), 0) from private.stock_levels sl where sl.product_id = sa.product_id and sl.shop_id = p_shop) > sa.threshold;

  perform private.mitsa_audit(p_business, 'inventory.stock_in', p_shop, jsonb_build_object('totalItems', total_qty));

  insert into private.access_commands values(
    actor, p_key, fingerprint,
    jsonb_build_object('success', true, 'totalQuantity', total_qty, 'itemCount', jsonb_array_length(p_items)),
    now()
  );
  return jsonb_build_object('success', true, 'totalQuantity', total_qty, 'itemCount', jsonb_array_length(p_items));
end $$;

-- H. RECORD SALE (POS-Lite Checkout)
create or replace function private.mitsa_record_sale(
  p_business uuid,
  p_shop uuid,
  p_items jsonb,
  p_payment text,
  p_reference text,
  p_key uuid
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  actor uuid := private.current_actor();
  fingerprint text;
  previous private.access_commands;
  item record;
  current_stock integer;
  total numeric := 0;
  total_qty integer := 0;
  prod_min integer;
  now_stock integer;
begin
  perform private.mitsa_require(p_business, 'inventory-operate', p_shop);
  if p_key is null then raise exception 'command key required' using errcode='22023'; end if;
  if p_payment not in ('cash','gcash','maya','bank','credit') then
    raise exception 'invalid payment method' using errcode='22023';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_key::text, 9001));
  fingerprint := encode(sha256(convert_to(
    jsonb_build_array('sale', p_shop, p_items, p_payment, p_reference)::text, 'UTF8'
  )), 'hex');
  select * into previous from private.access_commands where actor_id = actor and command_key = p_key;
  if found then
    if previous.request_hash <> fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if;
    return previous.outcome;
  end if;

  for item in select * from jsonb_to_recordset(p_items) as x(
    "productId" uuid,
    "batchId" uuid,
    "quantity" integer,
    "unitPrice" numeric
  ) loop
    if item."quantity" is null or item."quantity" <= 0 then
      raise exception 'invalid item quantity' using errcode='22023';
    end if;
    if item."unitPrice" is null or item."unitPrice" < 0 then
      raise exception 'invalid item price' using errcode='22023';
    end if;

    -- Check available stock
    select coalesce(sum(quantity), 0) into current_stock
    from private.stock_levels
    where product_id = item."productId" and shop_id = p_shop and business_id = p_business
      and (item."batchId" is null or batch_id = item."batchId");

    if current_stock < item."quantity" then
      raise exception 'insufficient stock for product' using errcode='22023';
    end if;

    -- Deduct stock
    if item."batchId" is not null then
      update private.stock_levels
        set quantity = quantity - item."quantity", updated_at = now()
        where product_id = item."productId" and shop_id = p_shop and batch_id = item."batchId";
    else
      -- Unbatched deduction: deduct from unbatched row first, then any row
      update private.stock_levels
        set quantity = quantity - item."quantity", updated_at = now()
        where product_id = item."productId" and shop_id = p_shop and batch_id is null;
      if not found then
        -- If no null-batch row, deduct from whichever batch has stock (FEFO/any)
        update private.stock_levels
          set quantity = quantity - item."quantity", updated_at = now()
          where id = (
            select id from private.stock_levels
            where product_id = item."productId" and shop_id = p_shop and quantity >= item."quantity"
            order by updated_at asc limit 1
          );
      end if;
    end if;

    -- Record movement (negative quantity)
    insert into private.stock_movements(
      business_id, product_id, batch_id, movement_type,
      quantity, shop_id, unit_price, total_amount,
      payment_method, reference, actor_id
    ) values (
      p_business, item."productId", item."batchId", 'sale',
      -item."quantity", p_shop, item."unitPrice",
      item."quantity" * item."unitPrice",
      p_payment, nullif(btrim(coalesce(p_reference, '')), ''), actor
    );

    total := total + (item."quantity" * item."unitPrice");
    total_qty := total_qty + item."quantity";

    -- Check if remaining stock triggers low stock alert
    select min_stock into prod_min from private.products where id = item."productId";
    select coalesce(sum(quantity), 0) into now_stock
    from private.stock_levels where product_id = item."productId" and shop_id = p_shop;

    if prod_min > 0 and now_stock <= prod_min then
      insert into private.stock_alerts(
        business_id, product_id, shop_id, alert_type, threshold, current_qty
      ) values (
        p_business, item."productId", p_shop,
        case when now_stock = 0 then 'out_of_stock' else 'low_stock' end,
        prod_min, now_stock
      );
    end if;
  end loop;

  -- Update or insert daily_summaries
  insert into private.daily_summaries(
    business_id, shop_id, summary_date, total_sales, total_items_sold, transaction_count,
    cash_total, gcash_total, maya_total, bank_total, credit_total
  ) values (
    p_business, p_shop, current_date, total, total_qty, 1,
    case when p_payment = 'cash' then total else 0 end,
    case when p_payment = 'gcash' then total else 0 end,
    case when p_payment = 'maya' then total else 0 end,
    case when p_payment = 'bank' then total else 0 end,
    case when p_payment = 'credit' then total else 0 end
  )
  on conflict (business_id, shop_id, summary_date) do update set
    total_sales = private.daily_summaries.total_sales + excluded.total_sales,
    total_items_sold = private.daily_summaries.total_items_sold + excluded.total_items_sold,
    transaction_count = private.daily_summaries.transaction_count + 1,
    cash_total = private.daily_summaries.cash_total + excluded.cash_total,
    gcash_total = private.daily_summaries.gcash_total + excluded.gcash_total,
    maya_total = private.daily_summaries.maya_total + excluded.maya_total,
    bank_total = private.daily_summaries.bank_total + excluded.bank_total,
    credit_total = private.daily_summaries.credit_total + excluded.credit_total,
    updated_at = now();

  perform private.mitsa_audit(p_business, 'inventory.sale', p_shop,
    jsonb_build_object('total', total, 'itemCount', total_qty, 'payment', p_payment));

  insert into private.access_commands values(
    actor, p_key, fingerprint,
    jsonb_build_object('total', total, 'totalQuantity', total_qty, 'payment', p_payment),
    now()
  );

  return jsonb_build_object('total', total, 'totalQuantity', total_qty, 'payment', p_payment);
end $$;

-- I. STOCK TRANSFER BETWEEN LOCATIONS
create or replace function private.mitsa_transfer_stock(
  p_business uuid,
  p_from_shop uuid,
  p_to_shop uuid,
  p_items jsonb,
  p_reference text,
  p_key uuid
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  actor uuid := private.current_actor();
  fingerprint text;
  previous private.access_commands;
  item record;
  current_stock integer;
  out_id uuid;
  in_id uuid;
  total_qty integer := 0;
begin
  perform private.mitsa_require(p_business, 'inventory-manage');
  if p_from_shop = p_to_shop then raise exception 'source and destination must differ' using errcode='22023'; end if;
  if p_key is null then raise exception 'command key required' using errcode='22023'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'no items provided' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_key::text, 9201));
  fingerprint := encode(sha256(convert_to(
    jsonb_build_array('transfer', p_from_shop, p_to_shop, p_items, p_reference)::text, 'UTF8'
  )), 'hex');
  select * into previous from private.access_commands where actor_id = actor and command_key = p_key;
  if found then
    if previous.request_hash <> fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if;
    return previous.outcome;
  end if;

  for item in select * from jsonb_to_recordset(p_items) as x(
    "productId" uuid, "batchId" uuid, "quantity" integer
  ) loop
    if item."quantity" is null or item."quantity" <= 0 then raise exception 'quantity must be positive' using errcode='22023'; end if;

    select coalesce(sum(quantity), 0) into current_stock
    from private.stock_levels
    where product_id = item."productId" and shop_id = p_from_shop and business_id = p_business
      and (item."batchId" is null or batch_id = item."batchId");

    if current_stock < item."quantity" then raise exception 'insufficient stock for transfer' using errcode='22023'; end if;

    -- Deduct from source
    if item."batchId" is not null then
      update private.stock_levels set quantity = quantity - item."quantity", updated_at = now()
        where product_id = item."productId" and shop_id = p_from_shop and batch_id = item."batchId";
    else
      update private.stock_levels set quantity = quantity - item."quantity", updated_at = now()
        where product_id = item."productId" and shop_id = p_from_shop and batch_id is null;
    end if;

    -- Add to destination
    if item."batchId" is null then
      insert into private.stock_levels(business_id, product_id, shop_id, batch_id, quantity, updated_at)
        values (p_business, item."productId", p_to_shop, null, item."quantity", now())
        on conflict (business_id, product_id, shop_id) where batch_id is null
        do update set quantity = private.stock_levels.quantity + excluded.quantity, updated_at = now();
    else
      insert into private.stock_levels(business_id, product_id, shop_id, batch_id, quantity, updated_at)
        values (p_business, item."productId", p_to_shop, item."batchId", item."quantity", now())
        on conflict (business_id, product_id, shop_id, batch_id) where batch_id is not null
        do update set quantity = private.stock_levels.quantity + excluded.quantity, updated_at = now();
    end if;

    -- Record paired movements
    insert into private.stock_movements(
      business_id, product_id, batch_id, movement_type,
      quantity, shop_id, counterpart_shop_id, reference, actor_id
    ) values (
      p_business, item."productId", item."batchId", 'transfer_out',
      -item."quantity", p_from_shop, p_to_shop, p_reference, actor
    ) returning id into out_id;

    insert into private.stock_movements(
      business_id, product_id, batch_id, movement_type,
      quantity, shop_id, counterpart_shop_id, transfer_pair_id, reference, actor_id
    ) values (
      p_business, item."productId", item."batchId", 'transfer_in',
      item."quantity", p_to_shop, p_from_shop, out_id, p_reference, actor
    ) returning id into in_id;

    total_qty := total_qty + item."quantity";
  end loop;

  perform private.mitsa_audit(p_business, 'inventory.transfer', p_from_shop,
    jsonb_build_object('toShop', p_to_shop, 'totalQuantity', total_qty));

  insert into private.access_commands values(
    actor, p_key, fingerprint,
    jsonb_build_object('success', true, 'totalQuantity', total_qty),
    now()
  );
  return jsonb_build_object('success', true, 'totalQuantity', total_qty);
end $$;

-- J. STOCK ADJUSTMENT (Manual Count Correction / Damage / Scrap)
create or replace function private.mitsa_adjust_stock(
  p_business uuid,
  p_shop uuid,
  p_product_id uuid,
  p_batch_id uuid,
  p_new_quantity integer,
  p_reason text,
  p_key uuid
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  actor uuid := private.current_actor();
  fingerprint text;
  previous private.access_commands;
  current_qty integer := 0;
  delta integer;
begin
  perform private.mitsa_require(p_business, 'inventory-manage');
  if p_new_quantity is null or p_new_quantity < 0 then raise exception 'invalid quantity' using errcode='22023'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'adjustment reason required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_key::text, 9301));
  fingerprint := encode(sha256(convert_to(
    jsonb_build_array('adjust', p_shop, p_product_id, p_batch_id, p_new_quantity, p_reason)::text, 'UTF8'
  )), 'hex');
  select * into previous from private.access_commands where actor_id = actor and command_key = p_key;
  if found then
    if previous.request_hash <> fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if;
    return previous.outcome;
  end if;

  select coalesce(quantity, 0) into current_qty
  from private.stock_levels
  where product_id = p_product_id and shop_id = p_shop and business_id = p_business
    and batch_id is not distinct from p_batch_id;

  delta := p_new_quantity - current_qty;
  if delta = 0 then
    return jsonb_build_object('success', true, 'delta', 0, 'newQuantity', p_new_quantity);
  end if;

  -- Upsert stock level
  if p_batch_id is null then
    insert into private.stock_levels(business_id, product_id, shop_id, batch_id, quantity, updated_at)
      values (p_business, p_product_id, p_shop, null, p_new_quantity, now())
      on conflict (business_id, product_id, shop_id) where batch_id is null
      do update set quantity = excluded.quantity, updated_at = now();
  else
    insert into private.stock_levels(business_id, product_id, shop_id, batch_id, quantity, updated_at)
      values (p_business, p_product_id, p_shop, p_batch_id, p_new_quantity, now())
      on conflict (business_id, product_id, shop_id, batch_id) where batch_id is not null
      do update set quantity = excluded.quantity, updated_at = now();
  end if;

  -- Record movement
  insert into private.stock_movements(
    business_id, product_id, batch_id, movement_type,
    quantity, shop_id, reference, notes, actor_id
  ) values (
    p_business, p_product_id, p_batch_id, 'adjustment',
    delta, p_shop, btrim(p_reason), 'Manual count adjustment', actor
  );

  perform private.mitsa_audit(p_business, 'inventory.adjusted', p_product_id,
    jsonb_build_object('shop', p_shop, 'from', current_qty, 'to', p_new_quantity, 'reason', btrim(p_reason)));

  insert into private.access_commands values(
    actor, p_key, fingerprint,
    jsonb_build_object('success', true, 'delta', delta, 'newQuantity', p_new_quantity),
    now()
  );
  return jsonb_build_object('success', true, 'delta', delta, 'newQuantity', p_new_quantity);
end $$;

-- K. DASHBOARD SUMMARY
create or replace function private.mitsa_dashboard_summary(
  p_business uuid, p_shop uuid default null
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare
  today_sales numeric := 0;
  today_txns integer := 0;
  today_items integer := 0;
  active_alerts integer := 0;
  total_prods integer := 0;
  total_val numeric := 0;
begin
  perform private.mitsa_require(p_business, 'inventory-view', p_shop);

  select
    coalesce(sum(total_sales), 0),
    coalesce(sum(transaction_count), 0),
    coalesce(sum(total_items_sold), 0)
  into today_sales, today_txns, today_items
  from private.daily_summaries
  where business_id = p_business and summary_date = current_date
    and (p_shop is null or shop_id = p_shop);

  select count(*) into active_alerts
  from private.stock_alerts
  where business_id = p_business and status = 'active'
    and (p_shop is null or shop_id = p_shop);

  select count(*) into total_prods
  from private.products
  where business_id = p_business and active;

  select coalesce(sum(sl.quantity * p.cost_price), 0) into total_val
  from private.stock_levels sl
  join private.products p on p.id = sl.product_id
  where sl.business_id = p_business
    and (p_shop is null or sl.shop_id = p_shop);

  return jsonb_build_object(
    'todaySales', today_sales,
    'todayTransactions', today_txns,
    'todayItemsSold', today_items,
    'activeAlerts', active_alerts,
    'totalProducts', total_prods,
    'totalStockValue', total_val
  );
end $$;

-- L. BIR INVENTORY REPORT
create or replace function private.mitsa_inventory_report(
  p_business uuid, p_shop uuid default null
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
begin
  perform private.mitsa_require(p_business, 'financial');
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'displayCode', sub.display_code,
          'productName', sub.name,
          'category', sub.category,
          'unit', sub.unit,
          'quantityOnHand', sub.qty,
          'unitCost', sub.cost_price,
          'totalCost', sub.qty * sub.cost_price,
          'unitPrice', sub.selling_price,
          'totalRetailValue', sub.qty * sub.selling_price
        ) order by sub.display_code
      )
      from (
        select p.display_code, p.name, coalesce(c.name, 'Uncategorized') as category,
               p.unit, p.cost_price, p.selling_price, sum(sl.quantity) as qty
        from private.products p
        left join private.product_categories c on c.id = p.category_id
        join private.stock_levels sl on sl.product_id = p.id
        where p.business_id = p_business and p.active
          and (p_shop is null or sl.shop_id = p_shop)
        group by p.id, p.display_code, p.name, c.name, p.unit, p.cost_price, p.selling_price
        having sum(sl.quantity) > 0
      ) sub
    ),
    '[]'::jsonb
  );
end $$;

-- M. MOVEMENT HISTORY
create or replace function private.mitsa_movement_history(
  p_business uuid,
  p_shop uuid default null,
  p_product_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
begin
  perform private.mitsa_require(p_business, 'inventory-view', p_shop);
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'createdAt', m.created_at,
          'movementType', m.movement_type,
          'quantity', m.quantity,
          'productName', p.name,
          'productCode', p.display_code,
          'unit', p.unit,
          'shopId', m.shop_id,
          'shopName', s.name,
          'unitPrice', m.unit_price,
          'totalAmount', m.total_amount,
          'paymentMethod', m.payment_method,
          'reference', m.reference,
          'notes', m.notes,
          'batchNumber', b.batch_number
        ) order by m.created_at desc
      )
      from (
        select * from private.stock_movements
        where business_id = p_business
          and (p_shop is null or shop_id = p_shop)
          and (p_product_id is null or product_id = p_product_id)
        order by created_at desc
        limit least(coalesce(p_limit, 50), 200)
        offset greatest(coalesce(p_offset, 0), 0)
      ) m
      join private.products p on p.id = m.product_id
      join private.shops s on s.id = m.shop_id and s.business_id = m.business_id
      left join private.batches b on b.id = m.batch_id
    ),
    '[]'::jsonb
  );
end $$;

-- ============================================================================
-- 11. GRANT PERMISSIONS & POSTGREST API WRAPPERS
-- ============================================================================

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in (
      'mitsa_list_categories','mitsa_manage_category',
      'mitsa_list_products','mitsa_get_product','mitsa_create_product','mitsa_update_product',
      'mitsa_record_stock_in','mitsa_record_sale','mitsa_transfer_stock','mitsa_adjust_stock',
      'mitsa_dashboard_summary','mitsa_inventory_report','mitsa_movement_history'
    ) loop
    execute format('alter function %s owner to app_workspace', f.signature);
    execute format('revoke all on function %s from public,anon,authenticated', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

-- Public wrappers in api schema
create or replace function api.mitsa_list_categories(p_business uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_list_categories(p_business);
$$;

create or replace function api.mitsa_manage_category(
  p_business uuid, p_name text, p_action text, p_category_id uuid default null, p_sort_order integer default 0
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_manage_category(p_business, p_name, p_action, p_category_id, p_sort_order);
$$;

create or replace function api.mitsa_list_products(
  p_business uuid, p_shop uuid default null, p_category_id uuid default null,
  p_search text default null, p_active_only boolean default true
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_list_products(p_business, p_shop, p_category_id, p_search, p_active_only);
$$;

create or replace function api.mitsa_get_product(p_business uuid, p_product_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_get_product(p_business, p_product_id);
$$;

create or replace function api.mitsa_create_product(
  p_business uuid, p_name text, p_unit text, p_selling_price numeric,
  p_cost_price numeric default 0, p_category_id uuid default null,
  p_sku text default null, p_barcode text default null, p_min_stock integer default 0,
  p_track_batches boolean default false, p_hazard_class text default null,
  p_un_number text default null, p_description text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_create_product(
    p_business, p_name, p_unit, p_selling_price, p_cost_price, p_category_id,
    p_sku, p_barcode, p_min_stock, p_track_batches, p_hazard_class, p_un_number, p_description
  );
$$;

create or replace function api.mitsa_update_product(
  p_business uuid, p_product_id uuid, p_name text, p_unit text,
  p_selling_price numeric, p_cost_price numeric default 0, p_category_id uuid default null,
  p_sku text default null, p_barcode text default null, p_min_stock integer default 0,
  p_active boolean default true, p_hazard_class text default null,
  p_un_number text default null, p_description text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_update_product(
    p_business, p_product_id, p_name, p_unit, p_selling_price, p_cost_price,
    p_category_id, p_sku, p_barcode, p_min_stock, p_active, p_hazard_class, p_un_number, p_description
  );
$$;

create or replace function api.mitsa_record_stock_in(
  p_business uuid, p_shop uuid, p_items jsonb, p_reference text, p_key uuid
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_record_stock_in(p_business, p_shop, p_items, p_reference, p_key);
$$;

create or replace function api.mitsa_record_sale(
  p_business uuid, p_shop uuid, p_items jsonb, p_payment text, p_reference text, p_key uuid
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_record_sale(p_business, p_shop, p_items, p_payment, p_reference, p_key);
$$;

create or replace function api.mitsa_transfer_stock(
  p_business uuid, p_from_shop uuid, p_to_shop uuid, p_items jsonb, p_reference text, p_key uuid
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_transfer_stock(p_business, p_from_shop, p_to_shop, p_items, p_reference, p_key);
$$;

create or replace function api.mitsa_adjust_stock(
  p_business uuid, p_shop uuid, p_product_id uuid, p_batch_id uuid,
  p_new_quantity integer, p_reason text, p_key uuid
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_adjust_stock(p_business, p_shop, p_product_id, p_batch_id, p_new_quantity, p_reason, p_key);
$$;

create or replace function api.mitsa_dashboard_summary(p_business uuid, p_shop uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_dashboard_summary(p_business, p_shop);
$$;

create or replace function api.mitsa_inventory_report(p_business uuid, p_shop uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_inventory_report(p_business, p_shop);
$$;

create or replace function api.mitsa_movement_history(
  p_business uuid, p_shop uuid default null, p_product_id uuid default null,
  p_limit integer default 50, p_offset integer default 0
) returns jsonb language sql security invoker set search_path='' as $$
  select private.mitsa_movement_history(p_business, p_shop, p_product_id, p_limit, p_offset);
$$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='api' and p.proname like 'mitsa_%' loop
    execute format('revoke all on function %s from public,anon', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

revoke create on schema private from app_workspace;
notify pgrst, 'reload schema';
