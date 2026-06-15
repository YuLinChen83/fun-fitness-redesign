const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const html = fs.readFileSync(path.join(__dirname, '../raw_test_booked.html'), 'utf-8');
const $ = cheerio.load(html);

const mainTable = $('#classSchedule-mainTable');
const rows = mainTable.find('.row').toArray();

for (let idx = 0; idx < rows.length; idx++) {
  const el = $(rows[idx]);
  const col1 = el.find('.col-1');
  const col2 = el.find('.col-2');
  
  const time = col1.find('.col-first').text().trim().replace(/\s+/g, ' ');
  const detailCols = col2.find('> .col');
  const name = detailCols.eq(0).text().trim().replace(/\s+/g, ' ');
  const teacher = detailCols.eq(1).text().trim().replace(/\s+/g, ' ');
  
  if (name.includes('伸展瑜珈') || name.includes('Stretch Yoga')) {
    const bookingCol = col1.find('> div').eq(1);
    console.log(`Class: ${name} (${teacher}) at ${time}`);
    console.log(`Booking HTML:`);
    console.log(bookingCol.html());
  }
}
