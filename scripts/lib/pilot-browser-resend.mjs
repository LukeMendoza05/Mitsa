// The destination may already be ?resent=1. Wait for this POST and a new
// main-document navigation, never just a URL predicate that is already true.
import {expect} from '@playwright/test';
export async function submitPilotResend(page) {
 const button=page.getByRole('button',{name:'Resend code',exact:true});
 // The real UI may still have its 60-second cooldown. Start the shorter
 // response/navigation deadlines only after the button becomes available.
 await expect(button).toBeEnabled({timeout:75000});
 const [response]=await Promise.all([
  page.waitForResponse(response=>{
   const url=new URL(response.url());
   return url.origin===new URL(page.url()).origin&&url.pathname==='/auth/email/code'&&response.request().method()==='POST';
  },{timeout:30000}),
  page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:30000}),
  button.click({timeout:75000}),
 ]);
 await page.waitForLoadState('load');
 const destination=new URL(page.url());
 if(response.status()<200||response.status()>=400||destination.pathname!=='/verify-email'||destination.searchParams.get('resent')!=='1')throw Error('Resend did not complete');
}
