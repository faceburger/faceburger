"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, MapPin, Clock, Phone, Sun, Moon } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { DEFAULT_ORDERING_WINDOW, formatWindowLabel } from "@/lib/ordering-hours";
import { CategoryTabs } from "./CategoryTabs";
import { ItemCard } from "./ItemCard";
import { ItemDetailSheet } from "./ItemDetailSheet";
import { CartSheet } from "./CartSheet";
import { FloatingCartButton } from "./FloatingCartButton";
import type { MenuCategory, MenuItem } from "@/types/menu";

const LOCALES = ["fr", "ar", "en"] as const;

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
  const [langOpen, setLangOpen] = useState(false);

  const t = useTranslations();
  const currentLocale = useLocale();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const loc = locale as "fr" | "ar" | "en";
  const orderingHoursLabel = formatWindowLabel(DEFAULT_ORDERING_WINDOW);

  function getCategoryName(cat: MenuCategory) {
    return cat.name[loc] ?? cat.name.fr;
  }

  function switchLocale(next: (typeof LOCALES)[number]) {
    router.replace("/", { locale: next });
    setLangOpen(false);
  }

  function openMaps() {
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) window.location.href = MAPS_URL;
    else window.open(MAPS_URL, "_blank");
  }

  const contentMax =
    "w-full max-w-[480px] lg:max-w-[1200px] mx-auto";

  return (
    <div className="public-menu min-h-screen bg-white dark:bg-[#242526]">

      {/* ────────────────────────────────────────────────
          COVER — always full viewport width (exception to content column)
      ──────────────────────────────────────────────── */}
      <div
        className="w-full"
        style={{
          position: "relative",
          width: "100%",
          height: 200,
          overflow: "hidden",
        }}
      >
        {/* Photo at full natural brightness */}
        <Image
          src={COVER_IMAGE}
          alt="FaceBurger"
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />

        {/* Dark overlay — subtle, lets the photo breathe */}
        <div
          className="absolute inset-0"
          style={{ background: "rgba(0, 0, 0, 0.22)" }}
        />

        {/* Centered logo — brand blue */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex flex-col items-center"
            style={{ transform: "translateY(14px)" }}
          >
            <span
              style={{
                fontWeight: 900,
                fontSize: 50,
                color: "#1877F2",
                letterSpacing: "-1px",
                lineHeight: 1,
                textShadow: "0 0 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              {RESTAURANT_NAME}
            </span>
            <span
              className="mt-1"
              style={{
                fontWeight: 900,
                fontSize: 36,
                color: "#ffffff",
                letterSpacing: "-1px",
                lineHeight: 1,
                textShadow: "0 2px 8px rgba(0,0,0,0.45)",
              }}
            >
              Menu
            </span>
          </div>
        </div>

        {/* Maps, theme, language — aligned with main content width */}
        <div className="absolute inset-x-0 top-0 z-10">
          <div
            className={`${contentMax} flex items-center justify-between gap-2 px-4 pt-3.5`}
          >
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: "rgba(0,0,0,0.30)",
              border: "1px solid rgba(255,255,255,0.22)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              color: "#ffffff",
              maxWidth: "min(72vw, 320px)",
            }}
          >
            <Clock size={14} style={{ color: "#ffffff" }} />
            <span
              className="truncate"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "0.01em",
              }}
              title={orderingHoursLabel}
            >
              {loc === "ar"
                ? `أوقات الطلب: ${orderingHoursLabel}`
                : loc === "en"
                  ? `Ordering: ${orderingHoursLabel}`
                  : `Commande: ${orderingHoursLabel}`}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={openMaps}
            className="flex items-center justify-center active:opacity-85 transition-opacity"
            style={{
              width: 38,
              height: 38,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.32)",
              borderRadius: 10,
              color: "#ffffff",
            }}
            aria-label="Google Maps"
          >
            <MapPin size={18} strokeWidth={2.25} />
          </button>

          <a
            href={PHONE_HREF}
            className="flex items-center justify-center active:opacity-85 transition-opacity"
            style={{
              width: 38,
              height: 38,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.32)",
              borderRadius: 10,
              color: "#ffffff",
            }}
            aria-label={`Appeler ${RESTAURANT_PHONE}`}
          >
            <Phone size={18} strokeWidth={2.25} />
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center active:opacity-85 transition-opacity"
            style={{
              width: 38,
              height: 38,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.32)",
              borderRadius: 10,
              color: "#ffffff",
            }}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1 font-semibold"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.32)",
                borderRadius: 8,
                padding: "6px 11px",
                color: "#ffffff",
                fontSize: 13,
              }}
            >
              {currentLocale.toUpperCase()}
              <ChevronDown size={13} />
            </button>

            {langOpen && (
              <>
                <div
                  className="fixed inset-0"
                  style={{ zIndex: -1 }}
                  onClick={() => setLangOpen(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    insetInlineEnd: 0,
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #E4E6EB",
                    minWidth: 94,
                    overflow: "hidden",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
                  }}
                >
                  {LOCALES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => switchLocale(l)}
                      className="w-full text-start font-semibold transition-colors"
                      style={{
                        padding: "9px 14px",
                        fontSize: 13,
                        display: "block",
                        color: currentLocale === l ? "#1877F2" : "#1C1E21",
                        background: currentLocale === l ? "#EBF3FF" : "transparent",
                      }}
                    >
                      {t(`lang.${l}`)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          </div>
          </div>
        </div>
      </div>

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
              <h2 className="text-[22px] font-extrabold text-[#1C1E21] dark:text-[#e4e6eb]">
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
