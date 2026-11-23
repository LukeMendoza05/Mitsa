import {test,expect,devices,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFileSync,mkdirSync} from "node:fs";
import {database} from "../support/hosted";
import {journeyIdentity,registerJourney,signInJourney,reauthenticateJourney,type JourneyIdentity} from "../support/journeys";
const origin="http://127.0.0.1:3000";
type Operator=JourneyIdentity&{userId:string};
const support=JSON.parse(readFileSync(".secrets/support-access.json","utf8")) as {project:string;ready:boolean;users:{reviewer:Operator;executor:Operator}};

test("independent scoped request review, private export, correction and permission revocation",async({browser},info)=>{
  expect(support.project).toBe("mjtejwafxriwntweussc");expect(support.ready).toBe(true);
  const device=devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"];
  const contexts=await Promise.all([browser.newContext(device),browser.newContext(device),browser.newContext(device)]);
  const [subjectPage,reviewPage,executePage]=await Promise.all(contexts.map(c=>c.newPage()));
  const subject=await journeyIdentity("privacy");const db=await database();
  const requestId=async(kind:string,email=subject.email)=>(await db.query("select r.id from private.account_requests r join auth.users u on u.id=r.user_id where u.email=$1 and r.kind=$2 order by r.requested_at desc limit 1",[email,kind])).rows[0].id as string;
  const reviewCase=async(id:string)=>{
    await reviewPage.goto("/operator/requests");
    let card=reviewPage.locator("article").filter({has:reviewPage.locator(`input[name=requestId][value='${id}']`)});
    await card.getByLabel("Decision explanation",{exact:true}).fill("Synthetic independent review started");
    await card.getByRole("button",{name:"Record review decision",exact:true}).click();await expect(reviewPage).toHaveURL(/updated=review/);
    await expect.poll(async()=>(await db.query("select status from private.account_requests where id=$1",[id])).rows[0].status).toBe("under-review");await reviewPage.goto("/operator/requests");
    card=reviewPage.locator("article").filter({has:reviewPage.locator(`input[name=requestId][value='${id}']`)});
    await card.getByLabel("Review decision",{exact:true}).selectOption("approved");
    await card.getByLabel("Decision explanation",{exact:true}).fill("Synthetic verification completed independently");
    await card.getByLabel("Independent verification reference",{exact:true}).fill("Isolated synthetic fixture proof reviewed separately");
    await card.getByRole("checkbox").check();await card.getByRole("button",{name:"Record review decision",exact:true}).click();await expect(reviewPage).toHaveURL(/updated=review/);
    await expect.poll(async()=>(await db.query("select status,reviewer_id from private.account_requests where id=$1",[id])).rows[0]).toMatchObject({status:"approved",reviewer_id:support.users.reviewer.userId});
  };
  const executeCase=async(id:string)=>{
    await executePage.goto("/operator/requests");const card=executePage.locator("article").filter({has:executePage.locator(`input[name=requestId][value='${id}']`)});
    await card.getByRole("checkbox").check();await card.getByRole("button",{name:"Execute approved request",exact:true}).click();await expect(executePage).toHaveURL(/updated=execution/);
    await expect.poll(async()=>(await db.query("select status from private.account_requests where id=$1",[id])).rows[0].status).toBe("completed");
  };
  try {
    await registerJourney(subjectPage,subject);await subjectPage.goto("/operator/requests");await expect(subjectPage).toHaveURL(/access-denied/);
    await subjectPage.goto("/settings/account/privacy");await subjectPage.getByRole("button",{name:"Submit review request",exact:true}).click();await expect(subjectPage).toHaveURL(/submitted=1/);const access=await requestId("access");
    for(const [page,user] of [[reviewPage,support.users.reviewer],[executePage,support.users.executor]] as const){await signInJourney(page,user);await reauthenticateJourney(page,user);}
    await reviewCase(access);
    const forbidden=await contexts[1].request.post(`${origin}/auth/operator/requests`,{headers:{origin},form:{action:"execute",requestId:access,confirm:"on"},maxRedirects:0});expect(forbidden.headers().location).toContain("error=execution");
    const forgedReview=await contexts[2].request.post(`${origin}/auth/operator/requests`,{headers:{origin},form:{action:"review",requestId:access,decision:"approved",reason:"Forged synthetic approval",evidence:"No review capability exists",verified:"on"},maxRedirects:0});expect(forgedReview.headers().location).toContain("error=authorization");
    await executeCase(access);
    const exported=await contexts[0].request.get(`${origin}/auth/privacy/export/${access}`);expect(exported.status()).toBe(200);expect(exported.headers()["cache-control"]).toContain("no-store");expect(exported.headers()["content-disposition"]).toContain("attachment");
    const personal=await exported.json();expect(personal.emailAtRequest).toBe(subject.email);expect(personal.profile.fullName).toBe(subject.fullName);expect(personal.memberships).toEqual([]);
    expect((await contexts[1].request.get(`${origin}/auth/privacy/export/${access}`)).status()).toBe(404);
    await subjectPage.goto("/settings/account/privacy");await expect(subjectPage.getByRole("link",{name:/Download your account data/})).toBeVisible();
    await subjectPage.getByLabel("Request type",{exact:true}).selectOption("correction");await subjectPage.getByLabel("Corrected full name",{exact:true}).fill("Synthetic corrected privacy account");await subjectPage.getByRole("button",{name:"Submit review request",exact:true}).click();await expect(subjectPage).toHaveURL(/submitted=1/);const correction=await requestId("correction");await reviewCase(correction);
    await db.query("update private.operator_principals set active=false,revoked_at=now() where user_id=$1",[support.users.executor.userId]);
    await db.query("insert into private.access_audit(event,target_id,detail) values('support.synthetic-revocation-tested',$1,'{}')",[support.users.executor.userId]);
    const revoked=await contexts[2].request.post(`${origin}/auth/operator/requests`,{headers:{origin},form:{action:"execute",requestId:correction,confirm:"on"},maxRedirects:0});expect(revoked.headers().location).toContain("error=execution");
    await executePage.goto("/operator/requests");await expect(executePage).toHaveURL(/access-denied/);
    await db.query("update private.operator_principals set active=true,revoked_at=null where user_id=$1",[support.users.executor.userId]);
    await db.query("insert into private.access_audit(event,target_id,detail) values('support.synthetic-scope-restored',$1,'{}')",[support.users.executor.userId]);
    await executeCase(correction);await subjectPage.goto("/settings/account");await expect(subjectPage.getByLabel("Full name",{exact:true})).toHaveValue("Synthetic corrected privacy account");
    await reviewPage.goto("/settings/account/privacy");await reviewPage.getByRole("button",{name:"Submit review request",exact:true}).click();await expect(reviewPage).toHaveURL(/submitted=1/);const own=await requestId("access",support.users.reviewer.email);
    const self=await contexts[1].request.post(`${origin}/auth/operator/requests`,{headers:{origin},form:{action:"review",requestId:own,decision:"under-review",reason:"Self review must be refused"},maxRedirects:0});expect(self.headers().location).toContain("error=authorization");
    await subjectPage.goto("/settings/account/recovery");await subjectPage.getByRole("button",{name:"Request independent recovery review",exact:true}).click();await expect(subjectPage).toHaveURL(/submitted=1/);const recovery=await requestId("mfa-recovery");await reviewCase(recovery);
    const reset=await contexts[2].request.post(`${origin}/auth/operator/requests`,{headers:{origin},form:{action:"execute",requestId:recovery,confirm:"on"},maxRedirects:0});expect(reset.headers().location).toContain("error=execution");expect((await db.query("select status from private.account_requests where id=$1",[recovery])).rows[0].status).toBe("approved");
    await subjectPage.goto("/settings/account/privacy");expect((await new AxeBuilder({page:subjectPage}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
    mkdirSync("docs/previews/auth-workspaces",{recursive:true});await subjectPage.screenshot({path:`docs/previews/auth-workspaces/privacy-${info.project.name}.png`,fullPage:true});
    expect(Number((await db.query("select count(*) n from private.access_audit where target_id=$1 and event='privacy.export-downloaded'",[access])).rows[0].n)).toBeGreaterThan(0);
    expect((await db.query("select count(*)::int n from private.memberships where user_id=any($1::uuid[])",[[support.users.reviewer.userId,support.users.executor.userId]])).rows[0].n).toBe(0);
  }finally{
    // Restore only the exact approved synthetic capability after the bounded
    // revocation test; no broader scope, record deletion or factor reset.
    await db.query("update private.operator_principals set active=true,revoked_at=null where user_id=$1",[support.users.executor.userId]);await db.end();await Promise.all(contexts.map(c=>c.close()));
  }
});
