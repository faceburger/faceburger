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

      <div className="absolute inset-x-0 top-0 z-50">
        <div
          className={`${contentMax} hero-top-bar-row flex w-full min-w-0 items-center gap-2 px-3 pt-3 sm:gap-3 sm:px-4 sm:pt-3.5`}
        >
          <div className="min-w-0 flex-1">
            <div
              className="hero-hours-pill flex max-w-full min-w-0 items-center gap-2.5 rounded-2xl border border-white/25 bg-black/45 px-3 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] backdrop-blur-md sm:gap-3 sm:px-3.5 sm:py-3"
            >
              <Clock
                className="hero-hours-clock shrink-0 text-white"
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                {loc === "ar" ? (
                  <div className="min-w-0 text-end" dir="rtl">
                    <div className="hero-hours-caption text-white/80">أوقات الطلب</div>
                    <div className="hero-hours-time mt-0.5 text-white tabular-nums">
                      {orderingHoursLabel}
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="hero-hours-caption text-white/80">
                      {loc === "en" ? "Ordering" : "Commande"}
                    </div>
                    <div className="hero-hours-time mt-0.5 text-white tabular-nums">
                      {orderingHoursLabel}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={openMaps}
              className="hero-icon-btn flex size-11 shrink-0 touch-manipulation items-center justify-center active:opacity-85 transition-opacity sm:size-[44px]"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.32)",
                borderRadius: 10,
                color: "#ffffff",
              }}
              aria-label="Google Maps"
            >
              <MapPin className="hero-bar-icon" strokeWidth={2.25} />
            </button>

            <a
              href={PHONE_HREF}
              className="hero-icon-btn flex size-11 shrink-0 touch-manipulation items-center justify-center active:opacity-85 transition-opacity sm:size-[44px]"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.32)",
                borderRadius: 10,
                color: "#ffffff",
              }}
              aria-label={`Appeler ${restaurantPhone}`}
            >
              <Phone className="hero-bar-icon" strokeWidth={2.25} />
            </a>

            <button
              type="button"
              onClick={toggleTheme}
              className="hero-icon-btn flex size-11 shrink-0 touch-manipulation items-center justify-center active:opacity-85 transition-opacity sm:size-[44px]"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.32)",
                borderRadius: 10,
                color: "#ffffff",
              }}
              aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="hero-bar-icon" />
              ) : (
                <Moon className="hero-bar-icon" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="hero-lang-toggle flex h-11 min-w-[3.25rem] shrink-0 touch-manipulation items-center justify-center gap-1 px-2.5 font-semibold sm:min-w-[3.5rem] sm:px-3"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.32)",
                  borderRadius: 8,
                  color: "#ffffff",
                }}
              >
                {currentLocale.toUpperCase()}
                <ChevronDown className="hero-lang-chevron size-4 shrink-0" />
              </button>

              {langOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setLangOpen(false)}
                  />
                  <div
                    className="z-50"
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
