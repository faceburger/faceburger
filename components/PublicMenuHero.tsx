"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, MapPin, Clock, Phone, Sun, Moon } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { DEFAULT_ORDERING_WINDOW, formatWindowLabel } from "@/lib/ordering-hours";

const LOCALES = ["fr", "ar", "en"] as const;

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80";

export type PublicMenuHeroProps = {
  locale: string;
  /** Base path passed to `router.replace` when switching language */
  localePath: string;
  coverImageUrl: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  mapsUrl?: string;
};

export function PublicMenuHero({
  locale,
  localePath,
  coverImageUrl,
  restaurantName,
  restaurantAddress,
  restaurantPhone,
  mapsUrl: mapsUrlProp,
}: PublicMenuHeroProps) {
  const COVER_IMAGE = coverImageUrl || DEFAULT_COVER;
  const MAPS_URL =
    mapsUrlProp ||
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurantAddress)}`;
  const PHONE_HREF = `tel:${restaurantPhone.replace(/\s/g, "")}`;
  const [langOpen, setLangOpen] = useState(false);

  const t = useTranslations();
  const currentLocale = useLocale();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const loc = locale as "fr" | "ar" | "en";
  const orderingHoursLabel = formatWindowLabel(DEFAULT_ORDERING_WINDOW);

  function switchLocale(next: (typeof LOCALES)[number]) {
    router.replace(localePath, { locale: next });
    setLangOpen(false);
  }

  function openMaps() {
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) window.location.href = MAPS_URL;
    else window.open(MAPS_URL, "_blank");
  }

  const contentMax = "w-full max-w-[480px] lg:max-w-[1200px] mx-auto";

  return (
    <div
      className="hero-no-scale w-full"
      style={{
        position: "relative",
        width: "100%",
        height: 200,
        overflow: "hidden",
      }}
    >
      <Image
        src={COVER_IMAGE}
        alt={restaurantName}
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />

      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.22)" }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex flex-col items-center"
          style={{ transform: "translateY(14px)" }}
        >
          <span
            className="hero-brand-name"
            style={{
              fontWeight: 900,
              fontSize: 50,
              color: "#1877F2",
              letterSpacing: "-1px",
              lineHeight: 1,
              textShadow: "0 0 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {restaurantName}
          </span>
          <span
            className="hero-brand-menu mt-1"
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

      <div className="absolute inset-x-0 top-0 z-10">
        <div
          className={`${contentMax} flex w-full min-w-0 items-center gap-1.5 px-3 pt-3.5 sm:gap-2 sm:px-4`}
        >
          <div className="min-w-0 flex-1">
            <div
              className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:gap-2 sm:px-3"
              style={{
                background: "rgba(0,0,0,0.30)",
                border: "1px solid rgba(255,255,255,0.22)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                color: "#ffffff",
              }}
            >
              <Clock size={14} className="shrink-0" style={{ color: "#ffffff" }} />
              <span
                className="min-w-0 truncate"
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
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
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
              aria-label={`Appeler ${restaurantPhone}`}
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
                          background:
                            currentLocale === l ? "#EBF3FF" : "transparent",
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
  );
}
