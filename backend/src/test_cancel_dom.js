const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const html = fs.readFileSync(path.join(__dirname, '../raw_my_sch.html'), 'utf-8');
const $ = cheerio.load(html);

// Target info
const targetDate = '2026/6/15';
const targetTime = '07:10';
const targetName = '伸展瑜珈';

console.log(`Searching for class: Date=${targetDate}, Time=${targetTime}, Name=${targetName}`);

let foundRow = null;

// Loop over table rows
$('tr').each((i, row) => {
  const $row = $(row);
  const text = $row.text().replace(/\s+/g, ' ');
  
  // Check if row has a cancel link
  const cancelLink = $row.find('a').filter((j, a) => {
    const aText = $(a).text().toLowerCase();
    return aText.includes('cancel') || aText.includes('取消');
  });
  
  if (cancelLink.length === 0) return;
  
  // Check date, time, name match
  const dateMatch = text.includes(targetDate);
  // Time match (supporting 07:10 or 7:10, and 下午 07:10)
  const timeMatch = text.includes(targetTime) || text.includes(targetTime.replace(/^0/, ''));
  const nameMatch = text.toLowerCase().includes(targetName.toLowerCase());
  
  if (dateMatch && timeMatch && nameMatch) {
    foundRow = {
      index: i,
      text: text.trim(),
      cancelHref: cancelLink.first().attr('href'),
      html: $row.html()?.substring(0, 300) + '...'
    };
  }
});

if (foundRow) {
  console.log('\nSUCCESS: Found matching row!');
  console.log(`Row index: ${foundRow.index}`);
  console.log(`Content: ${foundRow.text}`);
  console.log(`Cancel Href: ${foundRow.cancelHref}`);
} else {
  console.log('\nFAILED: Could not find matching row.');
}
