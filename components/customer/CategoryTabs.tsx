"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { MenuCategory } from "@/types/menu";

type Props = {
  categories: MenuCategory[];
  locale: string;
};

const FALLBACK_BG =
  "linear-gradient(135deg, #52525b 0%, #3f3f46 50%, #27272a 100%)";

const CARD_H = 48;
const CARD_W = 140;
const GAP = 12; // gap-3

export function CategoryTabs({ categories, locale }: Props) {
  const [activeId, setActiveId] = useState<number>(categories[0]?.id ?? 0);
  const activeIdRef = useRef<number>(categories[0]?.id ?? 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0);


  function getCategoryName(cat: MenuCategory) {
    const names = cat.name as { fr: string; ar: string; en: string };
    return names[locale as "fr" | "ar" | "en"] ?? names.fr;
  }

  /**
   * Scroll the strip so the active card is the first visible card in the
   * scrollable area (= second card overall, right after the pinned first).
   * Card at index i in the full list → index (i-1) in restCats.
   * Target scrollLeft = (i-1) * (CARD_W + GAP).
   */
  function scrollStripTo(catId: number) {
    const container = scrollRef.current;
    if (!container) return;

    const idx = categories.findIndex((c) => c.id === catId);
    if (idx <= 0) {
      container.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    const target = idx * (CARD_W + GAP);
    const max = Math.max(0, container.scrollWidth - container.clientWidth);
    container.scrollTo({ left: Math.min(max, target), behavior: "smooth" });
  }

  // Page scroll → detect active section → update strip
  useEffect(() => {
    function onScroll() {
      if (Date.now() < lockUntil.current) return;

      const line = (stickyRef.current?.getBoundingClientRect().bottom ?? 96) + 8;
      let nextId = categories[0]?.id ?? 0;
      for (let i = categories.length - 1; i >= 0; i--) {
        const el = document.getElementById(`category-${categories[i].id}`);
        if (el && el.getBoundingClientRect().top <= line) {
          nextId = categories[i].id;
          break;
        }
      }

      if (nextId !== activeIdRef.current) {
        activeIdRef.current = nextId;
        setActiveId(nextId);
        scrollStripTo(nextId);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick(catId: number) {
    const el = document.getElementById(`category-${catId}`);
    if (!el) return;

    lockUntil.current = Date.now() + 1500;
    activeIdRef.current = catId;
    setActiveId(catId);
    scrollStripTo(catId);

    const navBottom = stickyRef.current?.getBoundingClientRect().bottom ?? 96;
    const y = el.getBoundingClientRect().top + window.scrollY - navBottom + 2;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function CategoryCard({ cat }: { cat: MenuCategory }) {
    const name = getCategoryName(cat);
    const img = cat.imageUrl?.trim();
    const active = activeId === cat.id;

    return (
      <button
        key={cat.id}
        type="button"
        data-tab-id={cat.id}
        onClick={() => handleClick(cat.id)}
        style={{ height: CARD_H, width: CARD_W, minWidth: CARD_W, flexShrink: 0 }}
        className={`relative overflow-hidden rounded-xl text-left transition-[box-shadow,transform] active:scale-[0.98] ${
          active
            ? "shadow-[0_0_0_2px_#1877F2,0_4px_14px_rgba(24,119,242,0.25)]"
            : "shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
        }`}
      >
        {img ? (
          <Image src={img} alt="" fill className="object-cover" sizes={`${CARD_W}px`} />
        ) : (
          <div className="absolute inset-0" style={{ background: FALLBACK_BG }} />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25"
          aria-hidden
        />
        <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[14px] font-semibold leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
          {name}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={stickyRef}
      className="sticky top-0 z-40 bg-[#F0F2F5] dark:bg-[#1e1f20] isolate"
    >
      <div className="mx-auto w-full max-w-[480px] px-4 py-3 lg:max-w-[1200px]">
        <div className="flex items-center">
          {/* All cards scrollable */}
          <div
            ref={scrollRef}
            className="no-scrollbar min-h-0 flex-1"
            style={{
              overflowX: "auto",
              overflowY: "hidden",
            }}
          >
            <div
              className="flex w-max items-center px-2 py-2"
              style={{ gap: GAP }}
            >
              {categories.map((cat) => (
                <CategoryCard key={cat.id} cat={cat} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
