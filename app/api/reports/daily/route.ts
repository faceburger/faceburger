import { db } from "@/db";
import { restaurantSettings } from "@/db/schema";
import {
  buildDailyOrdersReport,
  getDailyReportWindow,
  renderDailyOrdersReportHtml,
  renderDailyOrdersReportText,
} from "@/lib/daily-orders-report";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const REPORT_TIMEZONE = process.env.DAILY_REPORT_TIMEZONE || "Africa/Casablanca";
const LAST_SENT_DATE_KEY = "daily_report_last_sent_date";
const LAST_SENT_AT_KEY = "daily_report_last_sent_at";

async function ensureSettingsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);
}

async function getSettingValue(key: string) {
  await ensureSettingsTable();
  const rows = await db
    .select({ value: restaurantSettings.value })
    .from(restaurantSettings)
    .where(eq(restaurantSettings.key, key))
    .limit(1);

  return rows[0]?.value ?? null;
}

async function upsertSettingValue(key: string, value: string) {
  await ensureSettingsTable();
  await db
    .insert(restaurantSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: restaurantSettings.key, set: { value } });
}

function getCurrentMoroccoHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  return Number(hour);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const from = process.env.DAILY_REPORT_EMAIL_FROM;
  const to = process.env.DAILY_REPORT_EMAIL_TO || "faceburger05@gmail.com";

  if (!from) {
    return NextResponse.json(
      { error: "DAILY_REPORT_EMAIL_FROM is not configured" },
      { status: 500 },
    );
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const reportWindow = getDailyReportWindow(new Date(), REPORT_TIMEZONE);
  const currentMoroccoHour = getCurrentMoroccoHour();

  if (!force && currentMoroccoHour !== 3) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "outside_report_hour",
        currentMoroccoHour,
        timezone: REPORT_TIMEZONE,
      },
      { status: 202 },
    );
  }

  const lastSentDate = await getSettingValue(LAST_SENT_DATE_KEY);
  if (!force && lastSentDate === reportWindow.reportDateKey) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "already_sent",
        reportDateKey: reportWindow.reportDateKey,
      },
      { status: 200 },
    );
  }

  const report = await buildDailyOrdersReport();
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from,
    to,
    subject: `Rapport quotidien Faceburger - ${report.reportLabel}`,
    html: renderDailyOrdersReportHtml(report),
    text: renderDailyOrdersReportText(report),
  });

  await upsertSettingValue(LAST_SENT_DATE_KEY, report.reportDateKey);
  await upsertSettingValue(LAST_SENT_AT_KEY, new Date().toISOString());

  return NextResponse.json({
    ok: true,
    sent: true,
    reportDateKey: report.reportDateKey,
    totalOrders: report.totalOrders,
    totalRevenue: report.totalRevenue,
  });
}
