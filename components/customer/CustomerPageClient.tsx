"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPin, Clock, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { PublicMenuHero } from "@/components/PublicMenuHero";
import { CategoryTabs } from "./CategoryTabs";
import { ItemCard } from "./ItemCard";
import { ItemDetailSheet } from "./ItemDetailSheet";
import { CartSheet } from "./CartSheet";
import { FloatingCartButton } from "./FloatingCartButton";
import type { MenuCategory, MenuItem } from "@/types/menu";

type Props = {
  locale: string;
  menu: MenuCategory[];
  settings: Record<string, string>;
};

export function CustomerPageClient({ locale, menu, settings }: Props) {
  const COVER_IMAGE = settings.cover_image_url || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80";
  const RESTAURANT_NAME = settings.restaurant_name || "FaceBurger";
  const RESTAURANT_ADDRESS = settings.restaurant_address || "Agdal, Rabat, Maroc";
  const RESTAURANT_PHONE = settings.restaurant_phone || "+212 6 00 00 00 00";
  const RESTAURANT_HOURS = settings.restaurant_hours || "Lun – Dim : 11h00 – 23h00";
  const MAPS_URL = settings.maps_url || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(RESTAURANT_ADDRESS)}`;
  const PHONE_HREF = `tel:${RESTAURANT_PHONE.replace(/\s/g, "")}`;
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const t = useTranslations();
  const loc = locale as "fr" | "ar" | "en";

  function getCategoryName(cat: MenuCategory) {
    return cat.name[loc] ?? cat.name.fr;
  }

  const contentMax =
    "w-full max-w-[480px] lg:max-w-[1200px] mx-auto";

  return (
    <div className="public-menu min-h-screen bg-white dark:bg-[#242526]">

      {/* ────────────────────────────────────────────────
          COVER — always full viewport width (exception to content column)
      ──────────────────────────────────────────────── */}
      <PublicMenuHero
        locale={locale}
        localePath="/"
        coverImageUrl={COVER_IMAGE}
        restaurantName={RESTAURANT_NAME}
        restaurantAddress={RESTAURANT_ADDRESS}
        restaurantPhone={RESTAURANT_PHONE}
        mapsUrl={settings.maps_url}
      />

      {/* ────────────────────────────────────────────────
          MENU CONTENT — 480px mobile / 1200px desktop
      ──────────────────────────────────────────────── */}
      {/* Sticky category tabs — full viewport width */}
      <CategoryTabs categories={menu} locale={locale} />

      <div className={contentMax}>

        {/* Menu sections — categories preserved; items in 3 columns on lg+ */}
        {menu.map((category) => (
          <section
            key={category.id}
            id={`category-${category.id}`}
            data-category-id={category.id}
          >
            <div className="px-4 pt-3 pb-[18px] flex items-center gap-3">
              <div className="w-1 rounded-full self-stretch" style={{ background: "#1877F2", minHeight: 28 }} />
              <h2 className="menu-category-title text-[28px] font-extrabold text-[#1C1E21] dark:text-[#e4e6eb]">
                {getCategoryName(category)}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 px-4 lg:grid-cols-3 lg:gap-5">
              {category.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  onOpen={setSelectedItem}
                />
              ))}
            </div>

            <div style={{ height: 12 }} />
          </section>
        ))}

        {/* ────────────────────────────────────────────────
            FOOTER
        ──────────────────────────────────────────────── */}
      </div>

      {/* Footer breaks out of the 480px box so it spans full width on every screen */}
      <footer style={{ background: "#111214", marginTop: 28 }}>

        {/* Brand-blue top accent stripe */}
        <div style={{ height: 4, background: "#1877F2" }} />

        {/* Inner content — aligned with menu column */}
        <div className="mx-auto w-full max-w-[480px] px-5 pt-7 pb-2 lg:max-w-[1200px]">

          {/* ── Brand block ── */}
          <p
            style={{
              fontWeight: 900,
              fontSize: 28,
              color: "#ffffff",
              letterSpacing: "-0.5px",
              lineHeight: 1,
              marginBottom: 24,
            }}
          >
            {RESTAURANT_NAME}
          </p>

          {/* ── Thin rule ── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 24 }} />

          {/* ── Contact info ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { Icon: MapPin,  text: RESTAURANT_ADDRESS,                         href: undefined },
              { Icon: Clock,   text: RESTAURANT_HOURS,                           href: undefined },
              { Icon: Phone,   text: RESTAURANT_PHONE, href: `tel:${RESTAURANT_PHONE.replace(/\s/g, "")}` },
            ].map(({ Icon, text, href }, i) => (
              <div key={i} className="flex items-center gap-3">
                {/* Icon pill */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(24,119,242,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} style={{ color: "#1877F2" }} />
                </div>
                {href ? (
                  <a
                    href={href}
                    style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
                  >
                    {text}
                  </a>
                ) : (
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{text}</span>
                )}
              </div>
            ))}
          </div>

          {/* ── Bottom rule + copyright ── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginTop: 28, marginBottom: 16 }} />
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              textAlign: "center",
              letterSpacing: "0.03em",
              paddingBottom: 8,
            }}
          >
            © {new Date().getFullYear()} {RESTAURANT_NAME} &mdash; Tous droits réservés
          </p>
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.34)",
              textAlign: "center",
              letterSpacing: "0.02em",
              paddingBottom: 12,
            }}
          >
            powered by{" "}
            <a
              href="https://scanini.ma"
              target="_blank"
              rel="noreferrer"
              style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}
            >
              scanini.ma
            </a>
          </p>
        </div>
      </footer>

      {/* Bottom clearance for floating cart button */}
      <div className="h-[24px] bg-[#111214]" />

      {/* ── Floating cart button ── */}
      <FloatingCartButton onOpen={() => setCartOpen(true)} />

      {/* ── Sheets ── */}
      <ItemDetailSheet
        item={selectedItem}
        locale={locale}
        onClose={() => setSelectedItem(null)}
      />
      <CartSheet
        isOpen={cartOpen}
        locale={locale}
        onClose={() => setCartOpen(false)}
      />
    </div>
  );
}
