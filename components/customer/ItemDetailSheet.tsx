"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "@/lib/use-media-query";
import { useCartStore } from "@/store/cart";
import type { MenuItem, MenuOptionGroup } from "@/types/menu";

type Props = {
  item: MenuItem | null;
  locale: string;
  onClose: () => void;
};

type SelectedOptions = Record<number, number[]>; // groupId → optionIds

export function ItemDetailSheet({ item, locale, onClose }: Props) {
  const t = useTranslations();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const addEntry = useCartStore((s) => s.addEntry);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<SelectedOptions>({});
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const [sheetEntered, setSheetEntered] = useState(false);

  const loc = locale as "fr" | "ar" | "en";
  const isOpen = !!item;

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setQuantity(1);
      // Pre-select first option of required single-select groups
      const defaults: SelectedOptions = {};
      item.optionGroups.forEach((g) => {
        if (g.required && g.maxSelect === 1 && g.options.length > 0) {
          defaults[g.id] = [g.options[0].id];
        } else {
          defaults[g.id] = [];
        }
      });
      setSelected(defaults);
    }
  }, [item]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Slide-up entrance: paint off-screen first, then transition in
  useEffect(() => {
    if (!item) {
      setSheetEntered(false);
      return;
    }
    setSheetEntered(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setSheetEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [item]);

  function getOptionPrice(): number {
    if (!item) return 0;
    return item.optionGroups.reduce((sum, g) => {
      const chosenIds = selected[g.id] ?? [];
      const chosen = g.options.filter((o) => chosenIds.includes(o.id));
      // Sort cheapest first — cheapest fill the free slots
      const sorted = [...chosen].sort((a, b) => a.extraPrice - b.extraPrice);
      const paid = sorted.slice(g.freeSelections);
      return sum + paid.reduce((s, o) => s + o.extraPrice, 0);
    }, 0);
  }

  /** IDs of options that are currently "free" in a group (cheapest freeSelections selected) */
  function getFreeOptionIds(g: import("@/types/menu").MenuOptionGroup): Set<number> {
    const chosenIds = selected[g.id] ?? [];
    const chosen = g.options.filter((o) => chosenIds.includes(o.id));
    const sorted = [...chosen].sort((a, b) => a.extraPrice - b.extraPrice);
    return new Set(sorted.slice(0, g.freeSelections).map((o) => o.id));
  }

  const unitPrice = item ? item.price + getOptionPrice() : 0;
  const totalPrice = unitPrice * quantity;

  function toggleOption(group: MenuOptionGroup, optionId: number) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      let next: SelectedOptions;

      if (group.maxSelect === 1) {
        next = { ...prev, [group.id]: [optionId] };
      } else if (current.includes(optionId)) {
        next = { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      } else if (current.length >= group.maxSelect) {
        return prev;
      } else {
        next = { ...prev, [group.id]: [...current, optionId] };
      }

      // Clear selections for any groups that are now hidden
      item?.optionGroups.forEach((g) => {
        const cond = g.visibilityCondition;
        if (!cond) return;
        const depGroup = item.optionGroups.find((dg) => dg.name.fr === cond.groupFr);
        if (!depGroup) return;
        const chosenInDep = g.id === group.id ? (next[group.id] ?? []) : (next[depGroup.id] ?? []);
        const visible = depGroup.options.some((o) => chosenInDep.includes(o.id) && o.name.fr.startsWith(cond.optionFr));
        if (!visible) next[g.id] = [];
      });

      return next;
    });
  }

  function isGroupVisible(group: MenuOptionGroup): boolean {
    const cond = group.visibilityCondition;
    if (!cond || !item) return true;
    const depGroup = item.optionGroups.find((g) => g.name.fr === cond.groupFr);
    if (!depGroup) return false;
    const chosenIds = selected[depGroup.id] ?? [];
    return depGroup.options.some((o) => chosenIds.includes(o.id) && o.name.fr.startsWith(cond.optionFr));
  }

  function handleAdd() {
    if (!item) return;
    const chosenOptions = item.optionGroups.flatMap((g) =>
      (selected[g.id] ?? []).map((optId) => {
        const opt = g.options.find((o) => o.id === optId)!;
        return {
          optionId: opt.id,
          optionName: opt.name,
          extraPrice: opt.extraPrice,
        };
      }),
    );
    const allOptionIds = chosenOptions.map((o) => o.optionId);
    addEntry({
      itemId: item.id,
      itemName: item.name,
      itemImage: item.imageUrl,
      basePrice: item.price,
      quantity,
      chosenOptions,
      optionIds: allOptionIds,
    });
    onClose();
  }

  // Touch drag to close
  function handleTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (startYRef.current === null) return;
    const delta = e.changedTouches[0].clientY - startYRef.current;
    if (delta > 80) onClose();
    startYRef.current = null;
  }

  if (!item) return null;

  const name = item.name[loc] ?? item.name.fr;
  const description = item.description[loc] ?? item.description.fr;

  const sheetTransition = isDesktop
    ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease-out"
    : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)";
  const overlayOpacity = sheetEntered ? 1 : 0;

  const panelStyle: React.CSSProperties = isDesktop
    ? {
        maxHeight: "min(85vh, 720px)",
        left: "50%",
        top: "50%",
        right: "auto",
        bottom: "auto",
        width: "min(100vw - 48px, 480px)",
        transform: sheetEntered
          ? "translate(-50%, -50%) scale(1)"
          : "translate(-50%, -50%) scale(0.96)",
        opacity: sheetEntered ? 1 : 0,
        transition: sheetTransition,
        willChange: "transform, opacity",
        background: "#ffffff",
        borderRadius: 16,
      }
    : {
        maxHeight: "90vh",
        transform: sheetEntered
          ? "translate3d(0,0,0)"
          : "translate3d(0,100%,0)",
        transition: sheetTransition,
        willChange: "transform",
        background: "#ffffff",
        borderRadius: "16px 16px 0 0",
      };

  const addButton = (
    <button
      type="button"
      onClick={handleAdd}
      className="w-full font-semibold text-white transition-opacity active:opacity-80"
      style={{
        height: 48,
        background: "#1877F2",
        borderRadius: 8,
        fontSize: 16,
      }}
    >
      {t("sheet.addToCart")} — {totalPrice.toFixed(2)} MAD
    </button>
  );

  const detailMain = (
    <>
      <div className="px-4 pb-2 pt-5">
        <div
          className="relative w-full overflow-hidden"
          style={{ borderRadius: 14, aspectRatio: "3/2" }}
        >
          <Image
            src={
              item.imageUrl ||
              "https://placehold.co/800x450/1877F2/white?text=FaceBurger"
            }
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 1023px) calc(100vw - 32px), 432px"
          />
        </div>
      </div>

      <div className="pb-4">
        <h2
          className="font-bold"
          style={{ fontSize: 18, color: "#1C1E21", padding: "16px 16px 4px" }}
        >
          {name}
        </h2>

        {description && (
          <p
            style={{
              fontSize: 14,
              color: "#65676B",
              padding: "0 16px 12px",
            }}
          >
            {description}
          </p>
        )}

        <p
          className="font-bold"
          style={{ fontSize: 16, color: "#1877F2", padding: "0 16px 12px" }}
        >
          {item.price.toFixed(2)} MAD
        </p>

        {item.optionGroups.map((group) => {
          if (!isGroupVisible(group)) return null;

          const groupName = group.name[loc] ?? group.name.fr;
          const chosenIds = selected[group.id] ?? [];
          return (
            <div key={group.id} style={{ padding: "0 16px 16px" }}>
              <div className="mb-2 flex items-center gap-2">
                <p
                  className="font-semibold uppercase"
                  style={{ fontSize: 12, color: "#65676B", letterSpacing: "0.05em" }}
                >
                  {groupName}
                  {group.required && (
                    <span className="ms-1" style={{ color: "#E53935" }}>*</span>
                  )}
                </p>
                {group.freeSelections > 0 && (
                  <span
                    className="rounded-md px-1.5 py-0.5 font-semibold"
                    style={{ fontSize: 10, background: "#E6F4EA", color: "#2E7D32" }}
                  >
                    {group.freeSelections === 1
                      ? "1 incluse"
                      : `${group.freeSelections} incluses`}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {group.options.map((opt) => {
                  const optName = opt.name[loc] ?? opt.name.fr;
                  const isChecked = chosenIds.includes(opt.id);
                  const isRadio = group.maxSelect === 1;
                  const freeIds = group.freeSelections > 0 ? getFreeOptionIds(group) : null;
                  const isFree = isChecked && freeIds?.has(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg py-2 px-3"
                      style={{
                        background: isChecked ? "#EBF3FF" : "#F0F2F5",
                      }}
                    >
                      <input
                        type={isRadio ? "radio" : "checkbox"}
                        checked={isChecked}
                        onChange={() => toggleOption(group, opt.id)}
                        className="accent-[#1877F2]"
                        style={{ width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 14, color: "#1C1E21", flex: 1 }}>
                        {optName}
                      </span>
                      {isFree ? (
                        <span
                          className="font-semibold"
                          style={{ fontSize: 12, color: "#2E7D32" }}
                        >
                          Incluse
                        </span>
                      ) : opt.extraPrice > 0 ? (
                        <span
                          className="font-semibold"
                          style={{ fontSize: 13, color: "#1877F2" }}
                        >
                          +{opt.extraPrice.toFixed(2)} MAD
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-center gap-4 py-4">
          <button
            type="button"
            onClick={() =>
              quantity > 1
                ? setQuantity((q) => Math.max(1, q - 1))
                : onClose()
            }
            className="flex items-center justify-center font-bold"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #E4E6EB",
              fontSize: 20,
              color: quantity > 1 ? "#1C1E21" : "#65676B",
            }}
            aria-label={
              quantity > 1
                ? t("sheet.decreaseQty")
                : t("sheet.dismissItem")
            }
          >
            {quantity > 1 ? (
              "−"
            ) : (
              <Trash2 size={16} strokeWidth={2.25} />
            )}
          </button>
          <span
            className="font-semibold"
            style={{ fontSize: 18, minWidth: 32, textAlign: "center", color: "#1C1E21" }}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="flex items-center justify-center font-bold"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #E4E6EB",
              fontSize: 20,
              color: "#1C1E21",
            }}
          >
            +
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50"
        style={{
          background: "rgba(0,0,0,0.5)",
          opacity: overlayOpacity,
          transition: "opacity 320ms ease-out",
          pointerEvents: sheetEntered ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden={!sheetEntered}
      />

      {/* Sheet — bottom sheet on mobile; centered modal on desktop */}
      <div
        ref={sheetRef}
        className={
          isDesktop
            ? "fixed z-50 flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#18181b] dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            : "fixed bottom-0 left-0 right-0 z-50 w-full max-w-none overflow-hidden"
        }
        style={panelStyle}
        onTouchStart={isDesktop ? undefined : handleTouchStart}
        onTouchEnd={isDesktop ? undefined : handleTouchEnd}
      >
        {/* Close — same horizontal inset as menu cards (16px) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F2F5] text-[#65676B] shadow-sm transition-opacity active:opacity-70 dark:bg-[#3a3b3d] dark:text-[#e4e6eb]"
          aria-label="Close"
        >
          <X size={20} strokeWidth={2.25} />
        </button>

        {/* Drag handle — mobile bottom sheet only */}
        {!isDesktop ? (
          <div className="flex justify-center pb-1 pt-2">
            <div
              style={{
                width: 40,
                height: 4,
                background: "#E4E6EB",
                borderRadius: 2,
              }}
            />
          </div>
        ) : null}

        <div className="flex flex-col" style={{ maxHeight: isDesktop ? "min(85vh, 720px)" : "calc(90vh - 16px)" }}>
          <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto">
            {detailMain}
          </div>
          <div
            className="relative z-10 shrink-0 border-t border-[#E4E6EB] bg-white dark:border-[#27272a] dark:bg-[#18181b]"
            style={{ padding: "16px 16px max(16px, env(safe-area-inset-bottom))" }}
          >
            {addButton}
          </div>
        </div>
      </div>
    </>
  );
}
