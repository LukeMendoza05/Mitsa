import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const at=p=>fileURLToPath(new URL(p,import.meta.url));
// UI renderer only: no production route, environment files or live Auth client.
export default defineConfig({root:at('./'),envDir:false,publicDir:false,
 define:{'process.env.MITSA_AUTH_MAIL_MODE':'"isolated-capture"','process.env.MITSA_AUTH_CODE_CAPTURE_ENABLED':'"true"','process.env.MITSA_REGISTRATION_MODE':'"isolated-test"','process.env.AUTH_FLOW_KEY':'""','process.env.MFA_ENROLLMENT_KEY':'""'},
 resolve:{alias:[...['@/lib/workspaces','@/lib/workspace-management','@/lib/supabase/server','@/lib/auth/registration','@/lib/auth/development-registration','@/lib/auth/registration-service','@/lib/auth/signup-challenge'].map(find=>({find,replacement:at('./data.ts')})),
  {find:'@/lib/security/auth-flow',replacement:at('./flow.ts')},{find:'@/lib/security/enrollment-cookie',replacement:at('./enrollment.ts')},
  ...['next/navigation','next/headers','next/script'].map(find=>({find,replacement:at('./next.tsx')})),{find:'node:crypto',replacement:at('./crypto.ts')},{find:'@',replacement:at('../../src')} ]},
 server:{host:'127.0.0.1',port:3107,strictPort:true,fs:{allow:[at('../../src'),at('./'),at('../../node_modules')],deny:['**/.env*','**/.secrets/**','**/.git/**']}},
 plugins:[{name:'no-fixture-mutations',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end('Visual fixtures cannot perform mutations.');return;}next();});}}]
});
