import { database, createSyntheticUser, enrollSyntheticMfa, acceptSyntheticTerms } from "./hosted";

export async function securityFixture() {
  const owner = await enrollSyntheticMfa(await createSyntheticUser("owner"));
  const manager = await enrollSyntheticMfa(await createSyntheticUser("manager"));
  const cashier = await createSyntheticUser("cashier");
  const outsider = await enrollSyntheticMfa(await createSyntheticUser("outsider"));
  await Promise.all([owner,manager,cashier,outsider].map(acceptSyntheticTerms));
  const business = crypto.randomUUID(), otherBusiness = crypto.randomUUID();
  const shop = crypto.randomUUID(), secondShop = crypto.randomUUID(), otherShop = crypto.randomUUID();
  const db = await database();
  try {
    await db.query("begin");
    await db.query("insert into private.businesses(id,name) values ($1,'Synthetic proof'),($2,'Synthetic other')",[business,otherBusiness]);
    await db.query("insert into private.shops(business_id,id,name) values ($1,$2,'A'),($1,$3,'B'),($4,$5,'Other')",[business,shop,secondShop,otherBusiness,otherShop]);
    for (const [user,role,biz] of [[owner,"owner",business],[manager,"admin",business],[cashier,"staff",business],[outsider,"owner",otherBusiness]] as const) {
      await db.query("insert into private.memberships(business_id,user_id,role) values ($1,$2,$3)",[biz,user.id,role]);
    }
    for (const user of [manager,cashier]) await db.query("insert into private.shop_assignments(business_id,user_id,shop_id) values ($1,$2,$3)",[business,user.id,shop]);
    await db.query("commit");
  } catch (error) { await db.query("rollback"); throw error; }
  finally { await db.end(); }
  return { owner,manager,cashier,outsider,business,otherBusiness,shop,secondShop,otherShop };
}

export async function resource(business: string,shop: string,value=0) {
  const db = await database(), id = crypto.randomUUID();
  try { await db.query("insert into foundation_probe.resources(business_id,shop_id,id,initial_value,value) values ($1,$2,$3,$4,$4)",[business,shop,id,value]); }
  finally { await db.end(); }
  return id;
}
