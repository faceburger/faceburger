"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCartStore, entryTotal, getOptionExtraPrice } from "@/store/cart";
import { createOrder } from "@/actions/orders";
import { CheckoutHero } from "./CheckoutHero";
import { StepProgress } from "./StepProgress";
import { DEFAULT_DELIVERY_FEE_MAD } from "@/lib/checkout-constants";
import {
  DEFAULT_ORDERING_WINDOW,
  formatWindowLabel,
  isWithinOrderingWindow,
} from "@/lib/ordering-hours";

const COUNTRY_OPTIONS = [
  { code: "+212", flag: "🇲🇦", label: "MA" },
  { code: "+33", flag: "🇫🇷", label: "FR" },
  { code: "+1", flag: "🇺🇸", label: "US" },
];

type ServiceMode = "delivery" | "pickup" | "dine_in";

function needsLocation(mode: ServiceMode | null) {
  return mode === "delivery";
}

function indicatorFromCheckoutStep(
  step: 1 | 2 | 3 | 4,
  serviceMode: ServiceMode | null,
): { totalSteps: 3 | 4; activeStep: number } {
  if (serviceMode === "delivery") {
    return { totalSteps: 4, activeStep: step };
  }
  // Default (no choice yet, takeaway, or dine-in): 3-step indicator
  return { totalSteps: 3, activeStep: step === 4 ? 3 : step };
}

function advanceStep(
  step: 1 | 2 | 3 | 4,
  mode: ServiceMode | null,
): 1 | 2 | 3 | 4 {
  if (step === 2 && mode && !needsLocation(mode)) return 4;
  return Math.min(4, step + 1) as 1 | 2 | 3 | 4;
}

function retreatStep(
  step: 1 | 2 | 3 | 4,
  mode: ServiceMode | null,
): 1 | 2 | 3 | 4 {
  if (step === 4 && mode && !needsLocation(mode)) return 2;
  return Math.max(1, step - 1) as 1 | 2 | 3 | 4;
}

function ServiceRadio({ selected }: { selected: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected
          ? "border-[#1877F2] bg-white dark:bg-[#1c1e21]"
          : "border-[#BCC0C4] bg-white dark:border-[#5e6266] dark:bg-[#1c1e21]"
      }`}
      aria-hidden
    >
      {selected ? (
        <span className="h-3 w-3 rounded-full bg-[#1877F2]" />
      ) : null}
    </span>
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function CheckoutClient({ locale, whatsappNumber, settings }: { locale: string; whatsappNumber: string; settings: Record<string, string> }) {
  const t = useTranslations("checkoutFlow");
  const router = useRouter();
  const loc = locale as "fr" | "ar" | "en";

  const { entries, totalPrice, clearCart } = useCartStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const saved = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("fb_customer") || "{}") : {};
  const [fullName, setFullName] = useState<string>(saved.fullName ?? "");
  const [countryCode, setCountryCode] = useState<string>(saved.countryCode ?? "+212");
  const [phone, setPhone] = useState<string>(saved.phone ?? "");

  const [serviceMode, setServiceMode] = useState<ServiceMode | null>(null);
  const [paymentMode, setPaymentMode] = useState<"cash">("cash");
  const [addressLine, setAddressLine] = useState("");
  const [aptNumber, setAptNumber] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [nowTick, setNowTick] = useState(0);

  const deliveryTiers: { maxKm: number; fee: number }[] = (() => {
    try {
      return JSON.parse(settings.delivery_fee_tiers || "[]").sort(
        (a: { maxKm: number }, b: { maxKm: number }) => a.maxKm - b.maxKm,
      );
    } catch {
      return [];
    }
  })();
  const restaurantLat = parseFloat(settings.restaurant_lat || "34.0084");
  const restaurantLng = parseFloat(settings.restaurant_lng || "-6.8539");

  const subtotal = totalPrice();
  const deliveryFee: number = (() => {
    if (serviceMode !== "delivery") return 0;
    if (!gpsCoords) return deliveryTiers[0]?.fee ?? DEFAULT_DELIVERY_FEE_MAD;
    const distanceKm = haversineKm(restaurantLat, restaurantLng, gpsCoords.lat, gpsCoords.lng);
    const matched = deliveryTiers.find(tier => distanceKm <= tier.maxKm);
    return matched ? matched.fee : (deliveryTiers[deliveryTiers.length - 1]?.fee ?? DEFAULT_DELIVERY_FEE_MAD);
  })();
  const grandTotal = subtotal + deliveryFee;

  // keep a light tick so the “open/closed” gate can update
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((x) => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const orderingWindow = DEFAULT_ORDERING_WINDOW;
  const withinOrderingWindow = isWithinOrderingWindow(new Date(), orderingWindow).ok;

  useEffect(() => {
    if (entries.length === 0) {
      router.replace("/");
    }
  }, [entries.length, router]);

  useEffect(() => {
    if (step === 3 && serviceMode && !needsLocation(serviceMode)) {
      setStep(4);
    }
  }, [step, serviceMode]);

  const fullPhone = `${countryCode}${phone.replace(/\s/g, "")}`;

  function handleLocate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    setLocateError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": "fr" } },
        )
          .then((r) => r.json())
          .then((d) => {
            if (d.display_name) setAddressLine(d.display_name);
          })
          .catch(() => {})
          .finally(() => setLocating(false));
      },
      () => {
        setLocating(false);
        setLocateError(true);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function validateStep1(): boolean {
    return (
      fullName.trim().length > 0 && phone.replace(/\s/g, "").length > 0
    );
  }

  function validateStep2(): boolean {
    return serviceMode !== null;
  }

  function validateStep3(): boolean {
    if (serviceMode !== "delivery") return true;
    return addressLine.trim().length > 0;
  }

  async function submitOrder() {
    if (entries.length === 0) return;
    if (!withinOrderingWindow) {
      setSubmitError(`Les commandes sont fermées. Horaires : ${formatWindowLabel(orderingWindow)}.`);
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    const popup = !isMobile ? window.open("", "_blank") : null;

    if (!whatsappNumber?.trim()) {
      if (popup && !popup.closed) popup.close();
      setSubmitError("Numéro WhatsApp non configuré. Vérifiez les paramètres admin.");
      setSubmitting(false);
      return;
    }

    const orderItems = entries.map((e) => ({
      itemId: e.itemId,
      name: e.itemName[loc] ?? e.itemName.fr,
      quantity: e.quantity,
      basePrice: e.basePrice,
      options: e.chosenOptions.map((o) => ({
        name: o.optionName[loc] ?? o.optionName.fr,
        extraPrice: getOptionExtraPrice(e, o.optionId),
      })),
      lineTotal: entryTotal(e),
    }));

    const fullAddress = [addressLine.trim(), aptNumber.trim(), addressNotes.trim()]
      .filter(Boolean)
      .join(" — ");

    const customerAddress =
      serviceMode === "delivery"
        ? fullAddress
        : serviceMode === "pickup"
          ? t("pickupAddress")
          : serviceMode === "dine_in"
            ? t("dineInAddress")
            : "";

    const orderMeta = {
      fullName,
      serviceMode,
      paymentMode,
      subtotal,
      deliveryFee,
      addressLine: serviceMode === "delivery" ? fullAddress : null,
    };

    try {
      const orderId = await createOrder({
        customerName: fullName,
        customerPhone: fullPhone,
        customerAddress,
        items: orderItems,
        total: grandTotal,
        orderMeta,
      });

      const now = new Date();
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()} - ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      const sep = "────────────";
      const serviceLineFr =
        serviceMode === "delivery" ? "Livraison"
        : serviceMode === "pickup" ? "A emporter"
        : "Sur place";

      const lines: string[] = [
        "FACEBURGER",
        `Commande #${orderId}`,
        `Date : ${dateStr}`,
        sep,
        `Client : ${fullName}`,
        `Tel    : ${fullPhone}`,
        sep,
        `Service  : ${serviceLineFr}`,
        `Paiement : En espèces`,
      ];

      if (serviceMode === "delivery") {
        lines.push(`Adresse  : ${fullAddress}`);
      }

      lines.push(sep);

      for (const entry of entries) {
        const name = entry.itemName.fr;
        const lineTotal = entryTotal(entry).toFixed(2);
        lines.push(`${entry.quantity}x  ${name}`);
        for (const opt of entry.chosenOptions) {
          const optName = opt.optionName.fr;
          const optionExtraPrice = getOptionExtraPrice(entry, opt.optionId);
          lines.push(`   + ${optName}${optionExtraPrice > 0 ? ` (+${optionExtraPrice.toFixed(2)} MAD)` : ""}`);
        }
        lines.push(`   ${lineTotal} MAD`);
        lines.push("");
      }

      lines.push(sep);
      lines.push(`Sous-total : ${subtotal.toFixed(2)} MAD`);
      if (deliveryFee > 0) {
        lines.push(`Livraison  : ${deliveryFee.toFixed(2)} MAD`);
      }
      lines.push(`TOTAL      : ${grandTotal.toFixed(2)} MAD`);
      lines.push(sep);

      if (gpsCoords && serviceMode === "delivery") {
        lines.push(`GPS      : https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`);
      }

      const message = lines.join("\n");
      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

      localStorage.setItem("fb_customer", JSON.stringify({ fullName, countryCode, phone }));
      clearCart();
      if (isMobile) window.location.href = url;
      else if (popup) popup.location.href = url;
      else window.location.href = url;
      router.replace("/");
    } catch (err) {
      if (popup && !popup.closed) popup.close();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ORDERING_CLOSED")) {
        setSubmitError(`Les commandes sont fermées. Horaires : ${formatWindowLabel(orderingWindow)}.`);
      } else {
        setSubmitError("Échec de l'envoi. Réessayez dans un instant.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (entries.length === 0) {
    return null;
  }

  const pad = "px-4";

  const stepTitle =
    step === 1
      ? t("steps.info")
      : step === 2
        ? t("steps.service")
        : step === 3
          ? t("steps.location")
          : t("steps.summary");

  const cardBase =
    "w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.99]";
  const cardSelected =
    "border-[#1877F2] bg-[#F0F6FF] shadow-[0_0_0_1px_rgba(24,119,242,0.08)] dark:bg-[#152536]";
  const cardUnselected =
    "border-[#E4E6EB] bg-[#FAFBFC] dark:border-[#3a3b3d] dark:bg-[#1c1e21]";

  const { totalSteps, activeStep } = indicatorFromCheckoutStep(
    step,
    serviceMode,
  );

  const serviceLabel =
    serviceMode === "delivery"
      ? t("service.delivery")
      : serviceMode === "pickup"
        ? t("service.pickup")
        : serviceMode === "dine_in"
          ? t("service.dineIn")
          : "—";

  return (
    <div className="min-h-screen bg-white pb-8 pt-[env(safe-area-inset-top)] dark:bg-[#242526]">
      <CheckoutHero />
      <StepProgress activeStep={activeStep} totalSteps={totalSteps} />

      <div className={`${pad} mx-auto w-full max-w-[480px] pt-5`}>
        <div className="flex gap-3">
          <span
            className="w-1 shrink-0 self-stretch rounded-full bg-[#1877F2]"
            aria-hidden
          />
          <h2 className="text-[18px] font-bold leading-snug text-[#1C1E21] dark:text-[#E4E6EB]">
            {stepTitle}
          </h2>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-[#65676B] dark:text-[#B0B3B8]">
                {t("labels.name")}
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("placeholders.name")}
                autoComplete="name"
                className="min-h-[48px] w-full rounded-xl border border-[#E4E6EB] bg-white px-3 text-[16px] text-[#1C1E21] outline-none focus:border-[#1877F2] dark:border-[#3a3b3d] dark:bg-[#1c1e21] dark:text-[#E4E6EB]"
              />
            </label>
            <div>
              <span className="text-[13px] font-semibold text-[#65676B] dark:text-[#B0B3B8]">
                {t("labels.phone")}
              </span>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="min-h-[48px] shrink-0 rounded-xl border border-[#E4E6EB] bg-white px-2 text-[16px] font-medium text-[#1C1E21] outline-none focus:border-[#1877F2] dark:border-[#3a3b3d] dark:bg-[#1c1e21] dark:text-[#E4E6EB]"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.label} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("placeholders.phone")}
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-[#E4E6EB] bg-white px-3 text-[16px] text-[#1C1E21] outline-none focus:border-[#1877F2] dark:border-[#3a3b3d] dark:bg-[#1c1e21] dark:text-[#E4E6EB]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="mt-5 flex flex-col gap-6">
            <p className="text-[14px] font-semibold text-[#1C1E21] dark:text-[#E4E6EB]">
              {t("service.title")}
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                role="radio"
                aria-checked={serviceMode === "delivery"}
                onClick={() => setServiceMode("delivery")}
                className={`${cardBase} flex min-h-[52px] gap-3 ${
                  serviceMode === "delivery" ? cardSelected : cardUnselected
                }`}
              >
                <ServiceRadio selected={serviceMode === "delivery"} />
                <div className="min-w-0 flex-1 text-start">
                  <p className="font-bold text-[#1C1E21] dark:text-[#E4E6EB]">
                    {t("service.delivery")}{" "}
                    <span className="text-[#1877F2]">
                      ({!gpsCoords ? "dès " : "+"}{deliveryFee} {t("currency")})
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[#65676B] dark:text-[#B0B3B8]">
                    {t("service.deliveryDesc")}
                  </p>
                </div>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={serviceMode === "pickup"}
                onClick={() => setServiceMode("pickup")}
                className={`${cardBase} flex min-h-[52px] gap-3 ${
                  serviceMode === "pickup" ? cardSelected : cardUnselected
                }`}
              >
                <ServiceRadio selected={serviceMode === "pickup"} />
                <div className="min-w-0 flex-1 text-start">
                  <p className="font-bold text-[#1C1E21] dark:text-[#E4E6EB]">
                    {t("service.pickup")}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[#65676B] dark:text-[#B0B3B8]">
                    {t("service.pickupDesc")}
                  </p>
                </div>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={serviceMode === "dine_in"}
                onClick={() => setServiceMode("dine_in")}
                className={`${cardBase} flex min-h-[52px] gap-3 ${
                  serviceMode === "dine_in" ? cardSelected : cardUnselected
                }`}
              >
                <ServiceRadio selected={serviceMode === "dine_in"} />
                <div className="min-w-0 flex-1 text-start">
                  <p className="font-bold text-[#1C1E21] dark:text-[#E4E6EB]">
                    {t("service.dineIn")}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[#65676B] dark:text-[#B0B3B8]">
                    {t("service.dineInDesc")}
                  </p>
                </div>
              </button>
            </div>

            <div>
              <p className="text-[14px] font-semibold text-[#1C1E21] dark:text-[#E4E6EB]">
                {t("payment.title")}
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode("cash")}
                  className={`${cardBase} min-h-[52px] ${
                    paymentMode === "cash" ? cardSelected : cardUnselected
                  }`}
                >
                  <p className="font-bold text-[#1C1E21] dark:text-[#E4E6EB]">
                    {t("payment.cash")}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[#65676B] dark:text-[#B0B3B8]">
                    {t("payment.cashDesc")}
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — delivery only (pickup / dine-in skip this step) */}
        {step === 3 && serviceMode === "delivery" && (
          <div className="mt-5 flex flex-col gap-5">

            {/* GPS pin block */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E4E6EB] bg-[#FAFBFC] p-4 dark:border-[#3a3b3d] dark:bg-[#1c1e21]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[16px] font-bold text-[#1C1E21] dark:text-[#E4E6EB]">
                  Localisation GPS
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                    gpsCoords
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  }`}
                >
                  {gpsCoords ? "Position OK" : "À localiser"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                className={`flex min-h-[58px] w-full items-center justify-center gap-3 rounded-xl text-[16px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${
                  gpsCoords
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-[#1877F2] text-white shadow-sm"
                }`}
              >
                {locating ? (
                  <>
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Détection en cours…
                  </>
                ) : gpsCoords ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Actualiser ma position
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    Détecter ma position
                  </>
                )}
              </button>

              {locateError && (
                <p className="text-center text-[13px] text-red-500">
                  Accès refusé. Autorisez la localisation dans les paramètres de votre navigateur.
                </p>
              )}
            </div>

            {/* Address fields */}
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-[#65676B] dark:text-[#B0B3B8]">
                  Adresse <span className="text-red-400">*</span>
                </span>
                <input
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Rue, quartier, ville…"
                  className="min-h-[48px] w-full rounded-xl border border-[#E4E6EB] bg-white px-3 text-[16px] outline-none focus:border-[#1877F2] dark:border-[#3a3b3d] dark:bg-[#1c1e21] dark:text-[#E4E6EB]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-[#65676B] dark:text-[#B0B3B8]">
                  Appartement / Étage
                </span>
                <input
                  value={aptNumber}
                  onChange={(e) => setAptNumber(e.target.value)}
                  placeholder="Ex : Appt 3, 2ème étage…"
                  className="min-h-[48px] w-full rounded-xl border border-[#E4E6EB] bg-white px-3 text-[16px] outline-none focus:border-[#1877F2] dark:border-[#3a3b3d] dark:bg-[#1c1e21] dark:text-[#E4E6EB]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-[#65676B] dark:text-[#B0B3B8]">
                  Instructions supplémentaires
                </span>
                <textarea
                  value={addressNotes}
                  onChange={(e) => setAddressNotes(e.target.value)}
                  rows={2}
                  placeholder="Code de porte, point de repère…"
                  className="w-full rounded-xl border border-[#E4E6EB] bg-white px-3 py-3 text-[16px] outline-none focus:border-[#1877F2] dark:border-[#3a3b3d] dark:bg-[#1c1e21] dark:text-[#E4E6EB]"
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="mt-5 flex flex-col gap-5">
            <div className="rounded-2xl border border-[#E4E6EB] bg-[#FAFBFC] p-4 dark:border-[#3a3b3d] dark:bg-[#1c1e21]">
              <RecapRow
                label={t("labels.fullName")}
                value={fullName}
              />
              <RecapRow label={t("labels.phone")} value={fullPhone} />
              <RecapRow label={t("recap.service")} value={serviceLabel} />
              <RecapRow label={t("recap.payment")} value={t("payment.cash")} />
              <RecapRow
                label={t("labels.address")}
                value={
                  serviceMode === "delivery"
                    ? [addressLine, aptNumber, addressNotes].filter(Boolean).join(" — ") || "—"
                    : serviceMode === "pickup"
                      ? t("pickupAddress")
                      : serviceMode === "dine_in"
                        ? t("dineInAddress")
                        : "—"
                }
              />
            </div>

            <div className="rounded-2xl border border-[#E4E6EB] p-4 dark:border-[#3a3b3d] dark:bg-[#1c1e21]">
              <div className="flex justify-between text-[15px] text-[#65676B] dark:text-[#B0B3B8]">
                <span>{t("labels.subtotal")}</span>
                <span className="tabular-nums">
                  {subtotal.toFixed(2)} {t("currency")}
                </span>
              </div>
              {deliveryFee > 0 ? (
                <div className="mt-2 flex justify-between text-[15px] text-[#65676B] dark:text-[#B0B3B8]">
                  <span>{t("labels.deliveryFee")}</span>
                  <span className="tabular-nums">
                    {deliveryFee.toFixed(2)} {t("currency")}
                  </span>
                </div>
              ) : null}
              <div
                className="my-3 border-t border-[#E4E6EB] dark:border-[#3a3b3d]"
              />
              <div className="flex justify-between text-[17px] font-bold text-[#1C1E21] dark:text-[#E4E6EB]">
                <span>{t("labels.total")}</span>
                <span className="tabular-nums text-[#1877F2]">
                  {grandTotal.toFixed(2)} {t("currency")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="mt-8 flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="min-h-[48px] flex-1 rounded-xl border border-[#E4E6EB] bg-[#F0F2F5] text-[14px] font-semibold text-[#1C1E21] dark:border-[#3a3b3d] dark:bg-[#3a3b3d] dark:text-[#E4E6EB]"
              >
                {t("actions.home")}
              </button>
              <button
                type="button"
                disabled={!validateStep1()}
                onClick={() => validateStep1() && setStep(2)}
                className="min-h-[48px] flex-1 rounded-xl bg-[#1877F2] text-[14px] font-semibold text-white disabled:opacity-40"
              >
                {t("actions.next")}
              </button>
            </>
          ) : step === 4 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(retreatStep(4, serviceMode))}
                className="min-h-[48px] flex-1 rounded-xl border border-[#E4E6EB] bg-[#F0F2F5] text-[14px] font-semibold text-[#1C1E21] dark:border-[#3a3b3d] dark:bg-[#3a3b3d] dark:text-[#E4E6EB]"
              >
                {t("actions.back")}
              </button>
              <button
                type="button"
                disabled={submitting || !withinOrderingWindow}
                onClick={submitOrder}
                className="min-h-[48px] flex-1 rounded-xl bg-[#1877F2] text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "…" : t("actions.placeOrder")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(retreatStep(step, serviceMode))}
                className="min-h-[48px] flex-1 rounded-xl border border-[#E4E6EB] bg-[#F0F2F5] text-[14px] font-semibold text-[#1C1E21] dark:border-[#3a3b3d] dark:bg-[#3a3b3d] dark:text-[#E4E6EB]"
              >
                {t("actions.back")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (step === 2 && !validateStep2()) return;
                  if (step === 3 && !validateStep3()) return;
                  setStep(advanceStep(step, serviceMode));
                }}
                className="min-h-[48px] flex-1 rounded-xl bg-[#1877F2] text-[14px] font-semibold text-white disabled:opacity-40"
              >
                {t("actions.next")}
              </button>
            </>
          )}
        </div>
        {submitError && (
          <p className="mt-3 text-sm text-red-500">
            {submitError}
          </p>
        )}
        {step === 4 && !withinOrderingWindow && !submitError && (
          <p className="mt-3 text-sm text-amber-600">
            Les commandes sont fermées. Horaires : {formatWindowLabel(orderingWindow)}.
          </p>
        )}
      </div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#ECEEF2] py-2.5 last:border-0 dark:border-[#3a3b3d]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8D91] dark:text-[#9BA0A6]">
        {label}
      </p>
      <p className="mt-1 text-[14px] leading-snug text-[#1C1E21] dark:text-[#E4E6EB]">{value}</p>
    </div>
  );
}
