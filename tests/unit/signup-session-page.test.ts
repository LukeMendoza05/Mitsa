import {beforeEach,expect,it,vi} from 'vitest';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const mocks=vi.hoisted(()=>({user:vi.fn(),context:vi.fn(),form:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({componentClient:async()=>({auth:{getUser:mocks.user}})}));
vi.mock('@/lib/auth/registration',()=>({registrationContext:mocks.context}));
vi.mock('next/headers',()=>({headers:async()=>new Headers()}));
vi.mock('@/components/auth/AuthLayout',()=>({AuthLayout:({children}:{children:React.ReactNode})=>createElement('main',null,children)}));
vi.mock('@/components/auth/SignupForm',()=>({SignupForm:(props:unknown)=>{mocks.form(props);return createElement('form',{'data-signup':true});}}));
import SignupPage from '../../src/app/signup/page';
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:null}});mocks.context.mockResolvedValue({enabled:true,isTest:false,isDevelopmentOpen:true,policy:{id:crypto.randomUUID(),status:'test'}});});
it('shows a signed-in notice without exposing identity or rendering a signup form or CAPTCHA',async()=>{
 mocks.user.mockResolvedValue({data:{user:{id:'synthetic-existing',email:'private-synthetic@example.com'}}});
 const html=renderToStaticMarkup(await SignupPage({searchParams:Promise.resolve({})}));
 expect(html).toContain('already signed in');expect(html).toContain('href="/workspaces"');expect(html).toContain('separate browser profile');
 expect(html).not.toMatch(/<form|captcha|private-synthetic|synthetic-existing/);expect(mocks.context).not.toHaveBeenCalled();expect(mocks.form).not.toHaveBeenCalled();
});
it('keeps signup available to a genuinely signed-out browser through the existing policy',async()=>{
 const html=renderToStaticMarkup(await SignupPage({searchParams:Promise.resolve({})}));
 expect(html).toContain('data-signup');expect(mocks.context).toHaveBeenCalledOnce();expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({enabled:true,isTest:true}));
});
