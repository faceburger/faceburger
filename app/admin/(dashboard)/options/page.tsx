import { getItems } from "@/actions/items";
import { getCategories } from "@/actions/categories";
import { getTemplates } from "@/actions/addonTemplates";
import { OptionsClient } from "@/components/admin/OptionsClient";

export default async function OptionsPage() {
  const [items, categories, templates] = await Promise.all([
    getItems(),
    getCategories(),
    getTemplates(),
  ]);
  return <OptionsClient items={items} categories={categories} templates={templates} />;
}
