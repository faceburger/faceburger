"use server";
import { db } from "@/db";
import { restaurantSettings } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const DEFAULTS: Record<string, string> = {
  restaurant_name: "FaceBurger",
  restaurant_phone: "+212 6 00 00 00 00",
  restaurant_address: "Agdal, Rabat, Maroc",
  restaurant_hours: "Lun – Dim : 11h00 – 23h00",
  cover_image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
  whatsapp_number: "212600000000",
  maps_url: "https://www.google.com/maps/dir/?api=1&destination=Agdal%2C+Rabat%2C+Maroc",
  delivery_fee_tiers: '[{"maxKm":5,"fee":10},{"maxKm":10,"fee":20}]',
  restaurant_lat: "34.0084",
  restaurant_lng: "-6.8539",
};

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);
}

export async function getSettings(): Promise<Record<string, string>> {
  await ensureTable();
  const rows = await db.select().from(restaurantSettings);
  const result = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function upsertSetting(key: string, value: string) {
  await ensureTable();
  await db
    .insert(restaurantSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: restaurantSettings.key, set: { value } });
  revalidatePath("/regrubecaf/settings");
  revalidatePath("/");
}

export async function saveSettings(formData: FormData) {
  await ensureTable();
  const keys = [
    "restaurant_name", "restaurant_phone", "restaurant_address",
    "restaurant_hours", "cover_image_url", "whatsapp_number",
    "delivery_fee_tiers", "restaurant_lat", "restaurant_lng",
  ];
  for (const key of keys) {
    const val = (formData.get(key) as string ?? "").trim();
    await db
      .insert(restaurantSettings)
      .values({ key, value: val })
      .onConflictDoUpdate({ target: restaurantSettings.key, set: { value: val } });
  }
  revalidatePath("/regrubecaf/settings");
  revalidatePath("/");
}
