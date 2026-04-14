"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/store/cart";

type Props = {
  onOpen: () => void;
};

export function FloatingCartButton({ onOpen }: Props) {
  const t = useTranslations("cart");
  const totalCount = useCartStore((s) => s.totalCount());
  const total = useCartStore((s) => s.totalPrice());
  const clearCart = useCartStore((s) => s.clearCart);

  if (totalCount === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="mx-auto flex w-full max-w-[480px] items-center justify-center gap-2 lg:max-w-[1200px]">
        <button
          type="button"
          onClick={onOpen}
          className="flex h-[52px] w-auto max-w-[min(100%,340px)] min-w-0 shrink items-center justify-between gap-3 rounded-2xl bg-[#1877F2] px-5 text-white shadow-lg shadow-[#1877F2]/25 transition-opacity active:opacity-90"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ShoppingBag className="h-[18px] w-[18px] shrink-0 opacity-90" strokeWidth={2} />
            <span className="truncate text-[15px] font-medium">
              {t("viewCart")}
            </span>
          </span>
          <span className="shrink-0 text-[15px] font-semibold tabular-nums">
            {total.toFixed(2)} {t("currency")}
          </span>
        </button>

        <button
          type="button"
          onClick={clearCart}
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-[#e4e4e7] bg-white text-[20px] font-light leading-none text-[#71717a] transition-colors active:bg-[#f4f4f5] dark:border-[#3f3f46] dark:bg-[#27272a] dark:text-[#a1a1aa] dark:active:bg-[#3f3f46]"
          aria-label={t("clear")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
