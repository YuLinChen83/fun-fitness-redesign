import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as path from 'path';
import * as fs from 'fs';
import { parseSchedule } from './parser';
import { Browser } from 'puppeteer';

dotenv.config();
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let browserInstance: Browser | null = null;

interface CacheEntry {
  schedule: any[];
  fetchedAt: number;
}
const scheduleCache: Record<string, CacheEntry> = {};

function getMondayOfDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return `${monday.getFullYear()}/${monday.getMonth() + 1}/${monday.getDate()}`;
}

async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    try {
      await browserInstance.version();
      return browserInstance;
    } catch (e) {
      console.log('Global browser instance died, restarting...');
      browserInstance = null;
    }
  }

  console.log('Launching new global Puppeteer browser...');
  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--use-gl=desktop',
      '--window-size=1280,1024'
    ]
  }) as unknown as Browser;
  return browserInstance;
}

// Helper to submit the date query form in Mindbody page
async function submitMindbodyForm(page: any, targetDate: string, targetLoc: string) {
  const formSubmitted = await page.evaluate(async (date: string, loc: string) => {
    const dateInput = document.querySelector('#txtDate') as HTMLInputElement;
    const locSelect = document.querySelector('#optLocation') as HTMLSelectElement;
    
    if (dateInput && locSelect) {
      dateInput.value = date;
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      locSelect.value = loc;
      locSelect.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (typeof (window as any).subForm === 'function') {
        (window as any).subForm();
      } else {
        const form = document.querySelector('form[name="search2"]') as HTMLFormElement || document.querySelector('form') as HTMLFormElement;
        if (form) form.submit();
        else return false;
      }
      return true;
    }
    return false;
  }, targetDate, targetLoc);

  if (!formSubmitted) {
    throw new Error(`Failed to submit query form for date: ${targetDate}`);
  }

  console.log('Waiting for schedule table to render...');
  try {
    await page.waitForSelector('#classSchedule-mainTable', { timeout: 20000 });
  } catch (err) {
    console.log('Table selector timeout, fallback to domcontentloaded navigation wait...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  }
}

// 1. GET Schedule API
app.post('/api/schedule', async (req, res) => {
  const { date, locationId, refresh } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'date is required (format: YYYY/MM/DD)' });
  }

  const loc = locationId || '2';
  
  // Calculate Monday of the queried week
  const thisMonday = getMondayOfDate(date);
  
  // Calculate Mondays for next week and the week after (to support full 14-day rolling window across weeks)
  const [y, m, d] = thisMonday.split('/').map(Number);
  const thisMondayDate = new Date(y, m - 1, d);
  
  const nextMondayDate = new Date(thisMondayDate);
  nextMondayDate.setDate(thisMondayDate.getDate() + 7);
  const nextMonday = `${nextMondayDate.getFullYear()}/${nextMondayDate.getMonth() + 1}/${nextMondayDate.getDate()}`;
  
  const thirdMondayDate = new Date(thisMondayDate);
  thirdMondayDate.setDate(thisMondayDate.getDate() + 14);
  const thirdMonday = `${thirdMondayDate.getFullYear()}/${thirdMondayDate.getMonth() + 1}/${thirdMondayDate.getDate()}`;
  
  const cacheKey1 = `${thisMonday}-${loc}`;
  const cacheKey2 = `${nextMonday}-${loc}`;
  const cacheKey3 = `${thirdMonday}-${loc}`;
  
  console.log(`Query Date: ${date} -> This Monday: ${thisMonday}, Next Monday: ${nextMonday}, Third Monday: ${thirdMonday}`);

  if (refresh === true) {
    console.log(`🔄 Manual refresh requested. Clearing cache for keys: ${cacheKey1}, ${cacheKey2}, ${cacheKey3}`);
    delete scheduleCache[cacheKey1];
    delete scheduleCache[cacheKey2];
    delete scheduleCache[cacheKey3];
  }

  const todayDateStr = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${new Date().getDate()}`;
  const currentWeekMonday = getMondayOfDate(todayDateStr);
  const isPastWeek = new Date(thisMonday) < new Date(currentWeekMonday);
  
  // Try retrieving from cache first
  let thisWeekSchedule = scheduleCache[cacheKey1]?.schedule;
  let nextWeekSchedule = scheduleCache[cacheKey2]?.schedule;
  let thirdWeekSchedule = scheduleCache[cacheKey3]?.schedule;

  if (thisWeekSchedule && nextWeekSchedule && thirdWeekSchedule && !isPastWeek) {
    console.log(`⚡ Cache Hit for all three weeks! Returning merged schedule.`);
    return res.json({ 
      success: true, 
      date, 
      locationId: loc, 
      schedule: [...thisWeekSchedule, ...nextWeekSchedule, ...thirdWeekSchedule],
      fromCache: true 
    });
  }

  console.log(`❌ Cache Miss for one or both weeks. Fetching fresh data via Puppeteer...`);

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1024 });

    // Go to mainclass specifying the studio ID (539962) to bypass studio selection page
    await page.goto('https://clients.mindbodyonline.com/classic/mainclass?fl=true&tabID=7&studioid=539962', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const artifactsDir = '/Users/tiffanfchen/.gemini/antigravity-cli/brain/269670d7-a4c8-4dcb-8a68-af0519cc954e';
    try {
      if (fs.existsSync(artifactsDir)) {
        await page.screenshot({ path: path.join(artifactsDir, 'screenshot_initial.png'), fullPage: true });
        const initialHtml = await page.content();
        fs.writeFileSync(path.join(artifactsDir, 'debug_initial.html'), initialHtml);
        console.log('📸 Initial debug screenshot and HTML saved.');
      }
    } catch (debugErr: any) {
      console.log('Failed to save initial debug artifacts:', debugErr.message);
    }

    let title = '';
    try {
      title = await page.title();
    } catch (titleErr: any) {
      console.log('Error getting schedule page title (possibly redirecting):', titleErr.message);
    }
    
    if (title === 'Security Check' || title.includes('Just a moment') || title === 'Attention Required!') {
      console.log('⏳ Cloudflare Security Check detected, waiting 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      try {
        title = await page.title();
      } catch (e) {}
    }

    // Wait for the form input selector to appear after Cloudflare check
    await page.waitForSelector('#txtDate', { timeout: 20000 });

    // 1. Fetch This Week (if not cached)
    let finalThisWeekSchedule = thisWeekSchedule;
    if (!finalThisWeekSchedule) {
      console.log(`Submitting form for This Week: ${thisMonday}, Location: ${loc}`);
      await submitMindbodyForm(page, thisMonday, loc);
      const html = await page.content();
      finalThisWeekSchedule = parseSchedule(html);
      console.log(`Parsed ${finalThisWeekSchedule.length} classes for week of ${thisMonday}`);
      
      if (!isPastWeek) {
        scheduleCache[cacheKey1] = {
          schedule: finalThisWeekSchedule,
          fetchedAt: Date.now()
        };
        console.log(`💾 Saved schedule to cache key: ${cacheKey1}`);
      }
    } else {
      console.log(`⚡ Using cached schedule for this week: ${cacheKey1}`);
    }

    // 2. Fetch Next Week (if not cached)
    let finalNextWeekSchedule = nextWeekSchedule;
    if (!finalNextWeekSchedule) {
      console.log(`Submitting form for Next Week: ${nextMonday}, Location: ${loc}`);
      await submitMindbodyForm(page, nextMonday, loc);
      const html = await page.content();
      finalNextWeekSchedule = parseSchedule(html);
      console.log(`Parsed ${finalNextWeekSchedule.length} classes for week of ${nextMonday}`);
      
      scheduleCache[cacheKey2] = {
        schedule: finalNextWeekSchedule,
        fetchedAt: Date.now()
      };
      console.log(`💾 Saved schedule to cache key: ${cacheKey2}`);
    } else {
      console.log(`⚡ Using cached schedule for next week: ${cacheKey2}`);
    }

    // 3. Fetch Third Week (if not cached)
    let finalThirdWeekSchedule = thirdWeekSchedule;
    if (!finalThirdWeekSchedule) {
      console.log(`Submitting form for Third Week: ${thirdMonday}, Location: ${loc}`);
      await submitMindbodyForm(page, thirdMonday, loc);
      const html = await page.content();
      finalThirdWeekSchedule = parseSchedule(html);
      console.log(`Parsed ${finalThirdWeekSchedule.length} classes for week of ${thirdMonday}`);
      
      scheduleCache[cacheKey3] = {
        schedule: finalThirdWeekSchedule,
        fetchedAt: Date.now()
      };
      console.log(`💾 Saved schedule to cache key: ${cacheKey3}`);
    } else {
      console.log(`⚡ Using cached schedule for third week: ${cacheKey3}`);
    }

    try {
      if (fs.existsSync(artifactsDir)) {
        await page.screenshot({ path: path.join(artifactsDir, 'screenshot_after_query.png'), fullPage: true });
        const debugHtml = await page.content();
        fs.writeFileSync(path.join(artifactsDir, 'debug_after_query.html'), debugHtml);
        console.log('📸 Debug screenshot and HTML saved after query navigation.');
      }
    } catch (debugErr: any) {
      console.log('Failed to save debug artifacts after query:', debugErr.message);
    }

    return res.json({ 
      success: true, 
      date, 
      locationId: loc, 
      schedule: [...finalThisWeekSchedule, ...finalNextWeekSchedule, ...finalThirdWeekSchedule],
      fromCache: false 
    });

  } catch (error: any) {
    console.error('Error fetching schedule:', error);
    const artifactsDir = '/Users/tiffanfchen/.gemini/antigravity-cli/brain/269670d7-a4c8-4dcb-8a68-af0519cc954e';
    if (page) {
      try {
        await page.screenshot({ path: path.join(artifactsDir, 'screenshot_error.png'), fullPage: true });
        const errHtml = await page.content();
        fs.writeFileSync(path.join(artifactsDir, 'debug_error.html'), errHtml);
        console.log('📸 Saved error screenshot and HTML.');
      } catch (err: any) {
        console.log('Failed to save error artifacts:', err.message);
      }
    }
    return res.status(500).json({ error: error.message });
  } finally {
    if (page) {
      await page.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Fun Fitness Backend API running on http://localhost:${PORT}`);
});

async function cleanup() {
  console.log('Cleaning up Puppeteer browser instance...');
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log('Browser closed successfully.');
    } catch (e) {
      console.log('Error closing browser during cleanup:', e);
    }
  }
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGUSR2', async () => {
  await cleanup();
  process.exit(0);
});
