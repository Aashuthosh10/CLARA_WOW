// Timetable Command Parser
// Parses natural language commands related to timetable updates

export interface TimetableUpdateCommand {
  action: 'mark_busy' | 'mark_free' | 'add_class' | 'remove_class' | 'query';
  day?: string; // Monday, Tuesday, etc. or "today", "tomorrow"
  time?: string; // "2pm", "14:00", "2:00 PM", etc.
  timeSlot?: string; // Exact time slot like "02:10-03:05"
  subject?: string;
  batch?: string;
  classType?: 'Theory' | 'Lab' | 'Free';
  error?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREVIATIONS: { [key: string]: string } = {
  'mon': 'Monday',
  'tue': 'Tuesday',
  'wed': 'Wednesday',
  'thu': 'Thursday',
  'fri': 'Friday',
  'sat': 'Saturday',
  'sun': 'Sunday',
};

// Time slots from the timetable
const TIME_SLOTS = [
  "08:30-09:25", "09:25-10:20", "10:20-10:40", "10:40-11:35", "11:35-12:30",
  "12:30-01:15", "01:15-02:10", "02:10-03:05", "03:05-04:10"
];

/**
 * Get current day of week
 */
function getToday(): string {
  const today = new Date().toLocaleString("en-IN", { weekday: "long" });
  return today;
}

/**
 * Get day name for "tomorrow"
 */
function getTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleString("en-IN", { weekday: "long" });
}

/**
 * Normalize day name (handles "today", "tomorrow", abbreviations)
 */
function normalizeDay(dayInput: string): string | null {
  const lower = dayInput.toLowerCase().trim();
  
  if (lower === 'today') {
    return getToday();
  }
  if (lower === 'tomorrow') {
    return getTomorrow();
  }
  
  // Check full day names
  for (const day of DAYS) {
    if (day.toLowerCase() === lower) {
      return day;
    }
  }
  
  // Check abbreviations
  if (DAY_ABBREVIATIONS[lower]) {
    return DAY_ABBREVIATIONS[lower];
  }
  
  return null;
}

/**
 * Parse time string and find matching time slot
 * Handles formats like: "2pm", "2:00 PM", "14:00", "2", "14", "2 pm"
 */
function parseTimeAndFindSlot(timeInput: string): string | null {
  const normalized = timeInput.toLowerCase().trim();
  
  // Remove common words
  let timeStr = normalized.replace(/at|around|about|by|before|after/g, '').trim();
  
  // Handle 12-hour format with am/pm
  let hour: number | null = null;
  let minute = 0;
  
  // Try to match patterns more flexibly
  // Pattern 1: "2 pm", "2pm", "2:30 pm"
  let pmMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*pm/);
  if (pmMatch) {
    hour = parseInt(pmMatch[1]);
    if (hour !== 12) hour += 12; // Convert to 24-hour (2pm -> 14:00)
    if (pmMatch[2]) minute = parseInt(pmMatch[2]);
  } else {
    // Pattern 2: "2 am", "2am", "2:30 am"
    let amMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*am/);
    if (amMatch) {
      hour = parseInt(amMatch[1]);
      if (hour === 12) hour = 0; // 12am = 0:00
      if (amMatch[2]) minute = parseInt(amMatch[2]);
    } else {
      // Pattern 3: "14:00", "02:30" (24-hour format)
      let timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        hour = parseInt(timeMatch[1]);
        minute = parseInt(timeMatch[2]);
        // If hour is 1-7 and no am/pm, might be PM (e.g., "2:00" could mean 2pm)
        if (hour >= 1 && hour <= 7 && !timeStr.includes('am') && !timeStr.includes('pm')) {
          // Assume it's PM unless explicitly AM
          hour += 12;
        }
      } else {
        // Pattern 4: Just a number "2", "14"
        let numMatch = timeStr.match(/^(\d{1,2})$/);
        if (numMatch) {
          hour = parseInt(numMatch[1]);
          // If hour is 1-7, assume PM (2 -> 14:00)
          if (hour >= 1 && hour <= 7) {
            hour += 12;
          }
        }
      }
    }
  }
  
  if (hour === null || hour < 0 || hour >= 24) {
    console.warn(`Could not parse hour from time input: "${timeInput}"`);
    return null;
  }
  
  // Format to HH:MM
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  console.log(`Parsed time "${timeInput}" to "${timeString}"`);
  
  // Convert input time to minutes for accurate comparison
  const inputMinutes = hour * 60 + minute;
  
  // Find matching time slot
  console.log(`🔍 Searching for time slot matching "${timeString}" (${inputMinutes} minutes)`);
  console.log(`Available time slots:`, TIME_SLOTS);
  
  for (const slot of TIME_SLOTS) {
    const [start, end] = slot.split('-');
    
    // Convert slot times to minutes for numeric comparison
    // Time slots use 12-hour format notation but represent 24-hour times:
    // Morning: "08:30-09:25" = 8:30 AM to 9:25 AM (08:30 to 09:25)
    // Afternoon: "12:30-01:15" = 12:30 PM to 1:15 PM (12:30 to 13:15)
    // Afternoon: "01:15-02:10" = 1:15 PM to 2:10 PM (13:15 to 14:10)
    // Afternoon: "02:10-03:05" = 2:10 PM to 3:05 PM (14:10 to 15:05)
    // Afternoon: "03:05-04:10" = 3:05 PM to 4:10 PM (15:05 to 16:10)
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    // Convert to 24-hour format minutes
    // Rule: 
    // - Hours 08-11 are AM (08:xx to 11:xx)
    // - Hour 12 is PM (12:xx)
    // - Hours 01-04 in slots after "12:30-01:15" are PM (01:xx = 13:xx, 02:xx = 14:xx, etc.)
    const slotIndex = TIME_SLOTS.indexOf(slot);
    const isAfternoonSlot = slotIndex >= 5; // Slots from "12:30-01:15" onwards are afternoon
    
    const convertTo24Hour = (hour: number, minute: number): number => {
      if (hour === 12) {
        return 12 * 60 + minute; // 12:xx PM
      } else if (hour >= 1 && hour <= 4 && isAfternoonSlot) {
        return (hour + 12) * 60 + minute; // 01-04 PM = 13-16 (in afternoon slots)
      } else if (hour >= 8 && hour <= 11) {
        return hour * 60 + minute; // 08-11 AM
      } else {
        // Default: assume it's already in 24-hour format or handle edge cases
        return hour * 60 + minute;
      }
    };
    
    const startMinutes = convertTo24Hour(startH, startM);
    const endMinutes = convertTo24Hour(endH, endM);
    
    console.log(`  Checking slot "${slot}": ${start} (${startMinutes} min) - ${end} (${endMinutes} min)`);
    
    let actualEndMinutes = endMinutes;
    
    // Check if time falls within the slot (using numeric comparison)
    if (inputMinutes >= startMinutes && inputMinutes < actualEndMinutes) {
      console.log(`✅ Time "${timeString}" (${inputMinutes} min) matches slot "${slot}" (${startMinutes}-${actualEndMinutes} min)`);
      return slot;
    }
    
    // Also check if time is close to start (within 30 minutes)
    // For next-day slots, check both current day and next day
    const diff1 = Math.abs(inputMinutes - startMinutes);
    const diff2 = endMinutes < startMinutes ? Math.abs(inputMinutes - (endMinutes + 24 * 60)) : Infinity;
    const diff = Math.min(diff1, diff2);
    
    if (diff <= 30) {
      console.log(`✅ Time "${timeString}" is close to slot "${slot}" start (${diff} min difference)`);
      return slot;
    }
  }
  
  console.warn(`❌ No matching time slot found for "${timeString}" (${inputMinutes} minutes)`);
  console.warn(`   Input time: ${hour}:${minute.toString().padStart(2, '0')} (${inputMinutes} minutes from midnight)`);
  return null;
}

/**
 * Parse natural language command for timetable updates
 */
export function parseTimetableCommand(text: string): TimetableUpdateCommand {
  const lower = text.toLowerCase().trim();
  
  // Detect action type - handle English, transliterated Hindi, and Devanagari script
  // Hindi words: "बिजी" (busy), "मार्क" (mark), "मी" (me)
  // Unicode ranges for Devanagari: \u0900-\u097F
  
  // Check for Devanagari script Hindi
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  
  // Hindi Devanagari patterns - using Unicode ranges for better matching
  // "बिजी" can be written in different ways, so we check for "ब" + "िज" + vowel
  const devanagariBusyPatterns = [
    /[बभ][िई][जज][ीिई]?/u,  // "बिजी", "भिजी", "बिजि" (busy) - flexible vowel matching
    /[मम][ाा][रर][कक].*[बभ][िई][जज][ीिई]?/u,  // "मार्क ... बिजी" (mark ... busy)
    /[बभ][िई][जज][ीिई]?.*[पप][ेर][रर]?/u,  // "बिजी पर" or "बिजी पे" (busy at)
    /[बभ][िई][जज][ीिई]?.*[एए][टट]/u,  // "बिजी एट" (busy at)
    /[मम][ीी]?.*[बभ][िई][जज][ीिई]?/u,  // "मी बिजी" (me busy)
  ];
  
  // Also check for Roman transliteration that might be mixed with Devanagari
  const mixedBusyPatterns = [
    /(?:mark|मार्क).*(?:me|मी).*(?:busy|बिजी)/i,
    /(?:busy|बिजी).*(?:at|एट|पर)/i,
  ];
  
  // English and transliterated patterns
  const busyPatterns = [
    /(?:i'?m|i am|i will be|will be|am|are|main|hum)\s+(?:busy|occupied|unavailable|not available|engaged|biji|bizi)/i,
    /(?:busy|occupied|unavailable|not available|engaged|biji|bizi)\s+(?:at|from|during|pe|par)/i,
    /mark.*busy/i,
    /set.*busy/i,
    /\bbusy\b/i,
    /\bbiji\b/i,
    /\bbizi\b/i,
  ];
  
  const freePatterns = [
    /(?:i'?m|i am|i will be|will be|am|are|main|hum)\s+(?:free|available)/i,
    /(?:free|available)\s+(?:at|from|during|pe|par)/i,
    /mark.*free/i,
    /set.*free/i,
    /clear.*slot/i,
  ];
  
  // Check both Devanagari and English patterns
  const isBusyDevanagari = hasDevanagari && devanagariBusyPatterns.some(pattern => {
    try {
      return pattern.test(text);
    } catch (e) {
      console.warn('Pattern test error:', e);
      return false;
    }
  });
  const isBusyMixed = mixedBusyPatterns.some(pattern => pattern.test(text));
  const isBusyEnglish = busyPatterns.some(pattern => pattern.test(text));
  const isBusy = isBusyDevanagari || isBusyMixed || isBusyEnglish;
  const isFree = freePatterns.some(pattern => pattern.test(text));
  
  console.log('Action detection:', { 
    text, 
    hasDevanagari, 
    isBusyDevanagari, 
    isBusyMixed,
    isBusyEnglish, 
    isBusy, 
    isFree, 
    lower 
  });
  
  // Fallback: If text contains "mark" and numbers that look like time, assume it's a busy command
  let forceBusy = false;
  if (!isBusy && !isFree && hasDevanagari) {
    const hasMark = /[मम][ाा]?[रर][कक]|mark/i.test(text);
    const hasTimeLikeNumber = /\d{1,3}\s*(?:पी[एे]?[मम]|PM|pm)/i.test(text);
    if (hasMark && hasTimeLikeNumber) {
      console.log('Fallback: Detecting busy command from "mark" + time pattern');
      forceBusy = true;
    }
  }
  
  let action: TimetableUpdateCommand['action'] = 'query';
  if (isBusy || forceBusy) {
    action = 'mark_busy';
  } else if (isFree) {
    action = 'mark_free';
  }
  
  // Extract day - handle English, transliterated Hindi, and Devanagari script
  let day: string | null = null;
  
  // Devanagari patterns for days
  const devanagariDayPatterns = [
    { pattern: /आज|अ[जज]्[जज]|आज[ीह]?/i, value: 'today' },  // "आज" (today)
    { pattern: /कल/i, value: 'tomorrow' },  // "कल" (tomorrow)
  ];
  
  // Check Devanagari first if text contains Devanagari
  if (hasDevanagari) {
    for (const { pattern, value } of devanagariDayPatterns) {
      if (pattern.test(text)) {
        day = normalizeDay(value);
        if (day) break;
      }
    }
  }
  
  // If not found in Devanagari, try English/transliterated
  if (!day) {
    const dayPattern = new RegExp(`\\b(${DAYS.join('|')}|today|tomorrow|aaj|kal|mon|tue|wed|thu|fri|sat|sun)\\b`, 'i');
    const dayMatch = text.match(dayPattern);
    if (dayMatch) {
      let matchedDay = dayMatch[1].toLowerCase();
      // Handle Hindi transliterations
      if (matchedDay === 'aaj') matchedDay = 'today';
      if (matchedDay === 'kal') matchedDay = 'tomorrow';
      day = normalizeDay(matchedDay) || null;
    }
  }
  
  // If no day specified but action is busy/free, assume "today"
  if (!day && (isBusy || isFree)) {
    day = getToday();
    console.log('No day specified, defaulting to today:', day);
  }
  
  // Extract time - improved patterns to catch "2 pm", "2pm", "14:00", "2:10:00 PM", etc.
  // Also handle Devanagari script: "पीएम" (PM), "एएम" (AM), numbers in Hindi/English mix
  // Order matters: more specific patterns first (with seconds, with AM/PM)
  
  // Devanagari PM/AM patterns
  const devanagariPMPattern = /(?:पी[एे]?[मम]|पी\.?[एे]?[मम]\.?|PM|pm)/i;
  const devanagariAMPattern = /(?:ए[एे]?[मम]|ए\.?[एे]?[मम]\.?|AM|am)/i;
  
  // Replace Devanagari PM/AM with English equivalents for easier parsing
  let textForTimeParsing = text
    .replace(/पी[एे]?[मम]|पी\.?[एे]?[मम]\.?/gi, 'PM')
    .replace(/ए[एे]?[मम]|ए\.?[एे]?[मम]\.?/gi, 'AM');
  
  const timePatterns = [
    /\b(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)\b/i,  // "2:10:00 PM" - most specific with seconds
    /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i,          // "2:30 pm" - with minutes and AM/PM
    /\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)\b/i,     // "at 2:30 pm"
    /\b(\d{1,2})\s*(am|pm)\b/i,                  // "2 pm" - hour only with AM/PM
    /\bat\s+(\d{1,2})\s*(am|pm)\b/i,             // "at 2 pm"
    /\b(\d{3})\s*(am|pm)\b/i,                    // "210 PM" (like "210 पीएम") -> "2:10 PM"
    /\b(\d{1,3})\s*(पी[एे]?[मम]|पी\.?[एे]?[मम]\.?|PM|pm)\b/i,  // "210 पीएम" -> "2:10 PM" (capturing group)
    /\b(\d{1,3})\s*(ए[एे]?[मम]|ए\.?[एे]?[मम]\.?|AM|am)\b/i,   // "210 एएम" -> "2:10 AM" (capturing group)
    /\b(\d{2}):(\d{2})\b/,                       // "14:00", "02:30" - 24-hour format
    /\b(\d{1,2}):(\d{2})\b/,                     // "2:30" - might be PM if hour < 8
    /\b(\d{1,2})\s*(?:o'?clock|oclock)\b/i,      // "2 oclock"
  ];
  
  let timeSlot: string | null = null;
  for (let i = 0; i < timePatterns.length; i++) {
    const pattern = timePatterns[i];
    const match = textForTimeParsing.match(pattern);
    if (match) {
      let timeInput = '';
      
      // Pattern 0: "2:10:00 PM" -> match[1]=2, match[2]=10, match[3]=00, match[4]=PM
      if (i === 0 && match[1] && match[2] && match[4]) {
        timeInput = `${match[1]}:${match[2]} ${match[4]}`;
      }
      // Pattern 1: "2:30 pm" -> match[1]=2, match[2]=30, match[3]=pm
      else if (i === 1 && match[1] && match[2] && match[3]) {
        timeInput = `${match[1]}:${match[2]} ${match[3]}`;
      }
      // Pattern 2: "at 2:30 pm" -> match[1]=2, match[2]=30, match[3]=pm
      else if (i === 2 && match[1] && match[2] && match[3]) {
        timeInput = `${match[1]}:${match[2]} ${match[3]}`;
      }
      // Pattern 3: "2 pm" -> match[1]=2, match[2]=pm
      else if (i === 3 && match[1] && match[2]) {
        timeInput = `${match[1]} ${match[2]}`;
      }
      // Pattern 4: "at 2 pm" -> match[1]=2, match[2]=pm
      else if (i === 4 && match[1] && match[2]) {
        timeInput = `${match[1]} ${match[2]}`;
      }
      // Pattern 5: "210 PM" format (from Hindi "210 पीएम")
      else if (i === 5 && match[1] && match[2]) {
        // Convert "210 PM" to "2:10 PM"
        const timeStr = match[1];
        if (timeStr.length === 3) {
          // "210" -> "2:10"
          const hour = timeStr.substring(0, 1);
          const minute = timeStr.substring(1, 3);
          timeInput = `${hour}:${minute} ${match[2]}`;
        } else {
          timeInput = `${match[1]} ${match[2]}`;
        }
      }
      // Pattern 6: "210 पीएम" format (Devanagari PM) - pattern index 6
      else if (i === 6 && match[1] && match[2]) {
        const timeStr = match[1];
        // match[2] contains PM/पीएम indicator
        const ampmIndicator = match[2].toLowerCase();
        const ampm = (ampmIndicator.includes('पी') || ampmIndicator.includes('pm')) ? 'PM' : 'AM';
        
        if (timeStr.length === 3) {
          // "210" -> "2:10"
          const hour = parseInt(timeStr.substring(0, 1));
          const minute = timeStr.substring(1, 3);
          timeInput = `${hour}:${minute} ${ampm}`;
        } else if (timeStr.length === 2) {
          // "21" -> "2:1" -> "2:01"
          const hour = parseInt(timeStr.substring(0, 1));
          const minute = timeStr.substring(1, 2).padStart(2, '0');
          timeInput = `${hour}:${minute} ${ampm}`;
        } else {
          timeInput = `${timeStr} ${ampm}`;
        }
      }
      // Pattern 7: Similar handling for AM - pattern index 7
      else if (i === 7 && match[1] && match[2]) {
        const timeStr = match[1];
        // match[2] contains AM/एएम indicator
        const ampm = 'AM';
        
        if (timeStr.length === 3) {
          const hour = parseInt(timeStr.substring(0, 1));
          const minute = timeStr.substring(1, 3);
          timeInput = `${hour}:${minute} ${ampm}`;
        } else if (timeStr.length === 2) {
          const hour = parseInt(timeStr.substring(0, 1));
          const minute = timeStr.substring(1, 2).padStart(2, '0');
          timeInput = `${hour}:${minute} ${ampm}`;
        } else {
          timeInput = `${timeStr} ${ampm}`;
        }
      }
      // Pattern 8+: Just use the matched text, clean it up
      else {
        timeInput = match[0].replace(/^at\s+/i, '').trim();
      }
      
      console.log(`Pattern ${i} matched: "${match[0]}" -> extracted: "${timeInput}"`);
      timeSlot = parseTimeAndFindSlot(timeInput);
      if (timeSlot) {
        console.log(`✅ Found time slot "${timeSlot}" from input "${timeInput}"`);
        break;
      }
    }
  }
  
  // If action requires time but we don't have it, try to extract from context
  if ((isBusy || isFree) && !timeSlot) {
    console.log('Time slot not found, trying fallback patterns...');
    
    // Try to find "3pm", "3 pm", "3:00pm", etc. directly in the text
    const directTimePattern = /(\d{1,2})\s*(?:pm|am|पी[एे]?[मम]|ए[एे]?[मम])/i;
    const directMatch = textForTimeParsing.match(directTimePattern);
    if (directMatch) {
      const hour = parseInt(directMatch[1]);
      const ampm = directMatch[0].toLowerCase();
      let hour24 = hour;
      if (ampm.includes('pm') || ampm.includes('पी')) {
        if (hour !== 12) hour24 = hour + 12;
      } else if (ampm.includes('am') || ampm.includes('ए')) {
        if (hour === 12) hour24 = 0;
      }
      console.log(`Direct time pattern matched: "${directMatch[0]}" -> ${hour24}:00`);
      timeSlot = parseTimeAndFindSlot(`${hour24}:00`);
      if (timeSlot) {
        console.log(`✅ Found time slot "${timeSlot}" from direct time pattern`);
      }
    }
    
    // Look for numbers that could be hours (after "at", "at today", etc.)
    // Also handle Devanagari "एट" (at)
    if (!timeSlot) {
      const contextPattern = /(?:at|today|tomorrow|on|एट|प[र]|पे)\s*(\d{1,3})(?:\s*(?:am|pm|पी[एे]?[मम]|ए[एे]?[मम]))?/i;
      const contextMatch = textForTimeParsing.match(contextPattern);
      if (contextMatch) {
        let hour = parseInt(contextMatch[1]);
        const ampm = contextMatch[2]?.toLowerCase() || contextMatch[0].toLowerCase();
        if ((ampm.includes('pm') || ampm.includes('पी')) && hour !== 12) hour += 12;
        if ((ampm.includes('am') || ampm.includes('ए')) && hour === 12) hour = 0;
        if (hour >= 8 && hour <= 18) {
          console.log(`Context pattern matched: "${contextMatch[0]}" -> ${hour}:00`);
          timeSlot = parseTimeAndFindSlot(`${hour}:00`);
          if (timeSlot) {
            console.log(`✅ Found time slot "${timeSlot}" from context pattern`);
          }
        }
      }
    }
    
    // Last resort: look for any number that could be an hour, especially with "pm" nearby
    if (!timeSlot) {
      // Try to find number + "pm" even if not directly adjacent
      const pmPattern = /(\d{1,2})\s*(?:pm|पी[एे]?[मम])/i;
      const pmMatch = textForTimeParsing.match(pmPattern);
      if (pmMatch) {
        let hour = parseInt(pmMatch[1]);
        if (hour !== 12) hour += 12;
        if (hour >= 8 && hour <= 18) {
          console.log(`PM pattern matched: "${pmMatch[0]}" -> ${hour}:00`);
          timeSlot = parseTimeAndFindSlot(`${hour}:00`);
          if (timeSlot) {
            console.log(`✅ Found time slot "${timeSlot}" from PM pattern`);
          }
        }
      }
      
      // Final fallback: any number 1-7 could be PM (1pm-7pm = 13:00-19:00)
      if (!timeSlot) {
        const numberMatch = text.match(/\b([1-7])\b/);
        if (numberMatch) {
          const num = parseInt(numberMatch[1]);
          // Assume PM if it's a small number and we're in a busy/free context
          const hour24 = num + 12; // 3 -> 15:00 (3pm)
          console.log(`Fallback number extraction: "${num}" -> ${hour24}:00 (assuming PM)`);
          timeSlot = parseTimeAndFindSlot(`${hour24}:00`);
          if (timeSlot) {
            console.log(`✅ Found time slot "${timeSlot}" from fallback number extraction`);
          }
        }
      }
    }
  }
  
  const result: TimetableUpdateCommand = {
    action,
    day: day || undefined,
    timeSlot: timeSlot || undefined,
  };
  
  // If we have an action but missing required fields, add error
  if (action !== 'query' && (!day || !timeSlot)) {
    result.error = `Could not parse command. Missing: ${!day ? 'day' : ''} ${!timeSlot ? 'time' : ''}`.trim();
  }
  
  return result;
}

/**
 * Helper to get faculty ID from user object
 */
export function getFacultyId(user: { email?: string; id?: string; name?: string }): string {
  if (user.email) {
    return user.email.split('@')[0];
  }
  if (user.id) {
    return user.id;
  }
  if (user.name) {
    return user.name.toLowerCase().replace(/\s+/g, '');
  }
  return 'unknown';
}

