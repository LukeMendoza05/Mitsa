import {expect,type Page} from "@playwright/test";
import {randomUUID,createHash} from "node:crypto";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {decrypt,readMessage,readPrivateKey} from "openpgp";
import {database,hostedConfig} from "./hosted";
import {totp} from "./totp";
import {fillPrivateInput} from './private-input';
const origin="http://127.0.0.1:3000";
export type JourneyIdentity={email:string;password:string;fullName:string;totpSecret?:string};
function savePrivateFixture(user:JourneyIdentity) {
  mkdirSync(".secrets/journeys",{recursive:true});writeFileSync(`.secrets/journeys/${createHash("sha256").update(user.email).digest("hex")}.json`,JSON.stringify(user),{mode:0o600});
}
export async function journeyIdentity(label:string):Promise<JourneyIdentity> {
  const target=hostedConfig();if(target.projectRef!=="mjtejwafxriwntweussc")throw Error("Unapproved journey target");
  const user={email:`foundation-browser-${label}-${randomUUID()}@example.invalid`,password:`M1!${randomUUID()}`,fullName:`Synthetic browser ${label}`};
  const db=await database();try {
    const gates=(await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled opened from private.release_gates where singleton")).rows[0];
    if(gates?.opened!==false)throw Error("Journey requires closed release gates");
    await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)",[user.email]);
  } finally {await db.end();}savePrivateFixture(user);return user;
}
export async function capturedLink(user:JourneyIdentity,type:"signup"|"recovery"|"invitation") {
  const db=await database();try {
    const table=type==="invitation"?"private.invitation_deliveries":"private.isolated_auth_mail";
    const rows=(await db.query(`select encrypted_payload from ${table} where recipient_hash=$1 ${type==="invitation"?"":"and action=$2"} order by created_at desc limit 1`,type==="invitation"?[createHash("sha256").update(user.email).digest("hex")]:[createHash("sha256").update(user.email).digest("hex"),type])).rows;
    if(!rows[0])throw Error("Private captured mail missing");
    const key=await readPrivateKey({armoredKey:readFileSync(".secrets/auth-mail/private.asc","utf8")});
    const data=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:rows[0].encrypted_payload}),decryptionKeys:key})).data));
    if(data.email!==user.email||data.type!==type||data.origin!==origin)throw Error("Captured mail binding mismatch");
    const link=new URL(type==="invitation"?"/invitations/open":"/auth/email",origin);
    if(type==="invitation") {if(!/^[a-f0-9]{64}$/.test(data.token))throw Error("Invalid captured invitation");link.searchParams.set("token",data.token);}
    else {if(!/^(pkce_)?[a-f0-9]{32,256}$/.test(data.tokenHash))throw Error("Invalid captured email");link.searchParams.set("type",type);link.searchParams.set("token_hash",data.tokenHash);}
    return link.href;
  }finally{await db.end();}
}
export async function openPrivateLink(page:Page,link:string) {
  try {await page.goto(link);}catch {throw Error("Private captured link could not be opened; token omitted");}
}
export async function registerJourney(page:Page,user:JourneyIdentity,invited=false) {
  await page.goto("/signup");
  if(invited)expect((await page.context().cookies()).some(c=>c.name==="mitsa-invitation-context")).toBe(true);
  await page.getByLabel("Full name",{exact:true}).fill(user.fullName);await fillPrivateInput(page.getByLabel("Email",{exact:true}),user.email);
  await fillPrivateInput(page.getByLabel("Password",{exact:true}),user.password);await fillPrivateInput(page.getByLabel("Confirm password",{exact:true}),user.password);
  await page.getByRole("checkbox",{name:"I have read and accept the isolated test agreement.",exact:true}).check();await page.getByRole("button",{name:"Create account",exact:true}).click();
  await expect(page).toHaveURL(/\/verify-email\?sent=1$/);
  if(invited)expect((await page.context().cookies()).some(c=>c.name==="mitsa-invitation-context")).toBe(true);
  const link=await capturedLink(user,"signup");await openPrivateLink(page,link);
  await expect(page.getByRole("button",{name:"Verify email",exact:true})).toBeVisible();
  if(invited)expect((await page.context().cookies()).some(c=>c.name==="mitsa-invitation-context")).toBe(true);
  // GET is scanner-safe: it must not have confirmed the new Auth account.
  const db=await database();try {expect((await db.query("select email_confirmed_at is null unconfirmed from auth.users where email=$1",[user.email])).rows[0]?.unconfirmed).toBe(true);}finally{await db.end();}
  await page.getByRole("button",{name:"Verify email",exact:true}).click();await expect(page).toHaveURL(invited?/\/invitations\/accept$/:/\/onboarding$/);
  console.info("Journey checkpoint: native registration and email verification passed");
}
export async function reauthenticateJourney(page:Page,user:JourneyIdentity) {
  await page.goto("/settings/account/security");await fillPrivateInput(page.getByLabel("Current password",{exact:true}),user.password);
  if(user.totpSecret)await fillPrivateInput(page.getByLabel("Current authenticator code",{exact:true}),totp(user.totpSecret));
  await page.getByRole("button",{name:"Confirm identity",exact:true}).click();await expect(page).toHaveURL(/updated=reauthenticated/);
}
export async function enrollJourney(page:Page,user:JourneyIdentity) {
  await reauthenticateJourney(page,user);await page.getByRole("button",{name:"Start authenticator setup",exact:true}).click();
  const key=await page.getByTestId("mfa-manual-key").textContent();if(!key||!/^[A-Z2-7]+$/.test(key))throw Error("Synthetic authenticator setup unavailable");
  await fillPrivateInput(page.getByLabel("New authenticator code",{exact:true}),totp(key));await page.getByRole("button",{name:"Confirm new authenticator",exact:true}).click();
  await expect(page).toHaveURL(/updated=enrolled/);user.totpSecret=key;savePrivateFixture(user);
  await expect(page.getByText("Your current session has verified MFA.",{exact:true})).toBeVisible();
  console.info("Journey checkpoint: trusted authenticator enrollment passed");
}
export async function createJourneyWorkspace(page:Page,name:string) {
  await page.goto("/onboarding");await page.getByLabel("Business name",{exact:true}).fill(name);await page.getByLabel("First location name",{exact:true}).fill("Main shop");
  await page.getByRole("button",{name:"Create workspace",exact:true}).click();await expect(page).toHaveURL(/\/w\/workspace-[a-f0-9-]+$/);
  const slug=new URL(page.url()).pathname.split("/")[2];await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();return slug;
}
export async function signInJourney(page:Page,user:JourneyIdentity) {
  await page.goto("/login");await fillPrivateInput(page.getByLabel("Email",{exact:true}),user.email);await fillPrivateInput(page.getByLabel("Password",{exact:true}),user.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/(workspaces|invitations\/accept)$/);
}
