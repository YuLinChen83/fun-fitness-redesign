import * as cheerio from 'cheerio';

export interface ClassScheduleItem {
  date: string;
  dateRaw: string;
  time: string;
  name: string;
  teacher: string;
  location: string;
  duration: string;
  classId: string | null;
  teacherId: string | null;
  locationId: string | null;
  canBook: boolean;
  isRegistered: boolean; // Flag for already booked classes
  bookButtonText: string | null;
  bookingUrl: string | null;
  bookingParams: Record<string, string> | null;
  requiresTwoCredits: boolean; // Flag for double credit classes
}

export function parseSchedule(html: string): ClassScheduleItem[] {
  const $ = cheerio.load(html);
  const scheduleItems: ClassScheduleItem[] = [];

  const mainTable = $('#classSchedule-mainTable');
  if (mainTable.length === 0) {
    return [];
  }

  let currentDateRaw = '';
  let currentDateStandardized = '';

  const children = mainTable.children().toArray();
  for (const element of children) {
    const el = $(element);

    // Date header
    if (el.hasClass('header')) {
      currentDateRaw = el.text().trim();
      
      const dateMatch = currentDateRaw.match(/(\d+)年(\d+)月(\d+)日/);
      if (dateMatch) {
        const [_, y, m, d] = dateMatch;
        currentDateStandardized = `${parseInt(y)}/${parseInt(m)}/${parseInt(d)}`;
      } else {
        currentDateStandardized = currentDateRaw;
      }
      continue;
    }

    // Class row
    if (el.hasClass('row')) {
      if (el.text().includes('no scheduled classes')) {
        continue;
      }

      const col1 = el.find('.col-1');
      const col2 = el.find('.col-2');

      // 1. Parse Time
      const time = col1.find('.col-first').text().trim().replace(/\s+/g, ' ');

      // 2. Parse Class Details
      const detailCols = col2.find('> .col');

      // Name & double credits checking
      const nameCol = detailCols.eq(0);
      const nameAnchor = nameCol.find('a');
      const rawName = nameAnchor.length > 0 ? nameAnchor.text().trim() : nameCol.text().trim();
      
      // Check for double credit warning pattern
      const requiresTwoCredits = rawName.includes('需扣兩堂課程') || rawName.includes('扣兩堂');
      
      // Clean name by stripping the warning message
      const name = rawName
        .replace(/⚠️需扣兩堂課程\s*,\s*預約前\s*,\s*請確認堂數足夠⚠️/g, '')
        .replace(/⚠️/g, '')
        .trim();
      
      let classId: string | null = null;
      if (nameAnchor.length > 0) {
        const nameAttr = nameAnchor.attr('name');
        if (nameAttr && nameAttr.startsWith('cid')) {
          classId = nameAttr.substring(3);
        }
      }

      // Teacher
      const teacherCol = detailCols.eq(1);
      const teacherAnchor = teacherCol.find('a');
      const teacher = teacherAnchor.length > 0 ? teacherAnchor.text().trim() : teacherCol.text().trim();
      
      let teacherId: string | null = null;
      if (teacherAnchor.length > 0) {
        const nameAttr = teacherAnchor.attr('name');
        if (nameAttr && nameAttr.startsWith('bio')) {
          teacherId = nameAttr.substring(3);
        }
      }

      // Location
      const locationCol = detailCols.eq(2);
      const locationAnchor = locationCol.find('a');
      const location = locationAnchor.length > 0 ? locationAnchor.text().trim() : locationCol.text().trim();
      
      let locationId: string | null = null;
      if (locationAnchor.length > 0) {
        const nameAttr = locationAnchor.attr('name');
        if (nameAttr && nameAttr.startsWith('loc')) {
          locationId = nameAttr.substring(3);
        }
      }

      // Duration
      const durationCol = detailCols.eq(3);
      const duration = durationCol.text().trim();

      // 3. Booking info
      const bookingCol = col1.find('> div').eq(1);
      let canBook = false;
      let isRegistered = false;
      let bookButtonText: string | null = null;
      let bookingUrl: string | null = null;
      let bookingParams: Record<string, string> | null = null;

      const bookingButton = bookingCol.find('input, button, a');
      if (bookingButton.length > 0) {
        bookButtonText = bookingButton.val() as string || bookingButton.text().trim();
        
        if (bookButtonText) {
          const lowerText = bookButtonText.toLowerCase();
          if (lowerText.includes('sign up')) {
            canBook = true;
          } else if (
            lowerText.includes('cancel') || 
            lowerText.includes('取消') || 
            lowerText.includes('registered') || 
            lowerText.includes('已約') || 
            lowerText.includes('已預約')
          ) {
            isRegistered = true;
          }
        }

        const onClickAttr = bookingButton.attr('onclick') || bookingButton.attr('onClick');
        const hrefAttr = bookingButton.attr('href');

        if (onClickAttr) {
          const match = onClickAttr.match(/promptLogin\s*\(\s*'.*?'\s*,\s*'.*?'\s*,\s*'(.*?)'\s*\)/);
          if (match && match[1]) {
            bookingUrl = match[1];
          }
        }

        if (!bookingUrl && hrefAttr && !hrefAttr.startsWith('javascript:')) {
          bookingUrl = hrefAttr;
        }

        if (bookingUrl) {
          bookingParams = {};
          const qIdx = bookingUrl.indexOf('?');
          if (qIdx !== -1) {
            const queryStr = bookingUrl.substring(qIdx + 1);
            const pairs = queryStr.split('&');
            for (const pair of pairs) {
              const [k, v] = pair.split('=');
              if (k) {
                bookingParams[k] = decodeURIComponent(v || '');
              }
            }
            if (bookingParams.classId) {
              classId = bookingParams.classId;
            }
          }
        }
      } else {
        const text = bookingCol.text().trim();
        if (text) {
          bookButtonText = text;
          const lowerText = text.toLowerCase();
          if (
            lowerText.includes('cancel') || 
            lowerText.includes('取消') || 
            lowerText.includes('registered') || 
            lowerText.includes('已約') || 
            lowerText.includes('已預約')
          ) {
            isRegistered = true;
          }
        }
      }

      // For registered classes, we build a special cancel URL that includes class details to safely cancel on my_sch.asp
      let finalBookingUrl = bookingUrl;
      if (isRegistered) {
        finalBookingUrl = `/asp/my_sch.asp?cancelClassId=${classId || ''}&cancelDate=${currentDateStandardized}&cancelTime=${time}&cancelName=${encodeURIComponent(name)}`;
      }

      scheduleItems.push({
        date: currentDateStandardized,
        dateRaw: currentDateRaw,
        time,
        name,
        teacher,
        location,
        duration,
        classId,
        teacherId,
        locationId,
        canBook,
        isRegistered,
        bookButtonText,
        bookingUrl: finalBookingUrl,
        bookingParams,
        requiresTwoCredits
      });
    }
  }

  return scheduleItems;
}
