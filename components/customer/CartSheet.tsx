"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMediaQuery } from "@/lib/use-media-query";
import { useCartStore, entryTotal, getOptionExtraPrice } from "@/store/cart";

type Props = {
  isOpen: boolean;
  locale: string;
  onClose: () => void;
};

export function CartSheet({ isOpen, locale, onClose }: Props) {
  const t = useTranslations();
  const loc = locale as "fr" | "ar" | "en";
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const { entries, removeEntry, setQuantity, totalPrice } = useCartStore();

  const [sheetEntered, setSheetEntered] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen]);

  function handleTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (startYRef.current === null) return;
    const delta = e.changedTouches[0].clientY - startYRef.current;
    if (delta > 80) onClose();
    startYRef.current = null;
  }

  if (!isOpen) return null;

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
        width: "min(100vw - 48px, 440px)",
        transform: sheetEntered
          ? "translate(-50%, -50%) scale(1)"
          : "translate(-50%, -50%) scale(0.96)",
        opacity: sheetEntered ? 1 : 0,
        transition: sheetTransition,
        willChange: "transform, opacity",
      }
    : {
        maxHeight: "90vh",
        transform: sheetEntered
          ? "translate3d(0,0,0)"
          : "translate3d(0,100%,0)",
        transition: sheetTransition,
        willChange: "transform",
      };

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{
          background: "rgba(0,0,0,0.45)",
          opacity: overlayOpacity,
          transition: "opacity 320ms ease-out",
          pointerEvents: sheetEntered ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden={!sheetEntered}
      />

      <div
        className={`sheet-scroll fixed z-50 flex w-full flex-col overflow-hidden bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.08)] dark:bg-[#18181b] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.4)] ${
          isDesktop
            ? "min-h-0 rounded-2xl shadow-2xl dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            : "bottom-0 left-0 right-0 max-h-[90vh] rounded-t-[20px]"
        }`}
        style={panelStyle}
        onTouchStart={isDesktop ? undefined : handleTouchStart}
        onTouchEnd={isDesktop ? undefined : handleTouchEnd}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 z-[60] flex h-9 w-9 items-center justify-center rounded-full text-[#71717a] transition-colors hover:bg-[#f4f4f5] active:bg-[#e4e4e7] dark:text-[#a1a1aa] dark:hover:bg-[#27272a] dark:active:bg-[#3f3f46]"
          aria-label={t("cart.close")}
        >
          <X size={20} strokeWidth={2} />
        </button>

        <div
          className={`flex justify-center pb-2 pt-2.5 ${isDesktop ? "hidden" : ""}`}
        >
          <div className="h-1 w-10 rounded-full bg-[#e4e4e7] dark:bg-[#3f3f46]" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-center gap-1 px-3 pb-4 pt-5">
            <div className="w-9 shrink-0" aria-hidden />
            <h2 className="min-w-0 flex-1 text-center text-[24px] font-bold tracking-tight text-[#18181b] dark:text-[#fafafa]">
              {t("cart.heading")}
            </h2>
            <div className="w-9 shrink-0" aria-hidden />
          </div>

          {entries.length === 0 ? (
            <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center px-6 pb-8 pt-2">
              <p className="text-center text-[14px] text-[#71717a] dark:text-[#a1a1aa]">
                {t("cart.empty")}
              </p>
            </div>
          ) : (
            <div
              className={`min-h-0 flex-1 overflow-y-auto px-4 pt-0 ${
                isDesktop ? "pb-4" : "pb-48"
              }`}
            >
              <ul className="divide-y divide-[#f4f4f5] dark:divide-[#27272a]">
                {entries.map((entry) => {
                  const name = entry.itemName[loc] ?? entry.itemName.fr;
                  const lineTotal = entryTotal(entry);
                  const imgSrc =
                    entry.itemImage ||
                    "https://placehold.co/200x200/1877F2/white?text=FB";
                  return (
                    <li key={entry.cartId} className="py-4 first:pt-2">
                      <div className="flex gap-4">
                        <div className="relative h-20 w-20 shrink-0 self-start overflow-hidden rounded-xl bg-[#f4f4f5] ring-1 ring-inset ring-black/[0.04] dark:bg-[#27272a] dark:ring-white/[0.06]">
                          <Image
                            src={imgSrc}
                            alt={name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>

                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-medium leading-snug text-[#18181b] dark:text-[#fafafa]">
                              {name}
                            </p>

                            {entry.chosenOptions.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {entry.chosenOptions.map((o) => {
                                  const optionExtraPrice = getOptionExtraPrice(entry, o.optionId);
                                  return (
                                  <li
                                    key={o.optionId}
                                    className="text-[12px] leading-snug text-[#71717a] dark:text-[#a1a1aa]"
                                  >
                                    {o.optionName[loc] ?? o.optionName.fr}
                                    {optionExtraPrice > 0 && (
                                      <span className="text-[#1877F2]">
                                        {" "}(+{optionExtraPrice.toFixed(2)} {t("cart.currency")})
                                      </span>
                                    )}
                                  </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <p className="text-[15px] font-semibold tabular-nums text-[#18181b] dark:text-[#fafafa]">
                              {lineTotal.toFixed(2)} {t("cart.currency")}
                            </p>

                            <div className="inline-flex h-7 items-stretch overflow-hidden rounded-md border border-[#d4d4d8] bg-white dark:border-[#52525b] dark:bg-[#27272a]">
                              {entry.quantity > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => setQuantity(entry.cartId, entry.quantity - 1)}
                                  className="flex w-7 items-center justify-center text-[15px] font-medium leading-none text-[#18181b] transition-colors active:bg-[#f4f4f5] dark:text-[#fafafa] dark:active:bg-[#3f3f46]"
                                >
                                  −
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => removeEntry(entry.cartId)}
                                  className="flex w-7 items-center justify-center text-[#71717a] transition-colors active:bg-[#f4f4f5] dark:text-[#a1a1aa] dark:active:bg-[#3f3f46]"
                                  aria-label={t("cart.remove")}
                                >
                                  <Trash2 size={13} strokeWidth={2} />
                                </button>
                              )}
                              <span className="flex min-w-[1.5rem] items-center justify-center border-x border-[#d4d4d8] px-1 text-[12px] font-semibold tabular-nums text-[#18181b] dark:border-[#52525b] dark:text-[#fafafa]">
                                {entry.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuantity(entry.cartId, entry.quantity + 1)}
                                className="flex w-7 items-center justify-center text-[15px] font-medium leading-none text-[#18181b] transition-colors active:bg-[#f4f4f5] dark:text-[#fafafa] dark:active:bg-[#3f3f46]"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {entries.length > 0 ? (
            <div
              className={`z-10 border-t border-[#f4f4f5] bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md dark:border-[#27272a] dark:bg-[#18181b]/95 ${
                isDesktop
                  ? "relative shrink-0 rounded-b-2xl"
                  : "fixed bottom-0 left-0 right-0"
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[15px] font-semibold text-[#27272a] dark:text-[#e4e4e7]">
                  {t("cart.total")}
                </span>
                <span className="text-[20px] font-semibold tabular-nums tracking-tight text-[#18181b] dark:text-[#fafafa]">
                  {totalPrice().toFixed(2)} {t("cart.currency")}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#a1a1aa] dark:text-[#71717a]">
                {t("cart.feesNote")}
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/checkout");
                }}
                className="mt-4 w-full rounded-xl bg-[#1877F2] py-3.5 text-[15px] font-semibold text-white transition-opacity active:opacity-90"
              >
                {t("cart.order")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
