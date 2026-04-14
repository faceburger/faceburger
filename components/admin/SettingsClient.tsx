"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { saveSettings } from "@/actions/settings";
import { Upload, Check } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = { settings: Record<string, string> };

export function SettingsClient({ settings }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    restaurant_name: settings.restaurant_name ?? "",
    restaurant_phone: settings.restaurant_phone ?? "",
    restaurant_address: settings.restaurant_address ?? "",
    restaurant_hours: settings.restaurant_hours ?? "",
    cover_image_url: settings.cover_image_url ?? "",
    whatsapp_number: settings.whatsapp_number ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    setForm(f => ({ ...f, cover_image_url: data.url }));
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(k, v);
    await saveSettings(fd);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-xl" style={{ color: "#1C1E21" }}>Paramètres</h1>
          <p className="text-sm mt-0.5" style={{ color: "#65676B" }}>Informations du restaurant et intégrations</p>
        </div>
        <button type="submit" className="flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm text-white transition-all" style={{ background: saved ? "#16a34a" : "#1877F2" }}>
          {saved ? <><Check size={15} /> Enregistré</> : "Enregistrer"}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* Restaurant Info */}
        <div className="rounded-2xl bg-white p-6" style={{ border: "1px solid #E4E6EB" }}>
          <h2 className="font-semibold mb-4" style={{ fontSize: 15, color: "#1C1E21" }}>Informations du restaurant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom du restaurant" value={form.restaurant_name} onChange={set("restaurant_name")} />
            <Field label="Téléphone" value={form.restaurant_phone} onChange={set("restaurant_phone")} placeholder="+212 6 00 00 00 00" />
            <Field label="Adresse" value={form.restaurant_address} onChange={set("restaurant_address")} placeholder="Agdal, Rabat, Maroc" />
            <Field label="Horaires" value={form.restaurant_hours} onChange={set("restaurant_hours")} placeholder="Lun – Dim : 11h00 – 23h00" />
          </div>
        </div>

        {/* Cover Image */}
        <div className="rounded-2xl bg-white p-6" style={{ border: "1px solid #E4E6EB" }}>
          <h2 className="font-semibold mb-4" style={{ fontSize: 15, color: "#1C1E21" }}>Image de couverture</h2>
          <div className="flex gap-4 items-start">
            {form.cover_image_url && (
              <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 160, height: 90 }}>
                <Image src={form.cover_image_url} alt="Cover" fill className="object-cover" sizes="160px" />
              </div>
            )}
            <div className="flex flex-col gap-3 flex-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "#F0F2F5", color: "#1C1E21", border: "1px solid #E4E6EB" }}>
                <Upload size={14} />
                {uploading ? "Upload en cours..." : "Choisir une image"}
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp */}
        <div className="rounded-2xl bg-white p-6" style={{ border: "1px solid #E4E6EB" }}>
          <h2 className="font-semibold mb-1" style={{ fontSize: 15, color: "#1C1E21" }}>WhatsApp</h2>
          <p className="text-xs mb-4" style={{ color: "#65676B" }}>Numéro sur lequel les commandes seront reçues (sans espaces ni +)</p>
          <div style={{ maxWidth: 280 }}>
            <Field label="Numéro WhatsApp" value={form.whatsapp_number} onChange={set("whatsapp_number")} placeholder="212600000000" />
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: "#65676B" }}>{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} className="rounded-xl px-3 py-2.5 text-sm outline-none transition-colors" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }} onFocus={e => e.target.style.borderColor = "#1877F2"} onBlur={e => e.target.style.borderColor = "#E4E6EB"} />
    </label>
  );
}
