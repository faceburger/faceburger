"use server";

import { db } from "@/db";
import { optionGroups, options } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getOptionGroupsForItem(itemId: number) {
  const groups = await db
    .select()
    .from(optionGroups)
    .where(eq(optionGroups.itemId, itemId));

  const opts = await db.select().from(options);

  return groups.map((g) => ({
    ...g,
    options: opts.filter((o) => o.groupId === g.id),
  }));
}

export async function createOptionGroup(formData: FormData) {
  const itemId = parseInt(formData.get("item_id") as string);
  await db.insert(optionGroups).values({
    itemId,
    name: {
      fr: (formData.get("name_fr") as string).trim(),
      ar: (formData.get("name_ar") as string).trim(),
      en: (formData.get("name_en") as string).trim(),
    },
    required: formData.get("required") === "true",
    minSelect: parseInt((formData.get("min_select") as string) ?? "0"),
    maxSelect: parseInt((formData.get("max_select") as string) ?? "1"),
  });
  revalidatePath("/regrubecaf/options");
}

export async function updateOptionGroup(id: number, formData: FormData) {
  await db
    .update(optionGroups)
    .set({
      name: {
        fr: (formData.get("name_fr") as string).trim(),
        ar: (formData.get("name_ar") as string).trim(),
        en: (formData.get("name_en") as string).trim(),
      },
      required: formData.get("required") === "true",
      minSelect: parseInt((formData.get("min_select") as string) ?? "0"),
      maxSelect: parseInt((formData.get("max_select") as string) ?? "1"),
    })
    .where(eq(optionGroups.id, id));
  revalidatePath("/regrubecaf/options");
}

export async function deleteOptionGroup(id: number) {
  await db.delete(optionGroups).where(eq(optionGroups.id, id));
  revalidatePath("/regrubecaf/options");
}

export async function createOption(formData: FormData) {
  const groupId = parseInt(formData.get("group_id") as string);
  await db.insert(options).values({
    groupId,
    name: {
      fr: (formData.get("name_fr") as string).trim(),
      ar: (formData.get("name_ar") as string).trim(),
      en: (formData.get("name_en") as string).trim(),
    },
    extraPrice: (formData.get("extra_price") as string).trim() || "0",
  });
  revalidatePath("/regrubecaf/options");
}

export async function updateOption(id: number, formData: FormData) {
  await db
    .update(options)
    .set({
      name: {
        fr: (formData.get("name_fr") as string).trim(),
        ar: (formData.get("name_ar") as string).trim(),
        en: (formData.get("name_en") as string).trim(),
      },
      extraPrice: (formData.get("extra_price") as string).trim() || "0",
    })
    .where(eq(options.id, id));
  revalidatePath("/regrubecaf/options");
}

export async function deleteOption(id: number) {
  await db.delete(options).where(eq(options.id, id));
  revalidatePath("/regrubecaf/options");
}
