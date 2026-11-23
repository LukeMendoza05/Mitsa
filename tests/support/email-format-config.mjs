import {existsSync,readFileSync} from 'node:fs';
import {parse} from 'dotenv';

// Match the application without loading any private runtime/operator secrets
// into the test process. An explicit test override still supports rollback QA.
export function loadEmailCodeTestSetting() {
 const local=existsSync('.env.local')?parse(readFileSync('.env.local')).MITSA_EMAIL_OTP_LENGTH:undefined;
 const value=process.env.MITSA_EMAIL_OTP_LENGTH??local??'6';
 if(value!=='6'&&value!=='8')throw Error('Unsupported email verification test configuration');
 process.env.MITSA_EMAIL_OTP_LENGTH=value;
}
