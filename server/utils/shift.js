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
export function calculateNetWorkingMinutes(clockIn, clockOut, breakLimitOrBreaks = 0, breakLimitMap = {}) {
  // 1. Calculate total elapsed minutes (base net working time)
  const totalShiftMs = new Date(clockOut) - new Date(clockIn);
  const totalShiftMins = Math.max(0, Math.round(totalShiftMs / 60000));

  let breakLimitMinutes = 0;

  if (typeof breakLimitOrBreaks === 'number') {
    breakLimitMinutes = breakLimitOrBreaks;
  } else if (typeof breakLimitOrBreaks === 'object' && breakLimitOrBreaks !== null) {
    if (breakLimitOrBreaks.breakLimitMinutes !== undefined) {
      breakLimitMinutes = Number(breakLimitOrBreaks.breakLimitMinutes) || 0;
    } else if (Array.isArray(breakLimitOrBreaks)) {
      // Compatibility fallback
      breakLimitMinutes = 0;
    }
  }

  return Math.max(0, totalShiftMins - breakLimitMinutes);
}
