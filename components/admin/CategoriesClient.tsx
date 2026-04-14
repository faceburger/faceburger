"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Upload } from "lucide-react";
import { createCategory, updateCategory, deleteCategory, moveCategoryOrder } from "@/actions/categories";
import { useRouter } from "next/navigation";

type Category = { id: number; name: { fr: string; ar: string; en: string }; imageUrl: string; sortOrder: number };
type Props = { initialCategories: Category[] };

const emptyForm = { name_fr: "", name_ar: "", name_en: "", sort_order: "0", image_url: "" };

export function CategoriesClient({ initialCategories }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function refresh() { startTransition(() => router.refresh()); }
  function f(k: keyof typeof form) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value })); }

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setShowAdd(false);
    setForm({ name_fr: cat.name.fr, name_ar: cat.name.ar, name_en: cat.name.en, sort_order: String(cat.sortOrder), image_url: cat.imageUrl ?? "" });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    setForm(p => ({ ...p, image_url: data.url }));
    setUploading(false);
  }

  async function handleSave() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(k, v);
    if (editId != null) await updateCategory(editId, fd);
    else await createCategory(fd);
    setEditId(null); setShowAdd(false); setForm(emptyForm);
    refresh();
  }

  async function handleDelete(id: number) {
    setDeletingId(null);
    await deleteCategory(id);
    refresh();
  }

  async function move(id: number, direction: "up" | "down") {
    await moveCategoryOrder(id, direction);
    refresh();
  }

  const cats = initialCategories;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-xl" style={{ color: "#1C1E21" }}>Catégories</h1>
          <p className="text-sm mt-0.5" style={{ color: "#65676B" }}>{cats.length} catégorie{cats.length !== 1 ? "s" : ""}</p>
        </div>
        {!showAdd && editId == null && (
          <button onClick={() => { setShowAdd(true); setForm(emptyForm); }} className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-sm text-white" style={{ background: "#1877F2" }}>
            <Plus size={15} /> Ajouter
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* Add form */}
        {showAdd && (
          <div className="rounded-2xl bg-white p-5" style={{ border: "2px solid #1877F2" }}>
            <p className="font-semibold text-sm mb-4" style={{ color: "#1877F2" }}>Nouvelle catégorie</p>
            <EditForm form={form} f={f} uploading={uploading} onUpload={handleUpload} onSave={handleSave} onCancel={() => setShowAdd(false)} />
          </div>
        )}

        {cats.map((cat, idx) => (
          <div key={cat.id} className="rounded-2xl bg-white" style={{ border: editId === cat.id ? "2px solid #1877F2" : "1px solid #E4E6EB" }}>
            {editId === cat.id ? (
              <div className="p-5">
                <p className="font-semibold text-sm mb-4" style={{ color: "#1877F2" }}>Modifier — {cat.name.fr}</p>
                <EditForm form={form} f={f} uploading={uploading} onUpload={handleUpload} onSave={handleSave} onCancel={() => setEditId(null)} />
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4">
                {/* Image */}
                <div className="relative shrink-0 rounded-xl overflow-hidden bg-[#F0F2F5]" style={{ width: 56, height: 56 }}>
                  {cat.imageUrl ? <Image src={cat.imageUrl} alt="" fill className="object-cover" sizes="56px" /> : <div className="absolute inset-0 flex items-center justify-center text-xs text-[#65676B]">—</div>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: "#1C1E21" }}>{cat.name.fr}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#65676B" }}>{cat.name.en} · {cat.name.ar}</p>
                </div>

                {/* Sort order badge */}
                <span className="text-xs font-medium rounded-lg px-2 py-1" style={{ background: "#F0F2F5", color: "#65676B" }}>#{cat.sortOrder}</span>

                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button disabled={idx === 0} onClick={() => move(cat.id, "up")} className="rounded-lg p-1 transition-colors hover:bg-[#F0F2F5] disabled:opacity-30">
                    <ChevronUp size={16} color="#65676B" />
                  </button>
                  <button disabled={idx === cats.length - 1} onClick={() => move(cat.id, "down")} className="rounded-lg p-1 transition-colors hover:bg-[#F0F2F5] disabled:opacity-30">
                    <ChevronDown size={16} color="#65676B" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <button onClick={() => startEdit(cat)} className="rounded-xl p-2 transition-colors hover:bg-[#F0F2F5]">
                    <Pencil size={15} color="#65676B" />
                  </button>
                  {deletingId === cat.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(cat.id)} className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: "#E53935" }}>Supprimer</button>
                      <button onClick={() => setDeletingId(null)} className="rounded-xl px-2.5 py-1.5 text-xs font-semibold" style={{ background: "#F0F2F5", color: "#1C1E21" }}>Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingId(cat.id)} className="rounded-xl p-2 transition-colors hover:bg-red-50">
                      <Trash2 size={15} color="#E53935" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {cats.length === 0 && !showAdd && (
          <div className="rounded-2xl bg-white p-10 text-center" style={{ border: "2px dashed #E4E6EB" }}>
            <p className="text-sm" style={{ color: "#65676B" }}>Aucune catégorie. Créez-en une.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EditForm({ form, f, uploading, onUpload, onSave, onCancel }: {
  form: Record<string, string>;
  f: (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const fileId = `cat-upload-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LabelInput label="Nom (FR)" value={form.name_fr} onChange={f("name_fr")} />
        <LabelInput label="Nom (AR)" value={form.name_ar} onChange={f("name_ar")} />
        <LabelInput label="Nom (EN)" value={form.name_en} onChange={f("name_en")} />
      </div>
      <div className="flex gap-3 items-center">
        <label htmlFor={fileId} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer shrink-0" style={{ background: "#F0F2F5", border: "1px solid #E4E6EB", color: "#1C1E21" }}>
          <Upload size={13} /> {uploading ? "Upload..." : "Choisir une image"}
          <input id={fileId} type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </label>
        {form.image_url && (
          <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 44, height: 44 }}>
            <Image src={form.image_url} alt="" fill className="object-cover" sizes="44px" />
          </div>
        )}
      </div>
      <LabelInput label="Ordre d'affichage" value={form.sort_order} onChange={f("sort_order")} type="number" />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "#F0F2F5", color: "#1C1E21" }}>Annuler</button>
        <button type="button" onClick={onSave} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "#1877F2" }}>Enregistrer</button>
      </div>
    </div>
  );
}

function LabelInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold" style={{ color: "#65676B" }}>{label}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }} onFocus={e => e.target.style.borderColor = "#1877F2"} onBlur={e => e.target.style.borderColor = "#E4E6EB"} />
    </label>
  );
}
