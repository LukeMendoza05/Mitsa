import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateKey, readKey, readPrivateKey } from "openpgp";

// Development operator only. No key is installed in the app or hosted project.
const directory = ".secrets/auth-mail", privatePath = `${directory}/private.asc`, publicPath = `${directory}/public.asc`;
mkdirSync(directory,{recursive:true});
if (existsSync(privatePath) || existsSync(publicPath)) {
  if (!existsSync(privatePath) || !existsSync(publicPath)) throw new Error("Incomplete mail key pair; refusing replacement");
  const privateKey = await readPrivateKey({armoredKey:readFileSync(privatePath,"utf8")});
  const publicKey = await readKey({armoredKey:readFileSync(publicPath,"utf8")});
  if (privateKey.getFingerprint() !== publicKey.getFingerprint()) throw new Error("Mail key mismatch");
  console.log("Existing private mail key preserved; fingerprint "+publicKey.getFingerprint());
} else {
  // RSA v4 is compatible with PostgreSQL pgcrypto's OpenPGP implementation.
  const pair = await generateKey({type:"rsa",rsaBits:3072,userIDs:[{name:"Mitsa isolated test mail"}],format:"armored",config:{aeadProtect:false}});
  writeFileSync(privatePath,pair.privateKey,{flag:"wx",mode:0o600});
  writeFileSync(publicPath,pair.publicKey,{flag:"wx",mode:0o600});
  console.log("Local mail-capture key pair created; no keys or mail tokens printed.");
}
