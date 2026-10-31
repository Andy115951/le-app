// Match the ledger's supported recording dates, without device-timezone math.
export const FIRST_YEAR = 1900;
export const LAST_YEAR = 2199;
export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  const index = Math.max(
    FIRST_YEAR * 12,
    Math.min(LAST_YEAR * 12 + 11, year * 12 + number - 1 + offset),
  );
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}
export function yearPageStart(year: number): number {
  return FIRST_YEAR + Math.floor((year - FIRST_YEAR) / 12) * 12;
}
