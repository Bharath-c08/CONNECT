/**
 * Calculates net working minutes based on clock-in, clock-out, breaks, and break limits.
 * Net working minutes is calculated purely on the basis of clock-in and clock-out (elapsed time).
 * If the total break time taken exceeds the allowed break limit, the excess duration is subtracted.
 *
 * @param {Date|string} clockIn 
 * @param {Date|string} clockOut 
 * @param {Array} breaks 
 * @param {number} breakLimitMinutes 
 * @returns {number} Net working minutes
 */
export function calculateNetWorkingMinutes(clockIn, clockOut, breaks, breakLimitMinutes) {
  let totalBreakMinutes = 0;
  if (breaks && Array.isArray(breaks)) {
    breaks.forEach((b) => {
      const ended = b.endedAt || clockOut;
      const durMs = new Date(ended) - new Date(b.startedAt);
      totalBreakMinutes += Math.round(durMs / 60000);
    });
  }

  const totalShiftMs = new Date(clockOut) - new Date(clockIn);
  const totalShiftMins = Math.max(1, Math.round(totalShiftMs / 60000));

  let netWorkingMins = totalShiftMins;

  const limit = breakLimitMinutes !== undefined ? breakLimitMinutes : 60;
  if (totalBreakMinutes > limit) {
    const extraBreakMinutes = totalBreakMinutes - limit;
    netWorkingMins = Math.max(0, netWorkingMins - extraBreakMinutes);
  }

  return netWorkingMins;
}
