"use client";

import { useRef, useState } from "react";
import { Trash2, Download, FileText, TableProperties } from "lucide-react";
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

type ExportPeriod = "today" | "week" | "all" | "custom";
type ExportFormat = "csv" | "pdf";

async function exportToPDF(orders: Order[]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });

  const dateStr = new Date().toLocaleDateString("fr-FR");
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FACEBURGER — Rapport des commandes", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Généré le ${dateStr} — ${orders.length} commande${orders.length !== 1 ? "s" : ""}`, 14, 26);

  const rows = orders.map(o => {
    const items = (o.items as OrderItem[]).map(it => {
      const opts = it.options?.length ? ` (${it.options.map(op => op.name).join(", ")})` : "";
      return `${it.quantity}x ${it.name}${opts}`;
    }).join("\n");
    const date = new Date(o.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return [`#${o.id}`, date, o.customerName, o.customerPhone, serviceLabel(o.orderMeta?.serviceMode), items, o.customerAddress || "—", `${parseFloat(String(o.total)).toFixed(2)} MAD`];
  });

  autoTable(doc, {
    startY: 32,
    head: [["#", "Date", "Client", "Téléphone", "Mode", "Articles", "Adresse", "Total"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 119, 242], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 5: { cellWidth: 60 }, 6: { cellWidth: 50 } },
  });

  doc.save(`commandes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportToCSV(orders: Order[]) {
  const headers = ["#", "Date", "Client", "Téléphone", "Mode", "Articles", "Adresse", "Total (MAD)"];
  const rows = orders.map(o => {
    const items = (o.items as OrderItem[]).map(it => {
      const opts = it.options?.length ? ` (${it.options.map(op => op.name).join(", ")})` : "";
      return `${it.quantity}x ${it.name}${opts}`;
    }).join(" | ");
    const mode = serviceLabel(o.orderMeta?.serviceMode);
    const date = new Date(o.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return [o.id, date, o.customerName, o.customerPhone, mode, items, o.customerAddress || "—", parseFloat(String(o.total)).toFixed(2)];
  });
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrdersClient({ orders: initialOrders }: Props) {
  const [filter, setFilter] = useState<"today" | "week" | "all">("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

  const orders = initialOrders.filter(o => !deletedIds.has(o.id));

  async function handleExport() {
    const from = exportFrom ? new Date(exportFrom) : null;
    const to = exportTo ? new Date(exportTo + "T23:59:59") : null;
    const filtered = orders.filter(o => {
      const date = new Date(o.createdAt);
      if (exportPeriod === "today") return isToday(date);
      if (exportPeriod === "week") return isThisWeek(date);
      if (exportPeriod === "custom") {
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      }
      return true;
    });
    if (exportFormat === "pdf") await exportToPDF(filtered);
    else exportToCSV(filtered);
    setExportOpen(false);
  }

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
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(v => !v)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: "#1877F2", color: "#ffffff" }}
          >
            <Download size={15} />
            Exporter
          </button>

          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute end-0 top-[calc(100%+8px)] z-20 w-72 rounded-2xl bg-white p-4 shadow-xl" style={{ border: "1px solid #E4E6EB" }}>
                <p className="text-sm font-bold mb-3" style={{ color: "#1C1E21" }}>Exporter les commandes</p>

                <p className="text-xs font-semibold mb-2" style={{ color: "#65676B" }}>Période</p>
                <div className="flex flex-col gap-1.5 mb-4">
                  {([
                    { key: "all", label: "Toutes les commandes" },
                    { key: "today", label: "Aujourd'hui" },
                    { key: "week", label: "Cette semaine" },
                    { key: "custom", label: "Période personnalisée" },
                  ] as { key: ExportPeriod; label: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setExportPeriod(opt.key)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors"
                      style={{
                        background: exportPeriod === opt.key ? "#EBF3FF" : "#F0F2F5",
                        color: exportPeriod === opt.key ? "#1877F2" : "#1C1E21",
                        fontWeight: exportPeriod === opt.key ? 600 : 400,
                      }}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: exportPeriod === opt.key ? "#1877F2" : "#BCC0C4" }}>
                        {exportPeriod === opt.key && <span className="h-2 w-2 rounded-full bg-[#1877F2]" />}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {exportPeriod === "custom" && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Du</span>
                      <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Au</span>
                      <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }} />
                    </label>
                  </div>
                )}

                <p className="text-xs font-semibold mb-2" style={{ color: "#65676B" }}>Format</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {([
                    { key: "pdf", label: "PDF", icon: <FileText size={14} /> },
                    { key: "csv", label: "CSV", icon: <TableProperties size={14} /> },
                  ] as { key: ExportFormat; label: string; icon: React.ReactNode }[]).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setExportFormat(f.key)}
                      className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition-colors"
                      style={{
                        background: exportFormat === f.key ? "#EBF3FF" : "#F0F2F5",
                        color: exportFormat === f.key ? "#1877F2" : "#65676B",
                        border: exportFormat === f.key ? "1.5px solid #1877F2" : "1.5px solid transparent",
                      }}
                    >
                      {f.icon}{f.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExport}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
                  style={{ background: "#1877F2" }}
                >
                  <Download size={14} />
                  Télécharger {exportFormat.toUpperCase()}
                </button>
              </div>
            </>
          )}
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
                      <span className="text-xs font-semibold rounded-lg px-2.5 py-1 whitespace-nowrap" style={serviceBadgeStyle(mode)}>
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
