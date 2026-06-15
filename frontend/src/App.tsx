import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

const rawApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_BASE_URL = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;

interface ClassScheduleItem {
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
  isRegistered: boolean;
  bookButtonText: string | null;
  bookingUrl: string | null;
  requiresTwoCredits: boolean;
}

function parseClassDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    const [y, m, d] = dateStr.split('/').map(Number);
    let cleanTime = timeStr.replace(' CST', '').trim();
    const isPM = cleanTime.includes('下午');
    const isAM = cleanTime.includes('上午');
    
    cleanTime = cleanTime.replace('上午', '').replace('下午', '').trim();
    const [hrs, mins] = cleanTime.split(':').map(Number);
    
    let hours = hrs;
    if (isPM && hours < 12) {
      hours += 12;
    } else if (isAM && hours === 12) {
      hours = 0;
    }
    
    return new Date(y, m - 1, d, hours, mins);
  } catch (e) {
    console.error('Error parsing class time:', dateStr, timeStr, e);
    return null;
  }
}

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState<string>('2');
  const [selectedDate, setSelectedDate] = useState<string>(''); // Tracking active tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false); // Mobile collapse state
  
  const [schedule, setSchedule] = useState<ClassScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [dateTabs, setDateTabs] = useState<{ label: string; dateVal: string; dayNum: string; isToday: boolean }[]>([]);
  const [mondayDateVal, setMondayDateVal] = useState<string>('');

  const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];

  // Initialize date tabs (7 rolling days starting from "Today")
  useEffect(() => {
    const tabs = [];
    const today = new Date();
    
    const tYear = today.getFullYear();
    const tMonth = today.getMonth() + 1;
    const tDate = today.getDate();
    const todayStr = `${tYear}/${tMonth}/${tDate}`;
    setMondayDateVal(todayStr);

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const date = d.getDate();
      
      const dateVal = `${year}/${month}/${date}`;
      const label = daysOfWeek[d.getDay()];
      const dayNum = `${date}`;
      const isToday = i === 0;
      
      tabs.push({ 
        label: isToday ? '今' : label, 
        dateVal, 
        dayNum,
        isToday
      });
    }
    
    setDateTabs(tabs);
    setSelectedDate(tabs[0].dateVal);
  }, []);

  // Fetch full week schedule when mondayDateVal or selectedLocation changes
  useEffect(() => {
    if (mondayDateVal) {
      fetchSchedule(mondayDateVal, selectedLocation);
    }
  }, [mondayDateVal, selectedLocation]);

  const fetchSchedule = async (date: string, locId: string, forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date,
          locationId: locId,
          refresh: forceRefresh
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '無法載入課表資料');
      }
      setSchedule(data.schedule || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '無法連接伺服器，請確認後端是否運作中。');
    } finally {
      setLoading(false);
    }
  };

  // Scroll to targeted date section smoothly
  const scrollToDate = (dateVal: string) => {
    setSelectedDate(dateVal);
    const element = document.getElementById(`date-section-${dateVal}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Intersection Observer for scroll tracking
  useEffect(() => {
    if (loading || schedule.length === 0 || dateTabs.length === 0) return;

    const isMobile = window.innerWidth <= 600;
    const observerOptions = {
      root: null,
      rootMargin: isMobile ? '-90px 0px -70% 0px' : '-180px 0px -60% 0px',
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const dateVal = entry.target.getAttribute('data-date');
          if (dateVal) {
            setSelectedDate(dateVal);
            // Scroll tab button into view automatically if track overflows
            const tabButton = document.getElementById(`tab-${dateVal}`);
            if (tabButton) {
              tabButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    dateTabs.forEach(tab => {
      const el = document.getElementById(`date-section-${tab.dateVal}`);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [loading, schedule, dateTabs]);

  // Extract all teachers dynamically for filtering, excluding special classes
  const teachers = Array.from(
    new Set(
      schedule
        .filter(item => {
          const isSpecialClass = item.name.includes('第二堂扣課') || 
                                 item.name.includes('第二堂') || 
                                 item.name.includes('二堂扣');
          return !isSpecialClass;
        })
        .map(c => c.teacher)
        .filter(Boolean)
    )
  );

  const handleLocationChange = (locId: string) => {
    setSelectedLocation(locId);
    setSearchQuery('');
    setSelectedTeacher('all');
    setShowFilters(false);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <h1>Fun Fitness.</h1>
          <span className="subtitle">WEEKLY SCHEDULE</span>
        </div>
        
        <div className="location-selector">
          <button 
            className={`loc-btn ${selectedLocation === '2' ? 'active' : ''}`}
            onClick={() => handleLocationChange('2')}
          >
            公館
          </button>
          <button 
            className={`loc-btn ${selectedLocation === '1' ? 'active' : ''}`}
            onClick={() => handleLocationChange('1')}
          >
            士林
          </button>

          <button 
            className="btn-sync-icon" 
            onClick={() => fetchSchedule(mondayDateVal, selectedLocation, true)}
            disabled={loading}
            title="同步課表"
          >
            <svg className={loading ? 'spinning' : ''} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Sticky Navigation & Search Panel */}
      <section className="sticky-controls">
        {/* Date Tabs */}
        <div className="date-tabs-bar">
          <div className="date-tabs-track">
            {dateTabs.map((tab) => (
              <button
                key={tab.dateVal}
                id={`tab-${tab.dateVal}`}
                className={`date-tab-btn ${selectedDate === tab.dateVal ? 'active' : ''} ${tab.isToday ? 'today' : ''}`}
                onClick={() => scrollToDate(tab.dateVal)}
              >
                <span className="day-label">{tab.label}</span>
                <span className="day-number">{tab.dayNum}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Filter Toggle Toggle Row */}
        <div className="mobile-filter-toggle-row">
          <button 
            className={`btn-filter-toggle ${showFilters ? 'active' : ''}`} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>{showFilters ? '收起搜尋篩選' : '搜尋與師資篩選'}</span>
            {(searchQuery || selectedTeacher !== 'all') && (
              <span className="filter-active-dot"></span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        <div className={`filters-row ${showFilters ? 'mobile-show' : 'mobile-hide'}`}>
          <div className="search-input-wrapper">
            <input 
              type="text" 
              placeholder="搜尋課程或教師..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              value={selectedTeacher} 
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              <option value="all">所有師資</option>
              {teachers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="schedule-main">
        {loading ? (
          <div className="skeleton-list">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="skeleton-card">
                <div className="skeleton-time"></div>
                <div className="skeleton-info">
                  <div className="skeleton-title"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="error-state">
            <p className="error-desc">{error}</p>
            <button className="btn-retry" onClick={() => fetchSchedule(mondayDateVal, selectedLocation)}>
              重新載入
            </button>
          </div>
        ) : (
          <div className="weekly-schedule-list">
            {dateTabs.map(tab => {
              // Filter classes for this day
              const dayClasses = schedule.filter(item => item.date === tab.dateVal);
              
              // Apply search, teacher filters, and exclude "-第二堂扣課" sessions
              const filteredDayClasses = dayClasses.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      item.teacher.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesTeacher = selectedTeacher === 'all' || item.teacher === selectedTeacher;
                
                // Exclude special classes ending with or containing "-第二堂扣課", "第二堂扣課", "第二堂"
                const isSpecialClass = item.name.includes('第二堂扣課') || 
                                       item.name.includes('第二堂') || 
                                       item.name.includes('二堂扣');
                
                return matchesSearch && matchesTeacher && !isSpecialClass;
              });

              // Format date display (e.g., "星期一 6月15日")
              const displayDateLabel = tab.label === '今' 
                ? `星期${daysOfWeek[new Date().getDay()]}` 
                : `星期${tab.label}`;

              return (
                <section 
                  key={tab.dateVal}
                  id={`date-section-${tab.dateVal}`}
                  data-date={tab.dateVal}
                  className={`date-section ${tab.isToday ? 'is-today' : ''}`}
                >
                  <div className="date-section-header">
                    <div className="date-info">
                      <h2>{tab.dayNum}</h2>
                      <div className="date-meta">
                        <span className="day-name">{displayDateLabel}</span>
                        <span className="date-full">{tab.dateVal}</span>
                      </div>
                      {tab.isToday && <span className="today-badge">TODAY</span>}
                    </div>
                  </div>

                  <div className="date-section-content">
                    {filteredDayClasses.length === 0 ? (
                      <div className="empty-day-state">
                        <p>{dayClasses.length === 0 ? '無排定課程' : '無符合條件的課程'}</p>
                      </div>
                    ) : (
                      <div className="class-cards-list">
                        {filteredDayClasses.map((item, idx) => {
                          const uniqueId = item.classId || `${tab.dateVal}-${idx}`;
                          
                          // Capacity checking
                          let isFull = false;
                          if (item.bookButtonText) {
                            const txt = item.bookButtonText.toLowerCase();
                            if (txt.includes('滿') || txt.includes('full') || txt.includes('wait')) {
                              isFull = true;
                            }
                          }

                          // Past class checking
                          const classDateTime = parseClassDateTime(item.date, item.time);
                          const isPast = classDateTime ? classDateTime < new Date() : false;

                          return (
                            <div key={uniqueId} className={`class-row-card ${isFull ? 'is-full' : ''} ${isPast ? 'is-past' : ''}`}>
                              {/* Left column: Time and duration */}
                              <div className="class-row-left">
                                <div className="time-block">
                                  <span className="start-time">
                                    {item.time.replace(' CST', '').replace('上午 ', '').replace('下午 ', '')}
                                  </span>
                                  <span className="ampm">{item.time.includes('上午') ? 'AM' : 'PM'}</span>
                                </div>
                                <span className="divider-dot">·</span>
                                <span className="duration">
                                  {item.duration
                                    .replace(/hours?/gi, 'h')
                                    .replace(/小時/g, '')
                                    .replace(/minutes?/gi, 'm')
                                    .replace(/\s+/g, '')}
                                </span>
                              </div>

                              {/* Right column: Info details and labels */}
                              <div className="class-row-right-container">
                                <div className="class-row-main">
                                  <h3 className="class-title">{item.name}</h3>
                                  <span className="class-slash">/</span>
                                  <span className="class-instructor">{item.teacher.replace(' .', '')}</span>
                                </div>

                                <div className="class-row-labels">
                                  {item.requiresTwoCredits && (
                                    <span className="label-badge double-credit">扣兩堂</span>
                                  )}
                                  {isFull && (
                                    <span className="label-badge full-booked">已滿</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
      <Analytics />
    </div>
  );
}
