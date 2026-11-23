import "server-only";
import {createHash,timingSafeEqual} from "node:crypto";
import {syntheticEmail} from "./forms";
/** Format/UX defense only. SQL, signed intent and provider hooks still enforce
 * the actual explicit allowlist. This hash grants no provider or workspace role. */
export function isLocalTestingEmail(email:string,approvedHash=process.env.MITSA_DEVELOPER_EMAIL_SHA256??"") {
  if(syntheticEmail(email))return true;
  if(!/^[a-f0-9]{64}$/.test(approvedHash))return false;
  return timingSafeEqual(createHash("sha256").update(email.trim().toLowerCase()).digest(),Buffer.from(approvedHash,"hex"));
}
