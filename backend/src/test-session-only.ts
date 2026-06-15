import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { parseSchedule } from './parser';

puppeteer.use(StealthPlugin());

async function run() {
  // Use ONLY ASP.NET_SessionId from the user's curl (removed SessionFarm_GUID and CF clearance)
  const sessionIdValue = 'm03vejkgbhgd404xrwub5vyr'; // From user's curl

  console.log(`Launching browser to test ONLY ASP.NET_SessionId: ${sessionIdValue}`);
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

    const cookies = [
      {
        name: 'ASP.NET_SessionId',
        value: sessionIdValue,
        domain: 'clients.mindbodyonline.com',
        path: '/'
      }
    ];

    await page.setCookie(...cookies);

    console.log('Navigating to Mindbody class page...');
    await page.goto('https://clients.mindbodyonline.com/classic/mainclass?fl=true&tabID=7', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    let title = await page.title();
    if (title === 'Security Check' || title.includes('Just a moment')) {
      console.log('Waiting for Cloudflare...');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }

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

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log(`Navigated to: ${page.url()}`);

    const html = await page.content();
    fs.writeFileSync(path.join(__dirname, '../raw_test_session_only.html'), html, 'utf-8');

    const isLoggedIn = html.includes('signOut') || html.includes('Sign Out') || html.includes('登出');
    console.log(`Is Logged In (detected in HTML with ONLY SessionId): ${isLoggedIn}`);

    const parsed = parseSchedule(html);
    const targetDateClasses = parsed.filter(c => c.date === '2026/6/15');
    console.log(`Found ${targetDateClasses.length} classes on 2026/6/15:`);
    
    targetDateClasses.forEach((c, idx) => {
      if (c.name.includes('伸展瑜珈') || c.name.includes('Stretch')) {
        console.log(`${idx + 1}. [${c.time}] - ${c.name} (${c.teacher})`);
        console.log(`   canBook: ${c.canBook}, isRegistered: ${c.isRegistered}, bookButtonText: "${c.bookButtonText}"`);
      }
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
