import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { parseSchedule } from './parser';

puppeteer.use(StealthPlugin());

async function run() {
  // Use the exact cookie string provided by the user in the curl command
  const cookieStr = `_ga=GA1.1.211611601.1780068893; ASP.NET_SessionId=m03vejkgbhgd404xrwub5vyr; cf_clearance=XpphIzll5BWHxac_49W59wHwHewTORvk.GfxkZAU_9A-1781362446-1.2.1.1-8ckCY5BzmJgl_NmhEws0j1yT6wS4q7DG9xUDZuILmU.NE8Zu5yw0T1W03YpupkKfVr41t0ecQrkwNC0gxVY9Qgm40EJ5vS_z6OOdyxt2tQJrutbkVc4v2bFYzRdHeZs_yP89F3qML7nL.kGCXnUAYB2WD2KbIXqgTfWX8ZJua4NhcT00I45O3HfUQcu_ePvXhjuJkuHLoRYQq16ZaNKItQ_G6UISpJZhxbMQB9v8cQCjnkplzChms1rUaXLHWZPlGUD4e9p5ACz9Pd_9ZvkvxDr4KDjmdkmnUgMoJQaGPZMdnC9niVDXzI9lFz4JUVJeVUqSv4DDA9j0_BCOm_64TA; SessionFarm%5FGUID={2CB0100F-86DC-431D-A486-21ABCC50D439}; _ga_N9Y2VFWE7W=GS2.1.s1781362446$o2$g1$t1781362814$j25$l0$h0; __cflb=0H28vYZVtJfvNQhAhqViMmp2otirP22YU3h7PAceCsP; __cf_bm=hLX69HA1IgJbkByGHyqRGmWEW884z4Yol6PlSv5TxJ8-1781369504.8715134-1.0.1.1-MCRh6qlsppIpQJBLVlvbZ_uJdHu6QLiMHtreEfe62Oc.8U_RSXWo9TQBMrRUowvTGqvC.y2LMtiuX7gcjx6uX40tB59rP9otexpQ.3Ut8sYm.D_j98eEU3hUThPIlCV60sJWpTjCyDGeIYJ8b3GY3A; _ga_STMZ2T81YN=GS2.1.s1781369041$o4$g1$t1781369572$j58$l0$h0`;

  console.log('Launching browser for screenshot test...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1024 });

    // Inject cookies (excluding cloudflare cookies)
    const cookies = cookieStr.split(';').map(c => {
      const trimmed = c.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return null;
      const name = decodeURIComponent(trimmed.substring(0, eqIdx));
      const value = decodeURIComponent(trimmed.substring(eqIdx + 1));
      
      if (name === '__cf_bm' || name === 'cf_clearance' || name.startsWith('__cf')) {
        return null;
      }

      return {
        name,
        value,
        domain: 'clients.mindbodyonline.com',
        path: '/'
      };
    }).filter(Boolean) as any[];

    console.log(`Injecting ${cookies.length} cookies...`);
    await page.setCookie(...cookies);

    console.log('Navigating to Mindbody class page...');
    await page.goto('https://clients.mindbodyonline.com/classic/mainclass?fl=true&tabID=7', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    let title = await page.title();
    console.log(`Initial page title: "${title}"`);
    if (title === 'Security Check' || title.includes('Just a moment')) {
      console.log('Waiting 8s for Cloudflare check...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      title = await page.title();
      console.log(`Title after wait: "${title}"`);
    }

    // Capture first screenshot
    const screenshot1Path = path.join(__dirname, '../step1_mainclass.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`Saved screenshot 1 to: ${screenshot1Path}`);

    // Submit date 2026/6/15
    console.log('Submitting query for 2026/6/15...');
    await page.evaluate(() => {
      const dateInput = document.querySelector('#txtDate') as HTMLInputElement;
      const locSelect = document.querySelector('#optLocation') as HTMLSelectElement;
      if (dateInput && locSelect) {
        dateInput.value = '2026/6/15';
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
        locSelect.value = '2';
        locSelect.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof (window as any).subForm === 'function') {
          (window as any).subForm();
        }
      }
    });

    console.log('Waiting for query navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log(`Navigated to: ${page.url()}`);

    // Capture second screenshot
    const screenshot2Path = path.join(__dirname, '../step2_after_search.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`Saved screenshot 2 to: ${screenshot2Path}`);

    const html = await page.content();
    const isLoggedIn = html.includes('signOut') || html.includes('Sign Out') || html.includes('登出');
    console.log(`Is Logged In (detected in HTML): ${isLoggedIn}`);

    const parsed = parseSchedule(html);
    const targetDateClasses = parsed.filter(c => c.date === '2026/6/15');
    console.log(`Parsed ${parsed.length} classes, ${targetDateClasses.length} are on 2026/6/15.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
