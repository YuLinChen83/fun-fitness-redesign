import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { parseSchedule } from './parser';
import * as dotenv from 'dotenv';

dotenv.config();
puppeteer.use(StealthPlugin());

async function runTest() {
  const rawHtmlPath = path.join(__dirname, '../raw.html');
  
  // Test 1: Parse the existing raw.html we just fetched
  if (fs.existsSync(rawHtmlPath)) {
    console.log('--- Test 1: Parsing existing raw.html (Past Schedule) ---');
    const html = fs.readFileSync(rawHtmlPath, 'utf-8');
    const parsed = parseSchedule(html);
    console.log(`Parsed ${parsed.length} classes.`);
    console.log('Sample of parsed classes (first 3):');
    console.log(JSON.stringify(parsed.slice(0, 3), null, 2));
  }

  // Test 2: Fetch future schedule
  console.log('\n--- Test 2: Fetching Future Schedule (Week of 2026/6/17) ---');
  
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: path.join(__dirname, '../puppeteer_data'),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');

    // Parse and set the test cookies
    const cookieStr = process.env.TEST_COOKIE || '';
    if (cookieStr) {
      const cookies = cookieStr.split(';').map(c => {
        const trimmed = c.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return null;
        const name = trimmed.substring(0, eqIdx);
        const value = decodeURIComponent(trimmed.substring(eqIdx + 1));
        return {
          name,
          value,
          domain: 'clients.mindbodyonline.com',
          path: '/'
        };
      }).filter(Boolean) as any[];

      await page.setCookie(...cookies);
    }

    console.log('Navigating to Mindbody to verify session...');
    await page.goto('https://clients.mindbodyonline.com/classic/mainclass?fl=true&tabID=7', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    let title = await page.title();
    console.log(`Initial Page Title: "${title}"`);

    // Handle Cloudflare check if detected
    if (title === 'Security Check' || title.includes('Just a moment') || title === 'Attention Required!') {
      console.log('⏳ Cloudflare Security Check detected, waiting 8 seconds for stealth plugin to bypass...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      title = await page.title();
      console.log(`Page Title after wait: "${title}"`);
    }

    console.log('Executing in-page POST fetch for FUTURE schedule (2026/6/17)...');
    const postData = new URLSearchParams({
      pageNum: '1',
      requiredtxtUserName: '',
      requiredtxtPassword: '',
      optForwardingLink: '',
      optRememberMe: '',
      tabID: '7',
      optView: 'week',
      useClassLogic: '',
      filterByClsSch: '',
      prevFilterByClsSch: '-1',
      prevFilterByClsSch2: '-2',
      txtDate: '2026/6/17', // Future date
      optLocation: '2',
      optInstructor: '0'
    }).toString();

    const futureHtml = await page.evaluate(async (data) => {
      const response = await fetch('https://clients.mindbodyonline.com/classic/mainclass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
      });
      return response.text();
    }, postData);

    const futureHtmlPath = path.join(__dirname, '../raw_future.html');
    fs.writeFileSync(futureHtmlPath, futureHtml, 'utf-8');
    
    // Check if the evaluate response is also blocked
    if (futureHtml.includes('<title>Security Check</title>')) {
      console.log('❌ In-page fetch was blocked by Cloudflare (Security Check in response).');
      return;
    }

    console.log(`Saved future HTML to ${futureHtmlPath}`);

    const parsedFuture = parseSchedule(futureHtml);
    console.log(`Parsed ${parsedFuture.length} classes from future schedule.`);
    
    // Find if there's any class that can be booked
    const bookableClasses = parsedFuture.filter(c => c.canBook);
    console.log(`Found ${bookableClasses.length} bookable classes.`);
    
    if (bookableClasses.length > 0) {
      console.log('Sample of bookable classes:');
      console.log(JSON.stringify(bookableClasses.slice(0, 3), null, 2));
    } else {
      console.log('⚠️ No bookable classes found.');
    }

  } catch (error) {
    console.error('Error during Test 2:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

runTest();
