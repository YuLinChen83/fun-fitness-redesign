const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const html = fs.readFileSync(path.join(__dirname, '../raw_my_sch.html'), 'utf-8');
const $ = cheerio.load(html);

// Typically Mindbody has a table with classes. Let's find all tables and print rows with cancel links
console.log('--- Tables found ---');
const tables = $('table');
console.log(`Found ${tables.length} tables.`);

// Let's search for "Cancel" or "取消" text
const cancelLinks = $('a, input, button').filter((i, el) => {
  const text = $(el).text().toLowerCase() + ' ' + ($(el).val() || '').toString().toLowerCase();
  return text.includes('cancel') || text.includes('取消');
});

console.log(`\nFound ${cancelLinks.length} potential cancel buttons/links:`);
cancelLinks.each((idx, el) => {
  const $el = $(el);
  console.log(`Link ${idx+1}:`);
  console.log(`  Tag: <${el.name}>, Value: "${$el.val()}", Text: "${$el.text().trim()}"`);
  console.log(`  href: "${$el.attr('href') || ''}", onclick: "${$el.attr('onclick') || ''}"`);
  
  // Try to find the context (parent row text)
  const parentRow = $el.closest('tr');
  if (parentRow.length > 0) {
    console.log(`  Parent Row Content: "${parentRow.text().trim().replace(/\s+/g, ' ')}"`);
  }
});
