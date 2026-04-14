import { getCategories } from "@/actions/categories";
import { CategoriesClient } from "@/components/admin/CategoriesClient";

export default async function CategoriesPage() {
  const cats = await getCategories();
  return <CategoriesClient initialCategories={cats} />;
}
