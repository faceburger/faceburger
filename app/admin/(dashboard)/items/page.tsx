import { getItems } from "@/actions/items";
import { getCategories } from "@/actions/categories";
import { ItemsClient } from "@/components/admin/ItemsClient";

export default async function ItemsPage() {
  const [items, categories] = await Promise.all([getItems(), getCategories()]);
  return <ItemsClient initialItems={items} categories={categories} />;
}
