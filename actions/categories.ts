"use server";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder);
}

export async function createCategory(formData: FormData) {
  const nameFr = (formData.get("name_fr") as string).trim();
  const nameAr = (formData.get("name_ar") as string).trim();
  const nameEn = (formData.get("name_en") as string).trim();
  const sortOrder = parseInt((formData.get("sort_order") as string) ?? "0");

  const imageUrl = ((formData.get("image_url") as string) ?? "").trim();

  await db.insert(categories).values({
    name: { fr: nameFr, ar: nameAr, en: nameEn },
    imageUrl,
    sortOrder,
  });
  revalidatePath("/regrubecaf/categories");
}

export async function updateCategory(id: number, formData: FormData) {
  const nameFr = (formData.get("name_fr") as string).trim();
  const nameAr = (formData.get("name_ar") as string).trim();
  const nameEn = (formData.get("name_en") as string).trim();
  const sortOrder = parseInt((formData.get("sort_order") as string) ?? "0");

  const imageUrl = ((formData.get("image_url") as string) ?? "").trim();

  await db
    .update(categories)
    .set({
      name: { fr: nameFr, ar: nameAr, en: nameEn },
      imageUrl,
      sortOrder,
    })
    .where(eq(categories.id, id));
  revalidatePath("/regrubecaf/categories");
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/regrubecaf/categories");
}

export async function moveCategoryOrder(id: number, direction: "up" | "down") {
  const all = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;
  const a = all[idx];
  const b = all[swapIdx];
  await db.update(categories).set({ sortOrder: b.sortOrder }).where(eq(categories.id, a.id));
  await db.update(categories).set({ sortOrder: a.sortOrder }).where(eq(categories.id, b.id));
  revalidatePath("/regrubecaf/categories");
}
