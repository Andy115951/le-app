import { addDays, toLocalDateTime, type MealType } from "./domain";

export function initialRecordTime({ existingTime, selectedDay, timezone, now = new Date() }: {
  existingTime?: string;
  selectedDay?: string;
  timezone: string;
  now?: Date;
}): string {
  if (existingTime) return toLocalDateTime(existingTime, timezone);
  const localNow = toLocalDateTime(now, timezone);
  if (!selectedDay) return localNow;
  // Validate the calendar date without interpreting it in the host timezone.
  addDays(selectedDay, 0);
  return `${selectedDay}T${localNow.slice(11)}`;
}

/** A convenience for meal logging, never an inference about measurement context. */
export function suggestMealType(localTime: string): MealType {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})$/.exec(localTime);
  if (!match || +match[1] > 23 || +match[2] > 59) throw new Error("请选择完整的日期和时间");
  addDays(localTime.slice(0, 10), 0);
  const hour = +match[1];
  return hour >= 5 && hour < 11 ? "breakfast" : hour >= 11 && hour < 16 ? "lunch" : hour >= 16 && hour < 22 ? "dinner" : "snack";
}
