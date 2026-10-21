import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Ho_Chi_Minh',reducedMotion:'reduce'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
for(const [name,path] of [['desktop','/'],['leads','/#/leads'],['ticket','/#/assignments/PC-0001/show'],['reports','/#/reports']]) {
 await page.goto('http://127.0.0.1:5173'+path); await page.locator('h1').waitFor(); await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:'.impeccable/review/'+name+'.png',fullPage:true});
}
await page.setViewportSize({width:390,height:844});
await page.goto('http://127.0.0.1:5173'); await page.locator('h1').waitFor(); await page.screenshot({path:'.impeccable/review/mobile.png',fullPage:true});
console.log(JSON.stringify({errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
await browser.close();
