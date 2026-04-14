"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { createItem, updateItem, deleteItem, toggleItemAvailable } from "@/actions/items";
import { useRouter } from "next/navigation";

type Category = { id: number; name: { fr: string; ar: string; en: string }; sortOrder: number; imageUrl: string };
type Item = {
  id: number;
  categoryId: number;
  name: { fr: string; ar: string; en: string };
  description: { fr: string; ar: string; en: string };
  price: string;
  imageUrl: string;
  available: boolean;
  sortOrder: number;
};

const emptyForm = {
  category_id: "",
  name_fr: "", name_ar: "", name_en: "",
  desc_fr: "", desc_ar: "", desc_en: "",
  price: "",
  image_url: "",
  available: "true",
  sort_order: "0",
};

type Props = { initialItems: Item[]; categories: Category[] };

export function ItemsClient({ initialItems, categories }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editId, setEditId] = useState<number | null>(null);
  const [addingCatId, setAddingCatId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<number>>(new Set());

  function refresh() { startTransition(() => router.refresh()); }

  function startEdit(item: Item) {
    setEditId(item.id);
    setAddingCatId(null);
    setForm({
      category_id: String(item.categoryId),
      name_fr: item.name.fr, name_ar: item.name.ar, name_en: item.name.en,
      desc_fr: item.description.fr, desc_ar: item.description.ar, desc_en: item.description.en,
      price: item.price,
      image_url: item.imageUrl,
      available: String(item.available),
      sort_order: String(item.sortOrder),
    });
  }

  function startAdd(catId: number) {
    setAddingCatId(catId);
    setEditId(null);
    setForm({ ...emptyForm, category_id: String(catId) });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setForm(f => ({ ...f, image_url: url }));
    }
    setUploading(false);
  }

  async function handleSave() {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (editId != null) {
      await updateItem(editId, fd);
      setEditId(null);
    } else {
      await createItem(fd);
      setAddingCatId(null);
    }
    setForm(emptyForm);
    refresh();
  }

  async function handleDelete(id: number) {
    setDeletingId(null);
    await deleteItem(id);
    refresh();
  }

  async function handleToggle(id: number, current: boolean) {
    await toggleItemAvailable(id, !current);
    refresh();
  }

  function toggleCollapse(catId: number) {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  const catName = (id: number) => categories.find(c => c.id === id)?.name.fr ?? "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-xl" style={{ color: "#1C1E21" }}>Articles</h1>
          <p className="text-sm mt-0.5" style={{ color: "#65676B" }}>{initialItems.length} article{initialItems.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => startAdd(categories[0]?.id ?? 0)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-sm text-white"
          style={{ background: "#1877F2" }}
        >
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {/* Global add form (when no category selected yet) */}
      {addingCatId != null && (
        <div className="rounded-2xl bg-white p-5 mb-4" style={{ border: "2px solid #1877F2" }}>
          <p className="font-semibold text-sm mb-4" style={{ color: "#1877F2" }}>
            Nouvel article — {catName(addingCatId)}
          </p>
          <ItemForm
            form={form}
            setForm={setForm}
            categories={categories}
            onSave={handleSave}
            onCancel={() => setAddingCatId(null)}
            onImageUpload={handleImageUpload}
            uploading={uploading}
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {categories.map(cat => {
          const catItems = initialItems.filter(i => i.categoryId === cat.id);
          const collapsed = collapsedCats.has(cat.id);

          return (
            <div key={cat.id} className="rounded-2xl bg-white overflow-hidden" style={{ border: "1px solid #E4E6EB" }}>
              {/* Category header */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: collapsed ? "none" : "1px solid #E4E6EB", background: "#FAFBFC" }}>
                <button onClick={() => toggleCollapse(cat.id)} className="flex items-center gap-2 flex-1 text-left">
                  {collapsed ? <ChevronRight size={16} color="#65676B" /> : <ChevronDown size={16} color="#65676B" />}
                  <span className="font-semibold text-sm" style={{ color: "#1C1E21" }}>{cat.name.fr}</span>
                  <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ background: "#E4E6EB", color: "#65676B" }}>{catItems.length}</span>
                </button>
                <button
                  onClick={() => startAdd(cat.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "#EBF3FF", color: "#1877F2" }}
                >
                  <Plus size={13} /> Ajouter
                </button>
              </div>

              {!collapsed && (
                <div>
                  {catItems.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm" style={{ color: "#65676B" }}>
                      Aucun article dans cette catégorie.
                    </div>
                  )}
                  {catItems.map((item, idx) => (
                    <div key={item.id} style={{ borderBottom: idx < catItems.length - 1 || editId === item.id ? "1px solid #E4E6EB" : "none" }}>
                      {/* Item row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Thumbnail */}
                        <div className="relative shrink-0 rounded-xl overflow-hidden bg-[#F0F2F5]" style={{ width: 48, height: 48 }}>
                          {item.imageUrl
                            ? <Image src={item.imageUrl} alt={item.name.fr} fill className="object-cover" sizes="48px" />
                            : <div className="absolute inset-0 flex items-center justify-center text-xs text-[#65676B]">—</div>
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: "#1C1E21" }}>{item.name.fr}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#65676B" }}>{item.name.en}</p>
                        </div>

                        {/* Price badge */}
                        <span className="text-xs font-bold rounded-lg px-2.5 py-1 shrink-0" style={{ background: "#EBF3FF", color: "#1877F2" }}>
                          {parseFloat(item.price).toFixed(2)} MAD
                        </span>

                        {/* Availability toggle */}
                        <button
                          onClick={() => handleToggle(item.id, item.available)}
                          className="relative inline-flex items-center shrink-0"
                          style={{ width: 44, height: 24, borderRadius: 12, background: item.available ? "#1877F2" : "#E4E6EB", transition: "background 200ms" }}
                        >
                          <span style={{ position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "#ffffff", left: item.available ? 22 : 3, transition: "left 200ms" }} />
                        </button>

                        {/* Edit */}
                        <button onClick={() => editId === item.id ? setEditId(null) : startEdit(item)} className="rounded-xl p-2 transition-colors hover:bg-[#F0F2F5]">
                          <Pencil size={15} color="#65676B" />
                        </button>

                        {/* Delete */}
                        {deletingId === item.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => handleDelete(item.id)} className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: "#E53935" }}>Supprimer</button>
                            <button onClick={() => setDeletingId(null)} className="rounded-xl px-2.5 py-1.5 text-xs font-semibold" style={{ background: "#F0F2F5", color: "#1C1E21" }}>Annuler</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingId(item.id)} className="rounded-xl p-2 transition-colors hover:bg-red-50">
                            <Trash2 size={15} color="#E53935" />
                          </button>
                        )}
                      </div>

                      {/* Inline edit form */}
                      {editId === item.id && (
                        <div className="px-4 pb-4" style={{ borderTop: "1px solid #E4E6EB", paddingTop: 16 }}>
                          <p className="font-semibold text-sm mb-4" style={{ color: "#1877F2" }}>Modifier — {item.name.fr}</p>
                          <ItemForm
                            form={form}
                            setForm={setForm}
                            categories={categories}
                            onSave={handleSave}
                            onCancel={() => setEditId(null)}
                            onImageUpload={handleImageUpload}
                            uploading={uploading}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemForm({
  form, setForm, categories, onSave, onCancel, onImageUpload, uploading,
}: {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  categories: Category[];
  onSave: () => void;
  onCancel: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}) {
  const fileId = `item-upload-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Category */}
      <div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Catégorie</span>
          <select
            value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            className="rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }}
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.name.fr}</option>)}
          </select>
        </label>
      </div>

      {/* Names */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LabelInput label="Nom (FR)" value={form.name_fr} onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))} />
        <LabelInput label="Nom (AR)" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} />
        <LabelInput label="Nom (EN)" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
      </div>

      {/* Descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LabelTextarea label="Description (FR)" value={form.desc_fr} onChange={e => setForm(f => ({ ...f, desc_fr: e.target.value }))} />
        <LabelTextarea label="Description (AR)" value={form.desc_ar} onChange={e => setForm(f => ({ ...f, desc_ar: e.target.value }))} />
        <LabelTextarea label="Description (EN)" value={form.desc_en} onChange={e => setForm(f => ({ ...f, desc_en: e.target.value }))} />
      </div>

      {/* Price & Sort & Available */}
      <div className="grid grid-cols-3 gap-3">
        <LabelInput label="Prix (MAD)" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} type="number" />
        <LabelInput label="Ordre" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} type="number" />
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Disponible</span>
            <select
              value={form.available}
              onChange={e => setForm(f => ({ ...f, available: e.target.value }))}
              className="rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }}
            >
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          </label>
        </div>
      </div>

      {/* Image */}
      <div className="flex gap-3 items-center">
        <label htmlFor={fileId} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer shrink-0" style={{ background: "#F0F2F5", border: "1px solid #E4E6EB", color: "#1C1E21" }}>
          <Upload size={13} /> {uploading ? "Upload..." : "Choisir une image"}
          <input id={fileId} type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
        </label>
        {form.image_url && (
          <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 44, height: 44 }}>
            <Image src={form.image_url} alt="" fill className="object-cover" sizes="44px" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "#F0F2F5", color: "#1C1E21" }}>Annuler</button>
        <button type="button" onClick={onSave} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "#1877F2" }}>Enregistrer</button>
      </div>
    </div>
  );
}

function LabelInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: "#65676B" }}>{label}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }} onFocus={e => e.target.style.borderColor = "#1877F2"} onBlur={e => e.target.style.borderColor = "#E4E6EB"} />
    </label>
  );
}

function LabelTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: "#65676B" }}>{label}</span>
      <textarea value={value} onChange={onChange} placeholder={placeholder} rows={2} className="rounded-xl px-3 py-2 text-sm outline-none resize-none" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }} onFocus={e => e.target.style.borderColor = "#1877F2"} onBlur={e => e.target.style.borderColor = "#E4E6EB"} />
    </label>
  );
}
