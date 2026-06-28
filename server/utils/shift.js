/**
 * Calculates net working minutes based on clock-in, clock-out, breaks, and break limits.
 * Net working minutes is calculated purely on the basis of clock-in and clock-out (elapsed time).
 * For each break type, if the total break time taken exceeds its configured limit in breakLimitMap,
 * the excess duration is subtracted from the working minutes.
 *
 * @param {Date|string} clockIn 
 * @param {Date|string} clockOut 
 * @param {Array} breaks 
 * @param {Object} breakLimitMap Map of uppercase break type names to limits in minutes
 * @returns {number} Net working minutes
 */
export function calculateNetWorkingMinutes(clockIn, clockOut, breaks, breakLimitMap = {}) {
  // 1. Calculate actual durations grouped by breakType (case-insensitive)
  const actualBreakDurations = {};
  if (breaks && Array.isArray(breaks)) {
    breaks.forEach((b) => {
      const typeName = b.breakType.toUpperCase();
      const ended = b.endedAt || clockOut;
      const durMs = new Date(ended) - new Date(b.startedAt);
      const mins = Math.round(durMs / 60000);
      actualBreakDurations[typeName] = (actualBreakDurations[typeName] || 0) + mins;
    });
  }

  // 2. Calculate total elapsed minutes (base net working time)
  const totalShiftMs = new Date(clockOut) - new Date(clockIn);
  const totalShiftMins = Math.max(1, Math.round(totalShiftMs / 60000));

  let netWorkingMins = totalShiftMins;

  // 3. Subtract excess break durations for each break type
  let totalExtraMinutes = 0;
  for (const [typeName, actualMins] of Object.entries(actualBreakDurations)) {
    // Look up the limit for this break type. Fallback to a default of 60 if not configured.
    const limit = breakLimitMap[typeName] !== undefined ? breakLimitMap[typeName] : 60;
    if (actualMins > limit) {
      totalExtraMinutes += (actualMins - limit);
    }
  }

  netWorkingMins = Math.max(0, netWorkingMins - totalExtraMinutes);

  return netWorkingMins;
}
