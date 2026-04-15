import { db } from "@/db";
import { categories, items, optionGroups, options } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { CustomerPageClient } from "@/components/customer/CustomerPageClient";
import { getSettings } from "@/actions/settings";
import type { MenuCategory } from "@/types/menu";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch everything in parallel
  const [cats, allItems, allGroups, allOptions, settings] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(items).orderBy(asc(items.sortOrder)),
    db.select().from(optionGroups).orderBy(asc(optionGroups.sortOrder)),
    db.select().from(options),
    getSettings(),
  ]);

  // Build nested structure
  const menuData: MenuCategory[] = cats.map((cat) => ({
    id: cat.id,
    name: cat.name as { fr: string; ar: string; en: string },
    imageUrl: cat.imageUrl ?? "",
    sortOrder: cat.sortOrder,
    items: allItems
      .filter((item) => item.categoryId === cat.id)
      .map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name as { fr: string; ar: string; en: string },
        description: item.description as { fr: string; ar: string; en: string },
        price: parseFloat(item.price as unknown as string),
        imageUrl: item.imageUrl,
        available: item.available,
        sortOrder: item.sortOrder,
        optionGroups: allGroups
          .filter((g) => g.itemId === item.id)
          .map((g) => ({
            id: g.id,
            itemId: g.itemId,
            name: g.name as { fr: string; ar: string; en: string },
            required: g.required,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            freeSelections: g.freeSelections ?? 0,
            visibilityCondition: (g.visibilityCondition as { groupFr: string; optionFr: string } | null) ?? null,
            options: allOptions
              .filter((o) => o.groupId === g.id)
              .map((o) => ({
                id: o.id,
                groupId: o.groupId,
                name: o.name as { fr: string; ar: string; en: string },
                extraPrice: parseFloat(o.extraPrice as unknown as string),
              })),
          })),
      })),
  }));

  return <CustomerPageClient locale={locale} menu={menuData} settings={settings} />;
}
