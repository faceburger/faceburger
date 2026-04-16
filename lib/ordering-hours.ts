export type OrderingWindow = {
  timeZone: string;
  /** Format: "HH:MM" */
  start: string;
  /** Format: "HH:MM" */
  end: string;
};

export const DEFAULT_ORDERING_WINDOW: OrderingWindow = {
  timeZone: "Africa/Casablanca",
  start: "11:00",
  end: "03:00",
};

function parseTimeToMinutes(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return 0;
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return hh * 60 + mm;
}

export function getMinutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isWithinOrderingWindow(
  now: Date,
  window: OrderingWindow,
): { ok: boolean; nowMinutes: number; startMinutes: number; endMinutes: number } {
  const startMinutes = parseTimeToMinutes(window.start);
  const endMinutes = parseTimeToMinutes(window.end);
  const nowMinutes = getMinutesInTimeZone(now, window.timeZone);

  if (startMinutes === endMinutes) {
    return { ok: true, nowMinutes, startMinutes, endMinutes };
  }

  // Non-wrapping window, e.g. 09:00 -> 17:00
  if (startMinutes < endMinutes) {
    return {
      ok: nowMinutes >= startMinutes && nowMinutes < endMinutes,
      nowMinutes,
      startMinutes,
      endMinutes,
    };
  }

  // Wrapping window, e.g. 11:00 -> 03:00 (spans midnight)
  return {
    ok: nowMinutes >= startMinutes || nowMinutes < endMinutes,
    nowMinutes,
    startMinutes,
    endMinutes,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatWindowLabel(window: OrderingWindow) {
  const start = window.start;
  const end = window.end;
  const [sh, sm] = start.split(":").map((x) => Number(x));
  const [eh, em] = end.split(":").map((x) => Number(x));
  return `${pad2(sh)}:${pad2(sm)} – ${pad2(eh)}:${pad2(em)}`;
}

