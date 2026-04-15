"use client";

import Image from "next/image";
import { ChevronDown, MapPin, Phone, Sun, Moon } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  COVER_IMAGE,
  MAPS_URL,
  PHONE_HREF,
  RESTAURANT_NAME,
  RESTAURANT_PHONE,
} from "@/lib/restaurant-brand";

const LOCALES = ["fr", "ar", "en"] as const;

export function CheckoutHero() {
  const t = useTranslations();
  const currentLocale = useLocale();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);

  function switchLocale(next: (typeof LOCALES)[number]) {
    router.replace("/checkout", { locale: next });
    setLangOpen(false);
  }

  function openMaps() {
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) window.location.href = MAPS_URL;
    else window.open(MAPS_URL, "_blank");
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 190 }}
    >
      <Image
        src={COVER_IMAGE}
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.42)" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <span
            style={{
              fontWeight: 900,
              fontSize: 38,
              color: "#1877F2",
              letterSpacing: "-1px",
              lineHeight: 1,
              textShadow:
                "0 0 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {RESTAURANT_NAME}
          </span>
          <span
            className="mt-1"
            style={{
              fontWeight: 900,
              fontSize: 30,
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
        <div className="mx-auto flex w-full max-w-[480px] items-center justify-end gap-2 px-4 pt-3.5 lg:max-w-[1200px]">
        <button
          type="button"
          onClick={openMaps}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-white/30 bg-white/15 text-white backdrop-blur-md transition-opacity active:opacity-85"
          aria-label="Google Maps"
        >
          <MapPin size={18} strokeWidth={2.25} />
        </button>

        <a
          href={PHONE_HREF}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-white/30 bg-white/15 text-white backdrop-blur-md transition-opacity active:opacity-85"
          aria-label={`Appeler ${RESTAURANT_PHONE}`}
        >
          <Phone size={18} strokeWidth={2.25} />
        </a>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-white/30 bg-white/15 text-white backdrop-blur-md transition-opacity active:opacity-85"
          aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-white/30 bg-white/15 px-2.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur-md"
          >
            {currentLocale.toUpperCase()}
            <ChevronDown size={13} />
          </button>

          {langOpen && (
            <>
              <div
                className="fixed inset-0 z-0"
                onClick={() => setLangOpen(false)}
              />
              <div
                className="absolute end-0 top-[calc(100%+6px)] z-20 min-w-[94px] overflow-hidden rounded-[10px] border border-[#E4E6EB] bg-white shadow-lg dark:border-[#3a3b3d] dark:bg-[#1c1e21]"
              >
                {LOCALES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => switchLocale(l)}
                    className={`block w-full px-3.5 py-2.5 text-start text-[13px] font-semibold transition-colors ${
                      currentLocale === l
                        ? "bg-[#EBF3FF] text-[#1877F2] dark:bg-[#1A2A3D]"
                        : "text-[#1C1E21] hover:bg-[#F5F6F7] dark:text-[#E4E6EB] dark:hover:bg-[#2A2C31]"
                    }`}
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
  );
}
