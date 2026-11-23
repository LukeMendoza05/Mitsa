import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('closed and paused signup give accurate feedback without enabling submission',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:3107'?route.continue():route.abort());
 for(const [state,heading] of [['registration-closed','Registration is closed'],['delivery-paused','Registration is paused'],['registration-unavailable','Registration unavailable']]){
  await page.goto(`/signup?state=${state}&error=unavailable`);await expect(page.getByRole('status').filter({hasText:heading})).toBeVisible();await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toHaveCount(0);
  if(state==='registration-closed')await expect(page.getByText('The current account setup could not be verified.',{exact:false})).toHaveCount(0);
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
 }
 await page.goto('/signup');await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeEnabled();
});
