"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Package, Sliders, ClipboardList, Settings2, LogOut } from "lucide-react";

const links = [
  { href: "/admin/categories", label: "Catégories", icon: LayoutGrid },
  { href: "/admin/items", label: "Articles", icon: Package },
  { href: "/admin/options", label: "Options", icon: Sliders },
  { href: "/admin/orders", label: "Commandes", icon: ClipboardList },
  { href: "/admin/settings", label: "Paramètres", icon: Settings2 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col shrink-0" style={{ width: 220, minHeight: "100vh", background: "#ffffff", borderRight: "1px solid #E4E6EB" }}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex items-center justify-center rounded-xl font-black text-white text-sm" style={{ width: 38, height: 38, background: "#1877F2", letterSpacing: "-0.5px" }}>
            FB
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "#1C1E21" }}>FaceBurger</p>
            <p className="text-xs" style={{ color: "#65676B" }}>Admin</p>
          </div>
        </div>

        <div className="mx-4 mb-4" style={{ height: 1, background: "#E4E6EB" }} />

        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl transition-colors font-medium" style={{ padding: "9px 12px", fontSize: 13.5, background: active ? "#1877F2" : "transparent", color: active ? "#ffffff" : "#4B5563" }}>
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-5">
          <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl w-full transition-colors font-medium" style={{ padding: "9px 12px", fontSize: 13.5, color: "#E53935" }}>
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-center justify-around bg-white" style={{ borderTop: "1px solid #E4E6EB", height: 60 }}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-0.5" style={{ color: active ? "#1877F2" : "#65676B", fontSize: 10, fontWeight: active ? 700 : 500 }}>
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
        <button onClick={handleLogout} className="flex flex-col items-center gap-0.5" style={{ color: "#E53935", fontSize: 10, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
          <LogOut size={20} />
          Quitter
        </button>
      </nav>
    </>
  );
}
