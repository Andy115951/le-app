type TimedEntry = { started_at: string; duration_seconds: number };

export type DashboardBucket = { label: string; sec: number; startSec: number };

// Use the same rolling range as the total, including partial first/last hours
// or days. Calendar day boundaries also account for daylight saving changes.
export function buildDashboardBuckets(
  entries: TimedEntry[],
  rangeStartSec: number,
  rangeEndSec: number,
  hourly: boolean
): DashboardBucket[] {
  const bounds: Array<DashboardBucket & { endSec: number }> = [];
  const cursor = new Date(rangeStartSec * 1000);
  if (hourly) cursor.setMinutes(0, 0, 0);
  else cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() / 1000 < rangeEndSec) {
    const next = new Date(cursor);
    if (hourly) next.setTime(next.getTime() + 3600 * 1000);
    else next.setDate(next.getDate() + 1);
    bounds.push({
      label: hourly
        ? `${String(cursor.getHours()).padStart(2, "0")}:00`
        : `${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
      startSec: cursor.getTime() / 1000,
      endSec: next.getTime() / 1000,
      sec: 0
    });
    cursor.setTime(next.getTime());
  }

  for (const entry of entries) {
    const from = Math.floor(new Date(entry.started_at).getTime() / 1000);
    const to = from + Math.max(0, Math.floor(entry.duration_seconds));
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    for (const bucket of bounds) {
      bucket.sec += Math.max(0,
        Math.min(to, bucket.endSec, rangeEndSec) - Math.max(from, bucket.startSec, rangeStartSec)
      );
    }
  }
  return bounds.map(({ endSec: _endSec, ...bucket }) => bucket);
}
