"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/store/cart";
import type { MenuItem } from "@/types/menu";

type Props = {
  item: MenuItem;
  locale: string;
  onOpen: (item: MenuItem) => void;
};

/** Cart line id for an item with no selected options (matches store `makeCartId`). */
function simpleLineCartId(itemId: number) {
  return `${itemId}-`;
}

export function ItemCard({ item, locale, onOpen }: Props) {
  const t = useTranslations();
  const loc = locale as "fr" | "ar" | "en";
  const name = item.name[loc] ?? item.name.fr;
  const description = item.description[loc] ?? item.description.fr;

  const { entries, addEntry, removeEntry, setQuantity } = useCartStore();
  const hasOptions = item.optionGroups.length > 0;
  const simpleCartId = simpleLineCartId(item.id);
  const simpleEntry = entries.find((e) => e.cartId === simpleCartId);

  function addSimpleToCart(e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.available) return;
    addEntry({
      itemId: item.id,
      itemName: item.name,
      itemImage: item.imageUrl ?? "",
      basePrice: item.price,
      quantity: 1,
      chosenOptions: [],
      optionIds: [],
    });
  }

  return (
    <div
      onClick={() => item.available && hasOptions && onOpen(item)}
      className={`py-2 ${
        item.available && hasOptions ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {/* Image — 16/9, slightly smaller than before, rounded corners */}
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
          sizes="(max-width: 1023px) calc(100vw - 32px), (max-width: 1200px) 28vw, 300px"
        />

        {!item.available && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <span
              className="font-semibold text-white"
              style={{
                background: "rgba(0,0,0,0.55)",
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 13,
              }}
            >
              {t("item.unavailable")}
            </span>
          </div>
        )}
      </div>

      {/* Text — flex column so price row is always flush to the bottom */}
      <div style={{ paddingTop: 10, paddingBottom: 2 }}>
        {/* Title */}
        <p className="text-[17px] font-bold leading-snug text-[#1C1E21] dark:text-[#e4e6eb]">
          {name}
        </p>

        {/* Description */}
        {description && (
          <p
            className="mt-1 line-clamp-2 text-[14px] text-[#65676B] dark:text-[#b0b3b8]"
            style={{ lineHeight: "1.45" }}
          >
            {description}
          </p>
        )}

        {/* Price + add or quantity (simple items only) */}
        <div
          className="flex items-center justify-between"
          style={{ marginTop: 10 }}
        >
          <p
            className="font-bold"
            style={{ fontSize: 17, color: "#1877F2" }}
          >
            {item.price.toFixed(2)} MAD
          </p>

          {!item.available ? null : hasOptions ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(item);
              }}
              className="flex flex-shrink-0 items-center justify-center font-bold text-white transition-transform active:scale-90 disabled:opacity-40"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#1877F2",
                fontSize: 24,
                lineHeight: 1,
                boxShadow: "0 2px 10px rgba(24,119,242,0.35)",
              }}
            >
              +
            </button>
          ) : simpleEntry ? (
            <div
              className="flex flex-shrink-0 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {simpleEntry.quantity > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      simpleCartId,
                      simpleEntry.quantity - 1,
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E6EB] bg-white text-lg font-medium text-[#1C1E21] dark:border-[#3e4042] dark:bg-[#2d2f31] dark:text-[#e4e6eb]"
                >
                  −
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => removeEntry(simpleCartId)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E6EB] bg-white text-[#65676B] dark:border-[#3e4042] dark:bg-[#2d2f31] dark:text-[#b0b3b8]"
                  aria-label={t("cart.remove")}
                >
                  <Trash2 size={16} strokeWidth={2.25} />
                </button>
              )}
              <span className="min-w-[24px] text-center text-[15px] font-semibold text-[#1C1E21] dark:text-[#e4e6eb]">
                {simpleEntry.quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity(simpleCartId, simpleEntry.quantity + 1)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E6EB] bg-white text-lg font-medium text-[#1C1E21] dark:border-[#3e4042] dark:bg-[#2d2f31] dark:text-[#e4e6eb]"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={addSimpleToCart}
              className="flex flex-shrink-0 items-center justify-center font-bold text-white transition-transform active:scale-90"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#1877F2",
                fontSize: 24,
                lineHeight: 1,
                boxShadow: "0 2px 10px rgba(24,119,242,0.35)",
              }}
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
