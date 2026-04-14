import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  if (store.get("admin_session")?.value !== "authenticated") {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#F0F2F5" }}>
      <AdminSidebar />
      <main className="flex-1 flex flex-col overflow-auto pb-20 lg:pb-0" style={{ padding: "20px 16px", background: "#F7F8FA" }}>{children}</main>
    </div>
  );
}
