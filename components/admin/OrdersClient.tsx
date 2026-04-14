"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteOrder } from "@/actions/orders";

type Order = {
  id: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: unknown;
  total: string | number;
  orderMeta: Record<string, unknown> | null;
  createdAt: Date;
};

type OrderItem = {
  name: string;
  quantity: number;
  lineTotal: number;
  options?: { name: string }[];
};

type Props = { orders: Order[] };

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isThisWeek(date: Date): boolean {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function serviceLabel(mode: unknown): string {
  if (mode === "delivery") return "Livraison";
  if (mode === "pickup") return "À emporter";
  if (mode === "dine_in") return "Sur place";
  return "—";
}

function serviceBadgeStyle(mode: unknown): React.CSSProperties {
  if (mode === "delivery") return { background: "#EBF3FF", color: "#1877F2" };
  if (mode === "pickup") return { background: "#FFF3E0", color: "#E65100" };
  if (mode === "dine_in") return { background: "#E8F5E9", color: "#2E7D32" };
  return { background: "#F0F2F5", color: "#65676B" };
}

export function OrdersClient({ orders: initialOrders }: Props) {
  const [filter, setFilter] = useState<"today" | "week" | "all">("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());

  const orders = initialOrders.filter(o => !deletedIds.has(o.id));

  async function handleDelete(id: number) {
    setDeletingId(null);
    setDeletedIds(prev => new Set(prev).add(id));
    await deleteOrder(id);
  }

  const filteredOrders = orders.filter(order => {
    const date = new Date(order.createdAt);
    const matchesFilter =
      filter === "today" ? isToday(date) :
      filter === "week" ? isThisWeek(date) :
      true;
    const matchesSearch = search.trim() === "" ||
      order.customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.customerPhone.includes(search.trim());
    return matchesFilter && matchesSearch;
  });

  // KPI computations
  const todayOrders = orders.filter(o => isToday(new Date(o.createdAt)));
  const weekOrders = orders.filter(o => isThisWeek(new Date(o.createdAt)));
  const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);

  const kpis = [
    { label: "Commandes aujourd'hui", value: String(todayOrders.length) },
    { label: "Commandes cette semaine", value: String(weekOrders.length) },
    { label: "Revenu aujourd'hui", value: `${todayRevenue.toFixed(2)} MAD` },
    { label: "Revenu total", value: `${totalRevenue.toFixed(2)} MAD` },
  ];

  const tabs: { key: "today" | "week" | "all"; label: string }[] = [
    { key: "today", label: "Aujourd'hui" },
    { key: "week", label: "Cette semaine" },
    { key: "all", label: "Tout" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-xl" style={{ color: "#1C1E21" }}>Commandes</h1>
          <p className="text-sm mt-0.5" style={{ color: "#65676B" }}>{orders.length} commande{orders.length !== 1 ? "s" : ""} au total</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="rounded-2xl bg-white p-5" style={{ border: "1px solid #E4E6EB" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#65676B" }}>{kpi.label}</p>
            <p className="font-bold text-xl" style={{ color: "#1C1E21" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "#F0F2F5" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                background: filter === tab.key ? "#ffffff" : "transparent",
                color: filter === tab.key ? "#1C1E21" : "#65676B",
                boxShadow: filter === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou numéro..."
          className="rounded-xl px-4 py-2.5 text-sm outline-none flex-1 max-w-72"
          style={{ border: "1.5px solid #E4E6EB", background: "#ffffff", color: "#1C1E21" }}
          onFocus={e => e.target.style.borderColor = "#1877F2"}
          onBlur={e => e.target.style.borderColor = "#E4E6EB"}
        />
      </div>

      {/* Table */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center" style={{ border: "1px solid #E4E6EB" }}>
          <p className="text-sm" style={{ color: "#65676B" }}>Aucune commande trouvée.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white overflow-hidden overflow-x-auto" style={{ border: "1px solid #E4E6EB" }}>
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E4E6EB", background: "#FAFBFC" }}>
                {["#", "Date", "Client", "Téléphone", "Mode", "Articles", "Total", ""].map(h => (
                  <th key={h} className="text-left font-semibold" style={{ padding: "12px 16px", fontSize: 12, color: "#65676B" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, i) => {
                const orderItems = order.items as OrderItem[];
                const mode = order.orderMeta?.serviceMode;
                return (
                  <tr key={order.id} style={{ borderBottom: i < filteredOrders.length - 1 ? "1px solid #E4E6EB" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#65676B" }}>#{order.id}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#1C1E21", whiteSpace: "nowrap" }}>
                      {new Date(order.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#1C1E21" }}>{order.customerName}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#1C1E21" }}>{order.customerPhone}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="text-xs font-semibold rounded-lg px-2.5 py-1" style={serviceBadgeStyle(mode)}>
                        {serviceLabel(mode)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#1C1E21" }}>
                      {orderItems.map((it, idx) => (
                        <div key={idx}>
                          {it.quantity}× {it.name}
                          {it.options && it.options.length > 0 && (
                            <span style={{ color: "#65676B" }}> ({it.options.map(o => o.name).join(", ")})</span>
                          )}
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#1877F2", whiteSpace: "nowrap" }}>
                      {parseFloat(String(order.total)).toFixed(2)} MAD
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {deletingId === order.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
                            style={{ background: "#E53935" }}
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                            style={{ background: "#F0F2F5", color: "#1C1E21" }}
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(order.id)}
                          className="rounded-lg p-2 transition-colors hover:bg-red-50"
                        >
                          <Trash2 size={15} color="#E53935" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
