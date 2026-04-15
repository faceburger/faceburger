"use server";

import { db } from "@/db";
import { items } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getItems() {
  return db.select().from(items).orderBy(items.sortOrder);
}

export async function createItem(formData: FormData) {
  await db.insert(items).values({
    categoryId: parseInt(formData.get("category_id") as string),
    name: {
      fr: (formData.get("name_fr") as string).trim(),
      ar: (formData.get("name_ar") as string).trim(),
      en: (formData.get("name_en") as string).trim(),
    },
    description: {
      fr: (formData.get("desc_fr") as string).trim(),
      ar: (formData.get("desc_ar") as string).trim(),
      en: (formData.get("desc_en") as string).trim(),
    },
    price: (formData.get("price") as string).trim(),
    imageUrl: (formData.get("image_url") as string).trim(),
    available: formData.get("available") === "true",
    sortOrder: parseInt((formData.get("sort_order") as string) ?? "0"),
  });
  revalidatePath("/regrubecaf/items");
}

export async function updateItem(id: number, formData: FormData) {
  await db
    .update(items)
    .set({
      categoryId: parseInt(formData.get("category_id") as string),
      name: {
        fr: (formData.get("name_fr") as string).trim(),
        ar: (formData.get("name_ar") as string).trim(),
        en: (formData.get("name_en") as string).trim(),
      },
      description: {
        fr: (formData.get("desc_fr") as string).trim(),
        ar: (formData.get("desc_ar") as string).trim(),
        en: (formData.get("desc_en") as string).trim(),
      },
      price: (formData.get("price") as string).trim(),
      imageUrl: (formData.get("image_url") as string).trim(),
      available: formData.get("available") === "true",
      sortOrder: parseInt((formData.get("sort_order") as string) ?? "0"),
    })
    .where(eq(items.id, id));
  revalidatePath("/regrubecaf/items");
}

export async function toggleItemAvailable(id: number, available: boolean) {
  await db.update(items).set({ available }).where(eq(items.id, id));
  revalidatePath("/regrubecaf/items");
}

export async function deleteItem(id: number) {
  await db.delete(items).where(eq(items.id, id));
  revalidatePath("/regrubecaf/items");
}
