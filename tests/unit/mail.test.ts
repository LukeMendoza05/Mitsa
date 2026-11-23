import {describe,it,expect,vi,afterEach} from "vitest";
import {createHmac,randomBytes,randomUUID} from "node:crypto";
vi.mock("server-only",()=>({}));
import {renderAccountMessage} from "../../src/lib/mail/messages";
import {deliverWithResend,verifyResendDelivery,recordResendDelivery} from "../../src/lib/mail/resend";
const origin="http://127.0.0.1:3000",message={kind:"invitation" as const,recipient:"foundation-mail@example.invalid",url:`${origin}/invitations/open?token=${"a".repeat(64)}`,workspaceName:'Synthetic <script>alert("x")</script>'};
const authorization={externalMailEnabled:true,senderVerified:true,approvedSender:"mail@example.com",approvedOrigin:origin};
afterEach(()=>vi.unstubAllGlobals());
describe("Mitsa mail boundary",()=>{
  it("renders original Mitsa messages and escapes workspace text without changing the protected link",()=>{
    const rendered=renderAccountMessage(message,origin);expect(rendered.subject).toBe("Your Mitsa workspace invitation");expect(rendered.html).not.toContain("<script>");expect(rendered.html).toContain("&lt;script&gt;");expect(rendered.text).toContain("seven days");
    expect(()=>renderAccountMessage({...message,url:message.url.replace(origin,"https://attacker.example")},origin)).toThrow();
    expect(()=>renderAccountMessage({...message,url:`${origin}/auth/email?type=recovery&token_hash=${"a".repeat(64)}`},origin)).toThrow();
  });
  it("refuses closed gates, unknown sender and old retries before making any network request",async()=>{
    const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
    const input={message,eventKey:"invitation/event-1",createdAt:Date.now(),authorization,apiKey:"re_synthetic"};
    for(const altered of [{...input,authorization:{...authorization,externalMailEnabled:false}},{...input,authorization:{...authorization,senderVerified:false}},{...input,createdAt:Date.now()-24*3600000}])await expect(deliverWithResend(altered)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the real SDK with a stable provider idempotency key and generic failure",async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:randomUUID()}),{status:200}));vi.stubGlobal("fetch",fetch);
    await deliverWithResend({message,eventKey:"invitation/event-1",createdAt:Date.now(),authorization,apiKey:"re_synthetic"});
    expect(fetch).toHaveBeenCalledOnce();const call=fetch.mock.calls[0];expect(new Headers(call[1].headers).get("idempotency-key")).toBe("mitsa/invitation/event-1");
    fetch.mockResolvedValue(new Response(JSON.stringify({name:"validation_error",message:"Private provider response"}),{status:422}));
    await expect(deliverWithResend({message,eventKey:"invitation/event-2",createdAt:Date.now(),authorization,apiKey:"re_synthetic"})).rejects.toThrow("Email delivery unconfirmed");
  });
  it("verifies raw SDK signatures, rejects tampering/expiry and commits only minimized events",async()=>{
    const bytes=randomBytes(32),secret=`whsec_${bytes.toString("base64")}`,id="msg_synthetic_1",timestamp=String(Math.floor(Date.now()/1000));
    const raw=JSON.stringify({type:"email.delivered",created_at:new Date().toISOString(),data:{email_id:randomUUID(),to:["private@example.invalid"],subject:"Secret link must not be retained"}});
    const sign=(body:string,time=timestamp)=>createHmac("sha256",bytes).update(`${id}.${time}.${body}`).digest("base64");
    const headers=new Headers({"svix-id":id,"svix-timestamp":timestamp,"svix-signature":`v1,${sign(raw)}`});
    const event=verifyResendDelivery(raw,headers,secret);expect(JSON.stringify(event)).not.toContain("private@");expect(event.type).toBe("email.delivered");
    expect(()=>verifyResendDelivery(raw+" ",headers,secret)).toThrow();
    const old=String(Number(timestamp)-600);expect(()=>verifyResendDelivery(raw,new Headers({"svix-id":id,"svix-timestamp":old,"svix-signature":`v1,${sign(raw,old)}`}),secret)).toThrow();
    const commit=vi.fn().mockRejectedValue(Error("Transaction unavailable"));await expect(recordResendDelivery(raw,headers,secret,commit)).rejects.toThrow("Transaction unavailable");expect(commit).toHaveBeenCalledWith(event);
    commit.mockResolvedValue("duplicate");expect(await recordResendDelivery(raw,headers,secret,commit)).toBe("duplicate");
    commit.mockClear();await expect(recordResendDelivery(raw+"x",headers,secret,commit)).rejects.toThrow();expect(commit).not.toHaveBeenCalled();
  });
});
