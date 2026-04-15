"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Zap } from "lucide-react";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addTemplateOption,
  updateTemplateOption,
  deleteTemplateOption,
  applyTemplateToItems,
  getItemsWithTemplateApplied,
  removeTemplateFromItems,
  reorderTemplates,
  reorderTemplateOptions,
} from "@/actions/addonTemplates";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

/* ─── Types ─────────────────────────────────────────── */
type Item = { id: number; name: { fr: string; ar: string; en: string }; categoryId: number };
type Category = { id: number; name: { fr: string; ar: string; en: string } };
type TmplOption = { id: number; templateId: number; name: { fr: string; ar: string; en: string }; extraPrice: string };
type Template = { id: number; name: { fr: string; ar: string; en: string }; required: boolean; minSelect: number; maxSelect: number; options: TmplOption[] };

const emptyGroup = { name_fr: "", name_ar: "", name_en: "", required: "false", min_select: "0", max_select: "1", free_selections: "0", condition_group_fr: "", condition_option_fr: "" };
const emptyOpt   = { name_fr: "", name_ar: "", name_en: "", extra_price: "0" };

/* ─── Main component ─────────────────────────────────── */
export function OptionsClient({
  items,
  categories,
  templates: initialTemplates,
}: {
  items: Item[];
  categories: Category[];
  templates: Template[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-xl" style={{ color: "#1C1E21" }}>Options & Accompagnements</h1>
        </div>
      </div>

      <TemplatesTab
        initialTemplates={initialTemplates}
        items={items}
        categories={categories}
      />
    </div>
  );
}

/* ─── Templates tab ──────────────────────────────────── */
function TemplatesTab({
  initialTemplates,
  items,
  categories,
}: {
  initialTemplates: Template[];
  items: Item[];
  categories: Category[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [templates, setTemplates] = useState(initialTemplates);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [tmplForm, setTmplForm] = useState(emptyGroup);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [alreadyAppliedItems, setAlreadyAppliedItems] = useState<Set<number>>(new Set());
  const [removedItems, setRemovedItems] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  // Inline option adding per template
  const [addingOptFor, setAddingOptFor] = useState<number | null>(null);
  const [editOptId, setEditOptId] = useState<number | null>(null);
  const [optForm, setOptForm] = useState(emptyOpt);

  function refresh() {
    startTransition(async () => {
      const fresh = await getTemplates();
      setTemplates(fresh as unknown as Template[]);
      router.refresh();
    });
  }

  async function handleCreateTemplate() {
    const fd = new FormData();
    Object.entries(tmplForm).forEach(([k, v]) => fd.append(k, v));
    await createTemplate(fd);
    setShowAdd(false); setTmplForm(emptyGroup);
    refresh();
  }

  async function handleUpdateTemplate() {
    if (editId == null) return;
    const fd = new FormData();
    Object.entries(tmplForm).forEach(([k, v]) => fd.append(k, v));
    await updateTemplate(editId, fd);
    setEditId(null);
    refresh();
  }

  async function handleDeleteTemplate(id: number) {
    await deleteTemplate(id);
    refresh();
  }

  async function moveTemplate(id: number, dir: -1 | 1) {
    const idx = templates.findIndex(t => t.id === id);
    const next = idx + dir;
    if (next < 0 || next >= templates.length) return;
    const reordered = [...templates];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    setTemplates(reordered);
    await reorderTemplates(reordered.map(t => t.id));
  }

  async function moveOption(templateId: number, optId: number, dir: -1 | 1) {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    const idx = tmpl.options.findIndex(o => o.id === optId);
    const next = idx + dir;
    if (next < 0 || next >= tmpl.options.length) return;
    const reordered = [...tmpl.options];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, options: reordered } : t));
    await reorderTemplateOptions(reordered.map(o => o.id));
  }

  async function handleAddOpt(templateId: number) {
    const fd = new FormData();
    Object.entries(optForm).forEach(([k, v]) => fd.append(k, v));
    await addTemplateOption(templateId, fd);
    setAddingOptFor(null); setOptForm(emptyOpt);
    refresh();
  }

  async function handleUpdateOpt() {
    if (editOptId == null) return;
    const fd = new FormData();
    Object.entries(optForm).forEach(([k, v]) => fd.append(k, v));
    await updateTemplateOption(editOptId, fd);
    setEditOptId(null);
    refresh();
  }

  async function handleDeleteOpt(id: number) {
    await deleteTemplateOption(id);
    refresh();
  }

  async function handleApply(templateId: number) {
    if (selectedItems.size === 0 && removedItems.size === 0) return;
    setApplying(true);
    if (removedItems.size > 0) {
      await removeTemplateFromItems(templateId, Array.from(removedItems));
    }
    if (selectedItems.size > 0) {
      await applyTemplateToItems(templateId, Array.from(selectedItems));
    }
    setApplying(false);
    setApplyingId(null);
    setSelectedItems(new Set());
    setAlreadyAppliedItems(new Set());
    setRemovedItems(new Set());
    refresh();
  }

  async function openApplyPanel(templateId: number) {
    if (applyingId === templateId) {
      setApplyingId(null);
      setSelectedItems(new Set());
      setAlreadyAppliedItems(new Set());
      setRemovedItems(new Set());
      return;
    }
    const existingItemIds = await getItemsWithTemplateApplied(templateId);
    setAlreadyAppliedItems(new Set(existingItemIds));
    setSelectedItems(new Set());
    setRemovedItems(new Set());
    setApplyingId(templateId);
  }

  function toggleItem(id: number) {
    if (alreadyAppliedItems.has(id)) {
      setRemovedItems(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      return;
    }
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCategory(catId: number) {
    const catItems = items.filter(i => i.categoryId === catId).map(i => i.id);
    const isChecked = (id: number) =>
      (alreadyAppliedItems.has(id) && !removedItems.has(id)) || selectedItems.has(id);
    const allSelected = catItems.length > 0 && catItems.every(isChecked);

    setSelectedItems(prevSelected => {
      const nextSelected = new Set(prevSelected);
      setRemovedItems(prevRemoved => {
        const nextRemoved = new Set(prevRemoved);
        catItems.forEach(id => {
          if (alreadyAppliedItems.has(id)) {
            if (allSelected) nextRemoved.add(id);
            else nextRemoved.delete(id);
          } else if (allSelected) {
            nextSelected.delete(id);
          } else {
            nextSelected.add(id);
          }
        });
        return nextRemoved;
      });
      return nextSelected;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!showAdd && editId == null && (
        <div className="flex justify-start">
          <button
            onClick={() => { setShowAdd(true); setTmplForm(emptyGroup); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-sm text-white"
            style={{ background: "#1877F2" }}
          >
            <Plus size={15} /> Nouveau modèle
          </button>
        </div>
      )}

      {showAdd && (
        <div className="rounded-2xl bg-white p-5" style={{ border: "2px solid #1877F2" }}>
          <p className="font-semibold text-sm mb-4" style={{ color: "#1877F2" }}>Nouveau modèle d'accompagnement</p>
          <GroupFormFields form={tmplForm} setForm={setTmplForm} onSave={handleCreateTemplate} onCancel={() => setShowAdd(false)} allTemplates={templates} />
        </div>
      )}

      {templates.length === 0 && !showAdd && (
        <div className="rounded-2xl bg-white p-10 text-center" style={{ border: "2px dashed #E4E6EB" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#1C1E21" }}>Aucun modèle</p>
          <p className="text-sm" style={{ color: "#65676B" }}>Créez un modèle comme "Frites" ou "Boisson" puis appliquez-le à plusieurs articles en un clic.</p>
        </div>
      )}

      {templates.map(tmpl => (
        <div key={tmpl.id} className="rounded-2xl bg-white overflow-hidden" style={{ border: "1px solid #E4E6EB" }}>
          {/* Template header */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid #E4E6EB", background: "#FAFBFC" }}>
            {editId === tmpl.id ? null : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: "#1C1E21" }}>{tmpl.name.fr}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#65676B" }}>
                    {tmpl.required ? "Requis" : "Optionnel"} · {tmpl.maxSelect === 1 ? "Choix unique" : "Choix multiple"} · {tmpl.options.length} option{tmpl.options.length !== 1 ? "s" : ""}
                    {(tmpl as any).visibilityCondition && (
                      <span className="ms-2 rounded-md px-1.5 py-0.5 text-xs font-medium" style={{ background: "#EBF3FF", color: "#1877F2" }}>
                        Si {(tmpl as any).visibilityCondition.groupFr} → {(tmpl as any).visibilityCondition.optionFr}
                      </span>
                    )}
                  </p>
                </div>
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveTemplate(tmpl.id, -1)} className="rounded p-0.5 hover:bg-[#F0F2F5]" disabled={templates.indexOf(tmpl) === 0}><ChevronUp size={14} color="#65676B" /></button>
                  <button onClick={() => moveTemplate(tmpl.id, 1)} className="rounded p-0.5 hover:bg-[#F0F2F5]" disabled={templates.indexOf(tmpl) === templates.length - 1}><ChevronDown size={14} color="#65676B" /></button>
                </div>
                {/* Apply button */}
                <button
                  onClick={() => openApplyPanel(tmpl.id)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
                  style={{ background: applyingId === tmpl.id ? "#1877F2" : "#EBF3FF", color: applyingId === tmpl.id ? "#fff" : "#1877F2" }}
                >
                  <Zap size={13} /> Appliquer
                </button>
                <button
                  onClick={() => { setEditId(tmpl.id); setTmplForm({ name_fr: tmpl.name.fr, name_ar: tmpl.name.ar, name_en: tmpl.name.en, required: String(tmpl.required), min_select: String(tmpl.minSelect), max_select: String(tmpl.maxSelect), free_selections: String((tmpl as any).freeSelections ?? 0), condition_group_fr: (tmpl as any).visibilityCondition?.groupFr ?? "", condition_option_fr: (tmpl as any).visibilityCondition?.optionFr ?? "" }); }}
                  className="rounded-xl p-2 hover:bg-[#F0F2F5] transition-colors"
                >
                  <Pencil size={15} color="#65676B" />
                </button>
                <button onClick={() => handleDeleteTemplate(tmpl.id)} className="rounded-xl p-2 hover:bg-red-50 transition-colors">
                  <Trash2 size={15} color="#E53935" />
                </button>
              </>
            )}
            {editId === tmpl.id && (
              <div className="flex-1">
                <p className="font-semibold text-sm mb-3" style={{ color: "#1877F2" }}>Modifier — {tmpl.name.fr}</p>
                <GroupFormFields form={tmplForm} setForm={setTmplForm} onSave={handleUpdateTemplate} onCancel={() => setEditId(null)} allTemplates={templates} />
              </div>
            )}
          </div>

          {/* Apply panel */}
          {applyingId === tmpl.id && editId !== tmpl.id && (
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #E4E6EB", background: "#F0F6FF" }}>
              <p className="font-semibold text-sm mb-3" style={{ color: "#1877F2" }}>
                Choisir les articles qui recevront « {tmpl.name.fr} »
              </p>
              <div className="flex flex-col gap-3 mb-4">
                {categories.map(cat => {
                  const catItems = items.filter(i => i.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  const allChecked =
                    catItems.length > 0 &&
                    catItems.every(
                      i =>
                        (alreadyAppliedItems.has(i.id) && !removedItems.has(i.id)) ||
                        selectedItems.has(i.id)
                    );
                  return (
                    <div key={cat.id}>
                      {/* Category row */}
                      <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={() => toggleCategory(cat.id)}
                          className="rounded"
                          style={{ width: 16, height: 16, accentColor: "#1877F2" }}
                        />
                        <span className="font-semibold text-sm" style={{ color: "#1C1E21" }}>{cat.name.fr}</span>
                        <span className="text-xs" style={{ color: "#65676B" }}>({catItems.length} articles)</span>
                      </label>
                      {/* Item rows */}
                      <div className="flex flex-col gap-1 ml-6">
                        {catItems.map(item => (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                (alreadyAppliedItems.has(item.id) && !removedItems.has(item.id)) ||
                                selectedItems.has(item.id)
                              }
                              onChange={() => toggleItem(item.id)}
                              style={{ width: 15, height: 15, accentColor: "#1877F2" }}
                            />
                            <span className="text-sm" style={{ color: "#1C1E21" }}>{item.name.fr}</span>
                            {alreadyAppliedItems.has(item.id) && (
                              <span
                                className="text-xs font-medium"
                                style={{ color: removedItems.has(item.id) ? "#E53935" : "#65676B" }}
                              >
                                {removedItems.has(item.id) ? "Sera dissocié" : "Déjà associé"}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleApply(tmpl.id)}
                  disabled={(selectedItems.size === 0 && removedItems.size === 0) || applying}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "#1877F2" }}
                >
                  <Zap size={13} />
                  {applying
                    ? "Mise à jour..."
                    : `Appliquer: ${selectedItems.size} · Retirer: ${removedItems.size}`}
                </button>
                <button onClick={() => { setApplyingId(null); setSelectedItems(new Set()); setAlreadyAppliedItems(new Set()); setRemovedItems(new Set()); }} className="text-sm" style={{ color: "#65676B" }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Template options list */}
          {editId !== tmpl.id && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold mb-3" style={{ color: "#65676B" }}>OPTIONS DU MODÈLE</p>
              <div className="flex flex-col gap-2">
                {tmpl.options.map(opt => (
                  <div key={opt.id}>
                    {editOptId === opt.id ? (
                      <OptionFormRow
                        form={optForm}
                        setForm={setOptForm}
                        onSave={handleUpdateOpt}
                        onCancel={() => setEditOptId(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "#F0F2F5" }}>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button onClick={() => moveOption(tmpl.id, opt.id, -1)} className="rounded p-0.5 hover:bg-white" disabled={tmpl.options.indexOf(opt) === 0}><ChevronUp size={12} color="#65676B" /></button>
                          <button onClick={() => moveOption(tmpl.id, opt.id, 1)} className="rounded p-0.5 hover:bg-white" disabled={tmpl.options.indexOf(opt) === tmpl.options.length - 1}><ChevronDown size={12} color="#65676B" /></button>
                        </div>
                        <span className="flex-1 text-sm" style={{ color: "#1C1E21" }}>{opt.name.fr}</span>
                        {parseFloat(opt.extraPrice) > 0 && (
                          <span className="text-xs font-semibold rounded-lg px-2 py-1" style={{ background: "#EBF3FF", color: "#1877F2" }}>
                            +{parseFloat(opt.extraPrice).toFixed(2)} MAD
                          </span>
                        )}
                        <button onClick={() => { setEditOptId(opt.id); setOptForm({ name_fr: opt.name.fr, name_ar: opt.name.ar, name_en: opt.name.en, extra_price: opt.extraPrice }); }} className="rounded-lg p-1.5 hover:bg-white transition-colors">
                          <Pencil size={13} color="#65676B" />
                        </button>
                        <button onClick={() => handleDeleteOpt(opt.id)} className="rounded-lg p-1.5 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} color="#E53935" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {addingOptFor === tmpl.id ? (
                  <OptionFormRow
                    form={optForm}
                    setForm={setOptForm}
                    onSave={() => handleAddOpt(tmpl.id)}
                    onCancel={() => setAddingOptFor(null)}
                  />
                ) : (
                  <button
                    onClick={() => { setAddingOptFor(tmpl.id); setOptForm(emptyOpt); }}
                    className="flex items-center gap-1.5 text-sm font-medium mt-1"
                    style={{ color: "#1877F2" }}
                  >
                    <Plus size={14} /> Ajouter une option
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Shared sub-components ──────────────────────────── */
function GroupFormFields({
  form, setForm, onSave, onCancel, allTemplates = [],
}: {
  form: typeof emptyGroup;
  setForm: (f: typeof emptyGroup) => void;
  onSave: () => void;
  onCancel: () => void;
  allTemplates?: Template[];
}) {
  const isMultiple = parseInt(form.max_select) > 1;
  const [conditionEnabled, setConditionEnabled] = useState(
    !!(form.condition_group_fr || form.condition_option_fr)
  );

  function setSelectionType(multiple: boolean) {
    setForm({
      ...form,
      max_select: multiple ? "2" : "1",
      min_select: "0",
      free_selections: "0",
    });
  }

  function toggleCondition(enabled: boolean) {
    setConditionEnabled(enabled);
    if (!enabled) {
      setForm({ ...form, condition_group_fr: "", condition_option_fr: "" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {(["name_fr", "name_ar", "name_en"] as const).map(k => (
          <LabelInput key={k} label={k === "name_fr" ? "Nom (FR)" : k === "name_ar" ? "Nom (AR)" : "Nom (EN)"} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Selection type toggle */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Type de sélection</span>
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid #E4E6EB" }}>
            <button
              type="button"
              onClick={() => setSelectionType(false)}
              className="flex-1 py-2 text-sm font-semibold transition-colors"
              style={{ background: !isMultiple ? "#1877F2" : "#FAFBFC", color: !isMultiple ? "#fff" : "#65676B" }}
            >
              Choix unique
            </button>
            <button
              type="button"
              onClick={() => setSelectionType(true)}
              className="flex-1 py-2 text-sm font-semibold transition-colors"
              style={{ background: isMultiple ? "#1877F2" : "#FAFBFC", color: isMultiple ? "#fff" : "#65676B", borderLeft: "1.5px solid #E4E6EB" }}
            >
              Choix multiple
            </button>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Requis</span>
            <select value={form.required} onChange={e => setForm({ ...form, required: e.target.value, min_select: e.target.value === "true" ? "1" : "0" })} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }}>
              <option value="false">Non</option>
              <option value="true">Oui</option>
            </select>
          </label>
        </div>
      </div>

      {isMultiple && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Max. sélections</span>
            <input
              type="number"
              min={2}
              max={20}
              value={form.max_select}
              onChange={e => {
                const max = parseInt(e.target.value) || 2;
                const free = Math.min(parseInt(form.free_selections) || 0, max - 1);
                setForm({ ...form, max_select: String(max), free_selections: String(free) });
              }}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }}
              onFocus={e => e.target.style.borderColor = "#1877F2"}
              onBlur={e => e.target.style.borderColor = "#E4E6EB"}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Incluses gratuitement</span>
            <input
              type="number"
              min={0}
              max={parseInt(form.max_select) - 1}
              value={form.free_selections}
              onChange={e => setForm({ ...form, free_selections: String(Math.max(0, parseInt(e.target.value) || 0)) })}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }}
              onFocus={e => e.target.style.borderColor = "#1877F2"}
              onBlur={e => e.target.style.borderColor = "#E4E6EB"}
            />
            <span className="text-xs" style={{ color: "#9CA3AF" }}>0 = toutes payantes</span>
          </label>
        </div>
      )}

      {/* Visibility condition */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={conditionEnabled}
            onChange={e => toggleCondition(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "#1877F2" }}
          />
          <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Afficher uniquement si une option est sélectionnée</span>
        </label>

        {conditionEnabled && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: "#F0F6FF", border: "1.5px solid #C7DCFF" }}>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Dans le groupe</span>
              <select
                value={form.condition_group_fr}
                onChange={e => setForm({ ...form, condition_group_fr: e.target.value })}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ border: "1.5px solid #E4E6EB", color: form.condition_group_fr ? "#1C1E21" : "#9CA3AF", background: "#FAFBFC" }}
              >
                <option value="">— Choisir un groupe —</option>
                {allTemplates.map(t => (
                  <option key={t.id} value={t.name.fr}>{t.name.fr}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold" style={{ color: "#65676B" }}>Option sélectionnée (commence par)</span>
              <input
                type="text"
                value={form.condition_option_fr}
                onChange={e => setForm({ ...form, condition_option_fr: e.target.value })}
                placeholder="ex: Menu"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }}
                onFocus={e => e.target.style.borderColor = "#1877F2"}
                onBlur={e => e.target.style.borderColor = "#E4E6EB"}
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "#F0F2F5", color: "#1C1E21" }}>Annuler</button>
        <button type="button" onClick={onSave} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "#1877F2" }}>Enregistrer</button>
      </div>
    </div>
  );
}

function OptionFormRow({
  form, setForm, onSave, onCancel,
}: {
  form: typeof emptyOpt;
  setForm: (f: typeof emptyOpt) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-3" style={{ background: "#F7F8FA", border: "1.5px solid #E4E6EB" }}>
      <div className="grid grid-cols-4 gap-2">
        <LabelInput label="Nom (FR)" value={form.name_fr} onChange={e => setForm({ ...form, name_fr: e.target.value })} />
        <LabelInput label="Nom (AR)" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} />
        <LabelInput label="Nom (EN)" value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} />
        <LabelInput label="Prix extra (MAD)" value={form.extra_price} onChange={e => setForm({ ...form, extra_price: e.target.value })} type="number" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: "#ffffff", border: "1px solid #E4E6EB", color: "#65676B" }}>Annuler</button>
        <button onClick={onSave} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "#1877F2" }}>OK</button>
      </div>
    </div>
  );
}

function LabelInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold" style={{ color: "#65676B" }}>{label}</span>
      <input type={type} value={value} onChange={onChange} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: "1.5px solid #E4E6EB", color: "#1C1E21", background: "#FAFBFC" }} onFocus={e => e.target.style.borderColor = "#1877F2"} onBlur={e => e.target.style.borderColor = "#E4E6EB"} />
    </label>
  );
}
