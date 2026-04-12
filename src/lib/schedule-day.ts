/**
 * Haftalık program ve dağıtım gün anahtarı: "0"=Pazar … "6"=Cumartesi.
 * Vercel sunucusu UTC kullandığı için getDay() ile tarayıcı (TR) farklı güne düşebilir;
 * tek zaman diliminde hesaplamak gerekir.
 */

function resolveScheduleTimeZone(): string {
  if (typeof process !== "undefined" && process.env) {
    return (
      process.env.NEXT_PUBLIC_ROTA_SCHEDULE_TIMEZONE ||
      process.env.ROTA_SCHEDULE_TIMEZONE ||
      "Europe/Istanbul"
    );
  }
  return "Europe/Istanbul";
}

const WEEKDAY_TO_KEY: Record<string, string> = {
  Sunday: "0",
  Monday: "1",
  Tuesday: "2",
  Wednesday: "3",
  Thursday: "4",
  Friday: "5",
  Saturday: "6",
};

export function getScheduleDayKey(date: Date = new Date(), timeZone: string = resolveScheduleTimeZone()): string {
  const long = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);
  return WEEKDAY_TO_KEY[long] ?? String(date.getDay());
}
