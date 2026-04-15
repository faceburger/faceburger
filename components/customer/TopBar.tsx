"use client";

import { MapPin, Moon, Phone, Sun } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useTheme } from "@/components/ThemeProvider";

const LOCALES = ["fr", "ar", "en"] as const;

const RESTAURANT_ADDRESS = "Agdal, Rabat, Maroc";
const RESTAURANT_PHONE = "+212 6 00 00 00 00";
const MAPS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(RESTAURANT_ADDRESS)}`;
const PHONE_HREF = `tel:${RESTAURANT_PHONE.replace(/\s/g, "")}`;

export function TopBar() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  function switchLocale(next: (typeof LOCALES)[number]) {
    router.replace("/", { locale: next });
  }

  function openMaps() {
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) window.location.href = MAPS_URL;
    else window.open(MAPS_URL, "_blank");
  }

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 border-b border-[#E4E6EB] bg-white dark:border-[#3e4042] dark:bg-[#242526]"
      style={{ height: 56 }}
    >
      {/* Centered content — max 480px, matching menu width */}
      <div
        className="flex h-full items-center justify-between"
        style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}
      >
        {/* Logo — Facebook-style bold rounded wordmark */}
        <span
          className="text-[22px] font-black tracking-[-0.5px] text-[#1877F2]"
          style={{ lineHeight: 1 }}
        >
          FaceBurger
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openMaps}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E6EB] bg-[#F0F2F5] text-[#1877F2] active:opacity-80 dark:border-[#3e4042] dark:bg-[#2d2f31] dark:text-[#5aa7ff]"
            aria-label="Google Maps"
          >
            <MapPin size={18} strokeWidth={2.25} />
          </button>

          <a
            href={PHONE_HREF}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E6EB] bg-[#F0F2F5] text-[#1877F2] active:opacity-80 dark:border-[#3e4042] dark:bg-[#2d2f31] dark:text-[#5aa7ff]"
            aria-label={`Appeler ${RESTAURANT_PHONE}`}
          >
            <Phone size={18} strokeWidth={2.25} />
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E6EB] bg-[#F0F2F5] text-[#65676B] active:opacity-80 dark:border-[#3e4042] dark:bg-[#2d2f31] dark:text-[#e4e6eb]"
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language switcher */}
          <div className="flex items-center gap-1">
            {LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => switchLocale(loc)}
                className={`font-semibold transition-colors ${locale === loc ? "bg-[#1877F2] text-white" : "bg-[#F0F2F5] text-[#65676B] dark:bg-[#2d2f31] dark:text-[#b0b3b8]"}`}
                style={{
                  borderRadius: 999,
                  padding: "5px 10px",
                  fontSize: 12,
                }}
              >
                {t(`lang.${loc}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
