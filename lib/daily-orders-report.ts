import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, asc, gte, lt } from "drizzle-orm";

type ReportOrderItem = {
  name: string;
  quantity: number;
  lineTotal: number;
  options?: { name: string; extraPrice?: number }[];
};

type ServiceMode = "delivery" | "pickup" | "dine_in" | "unknown";

export type DailyOrdersReport = {
  reportDateKey: string;
  reportLabel: string;
  timezone: string;
  startUtc: Date;
  endUtcExclusive: Date;
  totalOrders: number;
  totalRevenue: number;
  serviceCounts: Record<ServiceMode, number>;
  orders: Array<{
    id: number;
    createdAt: Date;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    total: number;
    serviceMode: ServiceMode;
    items: ReportOrderItem[];
  }>;
};

const REPORT_TIMEZONE = process.env.DAILY_REPORT_TIMEZONE || "Africa/Casablanca";

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  const interpretedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return interpretedAsUtc - date.getTime();
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 4; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
    const corrected = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
    if (corrected === utcGuess) break;
    utcGuess = corrected;
  }

  return new Date(utcGuess);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getPreviousDayParts(now: Date, timeZone: string) {
  const nowParts = getTimeZoneParts(now, timeZone);
  const currentDayUtc = zonedDateTimeToUtc(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    0,
    0,
    0,
    timeZone,
  );
  const previousDayUtc = new Date(currentDayUtc.getTime() - 24 * 60 * 60 * 1000);
  return getTimeZoneParts(previousDayUtc, timeZone);
}

export function getDailyReportWindow(now = new Date(), timeZone = REPORT_TIMEZONE) {
  const previousDay = getPreviousDayParts(now, timeZone);
  const currentDayStartUtc = zonedDateTimeToUtc(
    previousDay.year,
    previousDay.month,
    previousDay.day + 1,
    0,
    0,
    0,
    timeZone,
  );
  const previousDayStartUtc = zonedDateTimeToUtc(
    previousDay.year,
    previousDay.month,
    previousDay.day,
    0,
    0,
    0,
    timeZone,
  );

  return {
    timeZone,
    reportDateKey: `${previousDay.year}-${pad2(previousDay.month)}-${pad2(previousDay.day)}`,
    reportLabel: `${pad2(previousDay.day)}/${pad2(previousDay.month)}/${previousDay.year}`,
    startUtc: previousDayStartUtc,
    endUtcExclusive: currentDayStartUtc,
  };
}

function normalizeServiceMode(mode: unknown): ServiceMode {
  if (mode === "delivery" || mode === "pickup" || mode === "dine_in") return mode;
  return "unknown";
}

function money(value: number) {
  return value.toFixed(2);
}

function formatServiceLabel(mode: ServiceMode) {
  if (mode === "delivery") return "Livraison";
  if (mode === "pickup") return "À emporter";
  if (mode === "dine_in") return "Sur place";
  return "Non défini";
}

function formatOrderTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export async function buildDailyOrdersReport(now = new Date()): Promise<DailyOrdersReport> {
  const window = getDailyReportWindow(now, REPORT_TIMEZONE);
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, window.startUtc),
        lt(orders.createdAt, window.endUtcExclusive),
      ),
    )
    .orderBy(asc(orders.createdAt));

  const serviceCounts: Record<ServiceMode, number> = {
    delivery: 0,
    pickup: 0,
    dine_in: 0,
    unknown: 0,
  };

  const normalizedOrders = rows.map((row) => {
    const serviceMode = normalizeServiceMode(row.orderMeta?.serviceMode);
    serviceCounts[serviceMode] += 1;

    return {
      id: row.id,
      createdAt: row.createdAt,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerAddress: row.customerAddress,
      total: Number(row.total),
      serviceMode,
      items: Array.isArray(row.items) ? (row.items as ReportOrderItem[]) : [],
    };
  });

  const totalRevenue = normalizedOrders.reduce((sum, order) => sum + order.total, 0);

  return {
    ...window,
    timezone: window.timeZone,
    totalOrders: normalizedOrders.length,
    totalRevenue,
    serviceCounts,
    orders: normalizedOrders,
  };
}

export function renderDailyOrdersReportText(report: DailyOrdersReport) {
  const lines: string[] = [
    `Rapport quotidien Faceburger - ${report.reportLabel}`,
    `Fuseau horaire : ${report.timezone}`,
    `Période : ${report.reportDateKey} 00:00 -> 23:59`,
    "",
    `Commandes : ${report.totalOrders}`,
    `Chiffre d'affaires : ${money(report.totalRevenue)} MAD`,
    `Livraison : ${report.serviceCounts.delivery}`,
    `À emporter : ${report.serviceCounts.pickup}`,
    `Sur place : ${report.serviceCounts.dine_in}`,
    `Non défini : ${report.serviceCounts.unknown}`,
    "",
  ];

  if (report.orders.length === 0) {
    lines.push("Aucune commande pour cette journée.");
    return lines.join("\n");
  }

  report.orders.forEach((order) => {
    lines.push(
      `#${order.id} - ${formatOrderTime(order.createdAt, report.timezone)} - ${order.customerName} - ${formatServiceLabel(order.serviceMode)} - ${money(order.total)} MAD`,
    );
    order.items.forEach((item) => {
      lines.push(`  ${item.quantity}x ${item.name} - ${money(Number(item.lineTotal || 0))} MAD`);
      (item.options || []).forEach((option) => {
        const extraPrice = Number(option.extraPrice || 0);
        lines.push(
          `    + ${option.name}${extraPrice > 0 ? ` (+${money(extraPrice)} MAD)` : ""}`,
        );
      });
    });
    lines.push("");
  });

  return lines.join("\n");
}

export function renderDailyOrdersReportHtml(report: DailyOrdersReport) {
  const orderRows = report.orders.length === 0
    ? '<tr><td colspan="5" style="padding:16px;border-top:1px solid #e5e7eb;color:#6b7280">Aucune commande pour cette journée.</td></tr>'
    : report.orders.map((order) => {
        const itemsHtml = order.items.map((item) => {
          const optionsHtml = (item.options || []).map((option) => {
            const extraPrice = Number(option.extraPrice || 0);
            return `<div style="margin-top:2px;color:#6b7280">+ ${option.name}${extraPrice > 0 ? ` (+${money(extraPrice)} MAD)` : ""}</div>`;
          }).join("");

          return `<div style="margin-bottom:8px"><strong>${item.quantity}x ${item.name}</strong> - ${money(Number(item.lineTotal || 0))} MAD${optionsHtml}</div>`;
        }).join("");

        return `<tr>
          <td style="padding:16px;border-top:1px solid #e5e7eb;vertical-align:top">#${order.id}</td>
          <td style="padding:16px;border-top:1px solid #e5e7eb;vertical-align:top">${formatOrderTime(order.createdAt, report.timezone)}</td>
          <td style="padding:16px;border-top:1px solid #e5e7eb;vertical-align:top">${order.customerName}<div style="margin-top:4px;color:#6b7280">${order.customerPhone}</div></td>
          <td style="padding:16px;border-top:1px solid #e5e7eb;vertical-align:top">${formatServiceLabel(order.serviceMode)}<div style="margin-top:4px;color:#6b7280">${order.customerAddress || "—"}</div></td>
          <td style="padding:16px;border-top:1px solid #e5e7eb;vertical-align:top">${itemsHtml}<div style="margin-top:10px;font-weight:700;color:#1877F2">${money(order.total)} MAD</div></td>
        </tr>`;
      }).join("");

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
    <div style="max-width:880px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border-radius:16px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,0.06)">
        <h1 style="margin:0 0 8px;font-size:24px">Rapport quotidien Faceburger</h1>
        <p style="margin:0 0 20px;color:#6b7280">Journée du ${report.reportLabel} (${report.timezone})</p>

        <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:24px">
          <div style="background:#eff6ff;border-radius:12px;padding:14px">
            <div style="font-size:12px;color:#6b7280">Commandes</div>
            <div style="margin-top:4px;font-size:22px;font-weight:700">${report.totalOrders}</div>
          </div>
          <div style="background:#eff6ff;border-radius:12px;padding:14px">
            <div style="font-size:12px;color:#6b7280">Revenu</div>
            <div style="margin-top:4px;font-size:22px;font-weight:700">${money(report.totalRevenue)} MAD</div>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:14px">
            <div style="font-size:12px;color:#6b7280">Livraison</div>
            <div style="margin-top:4px;font-size:22px;font-weight:700">${report.serviceCounts.delivery}</div>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:14px">
            <div style="font-size:12px;color:#6b7280">À emporter</div>
            <div style="margin-top:4px;font-size:22px;font-weight:700">${report.serviceCounts.pickup}</div>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:14px">
            <div style="font-size:12px;color:#6b7280">Sur place</div>
            <div style="margin-top:4px;font-size:22px;font-weight:700">${report.serviceCounts.dine_in}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;background:#ffffff">
          <thead>
            <tr style="background:#f9fafb;text-align:left">
              <th style="padding:14px">#</th>
              <th style="padding:14px">Heure</th>
              <th style="padding:14px">Client</th>
              <th style="padding:14px">Mode</th>
              <th style="padding:14px">Articles</th>
            </tr>
          </thead>
          <tbody>
            ${orderRows}
          </tbody>
        </table>
      </div>
    </div>
  </body>
</html>`;
}
