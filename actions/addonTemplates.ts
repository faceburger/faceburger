"use server";

import { db } from "@/db";
import { addonTemplates, addonTemplateOptions, optionGroups, options } from "@/db/schema";
import { sql, eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS addon_templates (
      id SERIAL PRIMARY KEY,
      name JSONB NOT NULL,
      required BOOLEAN NOT NULL DEFAULT false,
      min_select INTEGER NOT NULL DEFAULT 0,
      max_select INTEGER NOT NULL DEFAULT 1
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS addon_template_options (
      id SERIAL PRIMARY KEY,
      template_id INTEGER NOT NULL REFERENCES addon_templates(id) ON DELETE CASCADE,
      name JSONB NOT NULL,
      extra_price NUMERIC(10,2) NOT NULL DEFAULT 0
    )
  `);
}

export async function getTemplates() {
  await ensureTables();
  const tmplRows = await db.select().from(addonTemplates);
  const optRows = await db.select().from(addonTemplateOptions);
  return tmplRows.map((t) => ({
    ...t,
    options: optRows.filter((o) => o.templateId === t.id),
  }));
}

export async function createTemplate(formData: FormData) {
  await ensureTables();
  await db.insert(addonTemplates).values({
    name: {
      fr: (formData.get("name_fr") as string).trim(),
      ar: (formData.get("name_ar") as string).trim(),
      en: (formData.get("name_en") as string).trim(),
    },
    required: formData.get("required") === "true",
    minSelect: parseInt((formData.get("min_select") as string) ?? "0"),
    maxSelect: parseInt((formData.get("max_select") as string) ?? "1"),
  });
  revalidatePath("/admin/options");
}

export async function updateTemplate(id: number, formData: FormData) {
  await db
    .update(addonTemplates)
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
    .where(eq(addonTemplates.id, id));
  revalidatePath("/admin/options");
}

export async function deleteTemplate(id: number) {
  await db.delete(addonTemplates).where(eq(addonTemplates.id, id));
  revalidatePath("/admin/options");
}

export async function addTemplateOption(templateId: number, formData: FormData) {
  await db.insert(addonTemplateOptions).values({
    templateId,
    name: {
      fr: (formData.get("name_fr") as string).trim(),
      ar: (formData.get("name_ar") as string).trim(),
      en: (formData.get("name_en") as string).trim(),
    },
    extraPrice: (formData.get("extra_price") as string).trim() || "0",
  });
  revalidatePath("/admin/options");
}

export async function updateTemplateOption(id: number, formData: FormData) {
  await db
    .update(addonTemplateOptions)
    .set({
      name: {
        fr: (formData.get("name_fr") as string).trim(),
        ar: (formData.get("name_ar") as string).trim(),
        en: (formData.get("name_en") as string).trim(),
      },
      extraPrice: (formData.get("extra_price") as string).trim() || "0",
    })
    .where(eq(addonTemplateOptions.id, id));
  revalidatePath("/admin/options");
}

export async function deleteTemplateOption(id: number) {
  await db.delete(addonTemplateOptions).where(eq(addonTemplateOptions.id, id));
  revalidatePath("/admin/options");
}

/**
 * For each itemId, create an option_group (cloned from the template) plus
 * one option row per template option. Skips items that already have a group
 * with the exact same French name as the template.
 */
export async function applyTemplateToItems(templateId: number, itemIds: number[]) {
  const [template] = await db
    .select()
    .from(addonTemplates)
    .where(eq(addonTemplates.id, templateId));
  if (!template) return;

  const tmplOptions = await db
    .select()
    .from(addonTemplateOptions)
    .where(eq(addonTemplateOptions.templateId, templateId));

  const tmplName = (template.name as { fr: string; ar: string; en: string });

  for (const itemId of itemIds) {
    // Check if this item already has a group with the same FR name
    const existing = await db
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.itemId, itemId));

    const alreadyApplied = existing.some(
      (g) => (g.name as { fr: string }).fr === tmplName.fr
    );
    if (alreadyApplied) continue;

    const [newGroup] = await db
      .insert(optionGroups)
      .values({
        itemId,
        name: tmplName,
        required: template.required,
        minSelect: template.minSelect,
        maxSelect: template.maxSelect,
      })
      .returning({ id: optionGroups.id });

    if (tmplOptions.length > 0) {
      await db.insert(options).values(
        tmplOptions.map((o) => ({
          groupId: newGroup.id,
          name: o.name as { fr: string; ar: string; en: string },
          extraPrice: o.extraPrice as string,
        }))
      );
    }
  }

  revalidatePath("/admin/options");
  revalidatePath("/");
}

export async function getItemsWithTemplateApplied(templateId: number) {
  const [template] = await db
    .select()
    .from(addonTemplates)
    .where(eq(addonTemplates.id, templateId));
  if (!template) return [];

  const tmplName = template.name as { fr: string; ar: string; en: string };
  const groups = await db.select({ itemId: optionGroups.itemId, name: optionGroups.name }).from(optionGroups);

  const itemIds = new Set<number>();
  for (const group of groups) {
    const groupName = group.name as { fr?: string };
    if (groupName.fr === tmplName.fr) itemIds.add(group.itemId);
  }
  return Array.from(itemIds);
}

export async function removeTemplateFromItems(templateId: number, itemIds: number[]) {
  if (itemIds.length === 0) return;

  const [template] = await db
    .select()
    .from(addonTemplates)
    .where(eq(addonTemplates.id, templateId));
  if (!template) return;

  const tmplName = template.name as { fr: string; ar: string; en: string };
  await db
    .delete(optionGroups)
    .where(
      and(
        inArray(optionGroups.itemId, itemIds),
        sql`${optionGroups.name}->>'fr' = ${tmplName.fr}`
      )
    );

  revalidatePath("/admin/options");
  revalidatePath("/");
}
