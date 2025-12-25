/**
 * Cascading Draft Unlock Schedule Generator
 * 
 * Week 17 (Semifinals): 1-1-2-3-4-1-2-3-4-1-2-3-4-2-3-4 = 16 picks total
 * Week 18 (Championship): 1-2-1-2-1-2-1-2 = 8 windows, 4 picks each
 * 
 * Timing:
 * - 2-hour intervals
 * - Sleep mode: 8pm-9am PT (no overnight unlocks)
 * - Starts Monday 9am PT
 */

export type UnlockWindow = {
  seed: number;
  pickPosition: number;
  unlockTime: Date;
  windowIndex: number;
};

// Cascading draft order for Week 17 semifinals (top 4 teams)
// Order: 1-1-2-3-4 / 1-2-3-4 / 1-2-3-4 / 2-3-4
const WEEK_17_DRAFT_ORDER: [number, number][] = [
  [1, 1], // Pick 1: Seed 1, Position 1
  [1, 2], // Pick 2: Seed 1, Position 2
  [2, 1], // Pick 3: Seed 2, Position 1
  [3, 1], // Pick 4: Seed 3, Position 1
  [4, 1], // Pick 5: Seed 4, Position 1
  [1, 3], // Pick 6: Seed 1, Position 3
  [2, 2], // Pick 7: Seed 2, Position 2
  [3, 2], // Pick 8: Seed 3, Position 2
  [4, 2], // Pick 9: Seed 4, Position 2
  [1, 4], // Pick 10: Seed 1, Position 4
  [2, 3], // Pick 11: Seed 2, Position 3
  [3, 3], // Pick 12: Seed 3, Position 3
  [4, 3], // Pick 13: Seed 4, Position 3
  [2, 4], // Pick 14: Seed 2, Position 4
  [3, 4], // Pick 15: Seed 3, Position 4
  [4, 4], // Pick 16: Seed 4, Position 4
];

// Snake draft order for Week 18 championship (top 2 teams)
const WEEK_18_DRAFT_ORDER: [number, number][] = [
  [1, 1], [2, 1], [1, 2], [2, 2], 
  [1, 3], [2, 3], [1, 4], [2, 4]
];

const INTERVAL_HOURS = 2; // Changed from 3 to 2 hours
const SLEEP_START_HOUR = 20; // 8pm PT
const SLEEP_END_HOUR = 9;    // 9am PT

/**
 * Get hour in PT from a Date object
 */
function getPTHour(date: Date): number {
  // PT is UTC-8
  const utcHours = date.getUTCHours();
  return (utcHours - 8 + 24) % 24;
}

/**
 * Check if a time is during sleep hours in PT (8pm-9am)
 */
function isDuringSleepHours(date: Date): boolean {
  const ptHours = getPTHour(date);
  // Sleep hours: 20 (8pm) through 8 (8:59am)
  return ptHours >= SLEEP_START_HOUR || ptHours < SLEEP_END_HOUR;
}

/**
 * Calculate the next valid unlock time, respecting sleep hours
 */
function addHoursWithSleep(startTime: Date, hoursToAdd: number): Date {
  let result = new Date(startTime);
  result.setHours(result.getHours() + hoursToAdd);
  
  // If we land during sleep hours, jump to 9am PT
  if (isDuringSleepHours(result)) {
    // Set to next 9am PT
    const ptHour = getPTHour(result);
    
    if (ptHour >= SLEEP_START_HOUR) {
      // We're in evening (8pm-11pm), jump to tomorrow 9am
      const hoursUntilMidnight = 24 - ptHour;
      const hoursAfterMidnight = SLEEP_END_HOUR;
      result.setHours(result.getHours() + hoursUntilMidnight + hoursAfterMidnight);
    } else {
      // We're in early morning (12am-8am), jump to today 9am
      const hoursUntil9am = SLEEP_END_HOUR - ptHour;
      result.setHours(result.getHours() + hoursUntil9am);
    }
  }

  return result;
}

/**
 * Generate unlock schedule for a playoff round
 */
export function generateUnlockSchedule(
  week: 17 | 18,
  draftStartTime: Date,
  roundType: 'semifinal' | 'championship'
): UnlockWindow[] {
  const draftOrder = week === 17 ? WEEK_17_DRAFT_ORDER : WEEK_18_DRAFT_ORDER;
  const schedule: UnlockWindow[] = [];

  let currentTime = new Date(draftStartTime);

  for (let i = 0; i < draftOrder.length; i++) {
    const [seed, pickPosition] = draftOrder[i];

    schedule.push({
      seed,
      pickPosition,
      unlockTime: new Date(currentTime),
      windowIndex: i,
    });

    // Calculate next window time (except for last window)
    if (i < draftOrder.length - 1) {
      currentTime = addHoursWithSleep(currentTime, INTERVAL_HOURS);
    }
  }

  return schedule;
}

/**
 * Get unlock windows for a specific seed
 */
export function getUnlockWindowsForSeed(
  schedule: UnlockWindow[],
  seed: number
): UnlockWindow[] {
  return schedule.filter(w => w.seed === seed);
}

/**
 * Check if a pick position is currently unlocked for a seed
 */
export function isPickUnlocked(
  schedule: UnlockWindow[],
  seed: number,
  pickPosition: number,
  now: Date = new Date()
): boolean {
  const window = schedule.find(
    w => w.seed === seed && w.pickPosition === pickPosition
  );
  
  if (!window) return false;
  return now >= window.unlockTime;
}

/**
 * Get the next unlock time for a seed (if any picks still locked)
 */
export function getNextUnlockForSeed(
  schedule: UnlockWindow[],
  seed: number,
  now: Date = new Date()
): UnlockWindow | null {
  const seedWindows = getUnlockWindowsForSeed(schedule, seed);
  const nextWindow = seedWindows.find(w => w.unlockTime > now);
  return nextWindow || null;
}

/**
 * Check if all draft windows have passed (open swap period)
 */
export function isDraftComplete(
  schedule: UnlockWindow[],
  now: Date = new Date()
): boolean {
  const lastWindow = schedule[schedule.length - 1];
  return now >= lastWindow.unlockTime;
}

/**
 * Get human-readable time until unlock
 */
export function getTimeUntilUnlock(unlockTime: Date, now: Date = new Date()): string {
  const diff = unlockTime.getTime() - now.getTime();
  
  if (diff <= 0) return 'Now';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}
