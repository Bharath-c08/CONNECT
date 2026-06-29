/**
 * Resolves the scheduled time (like '09:00' or '17:00') on the same calendar day as `baseDate`
 * in the user's `timeZone` to a UTC Date object.
 *
 * @param {Date} baseDate - The relative date to determine year, month, and day in timezone
 * @param {string} timeStr - Time string formatted as "HH:MM"
 * @param {string} timeZone - IANA timezone identifier (e.g. 'Asia/Kolkata')
 * @returns {Date} UTC Date corresponding to the local time on the baseDate's calendar day
 */
export function getShiftTimeInUTC(baseDate, timeStr, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(baseDate);
  const partsMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  const year = partsMap.year;
  const month = partsMap.month;
  const day = partsMap.day;
  
  const [hrs, mins] = timeStr.split(':').map(Number);
  
  const pad = (n) => String(n).padStart(2, '0');
  const targetLocalStr = `${year}-${month}-${day}T${pad(hrs)}:${pad(mins)}:00`;
  
  const targetUtcDate = new Date(`${targetLocalStr}Z`);
  
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });
  
  const tzParts = tzFormatter.formatToParts(targetUtcDate);
  const tzPartsMap = Object.fromEntries(tzParts.map(p => [p.type, p.value]));
  
  const targetLocalVal = new Date(`${year}-${month}-${day}T${pad(hrs)}:${pad(mins)}:00Z`).getTime();
  
  const tzHour = Number(tzPartsMap.hour) % 24;
  const tzVal = new Date(`${tzPartsMap.year}-${tzPartsMap.month}-${tzPartsMap.day}T${pad(tzHour)}:${pad(tzPartsMap.minute)}:${pad(tzPartsMap.second)}Z`).getTime();
  
  const offsetMs = tzVal - targetUtcDate.getTime();
  
  return new Date(targetLocalVal - offsetMs);
}

/**
 * Gets the start of the calendar day (00:00:00.000) for a given instant and timezone in UTC.
 */
export function getStartOfDayInUTC(baseDate, timeZone) {
  return getShiftTimeInUTC(baseDate, '00:00', timeZone);
}

/**
 * Gets the end of the calendar day (23:59:59.999) for a given instant and timezone in UTC.
 */
export function getEndOfDayInUTC(baseDate, timeZone) {
  const tomorrow = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStart = getStartOfDayInUTC(tomorrow, timeZone);
  return new Date(tomorrowStart.getTime() - 1);
}
