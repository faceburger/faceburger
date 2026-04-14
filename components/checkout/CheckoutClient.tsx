"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCartStore, entryTotal } from "@/store/cart";
import { createOrder } from "@/actions/orders";
import { CheckoutMap } from "./CheckoutMap";
import { CheckoutHero } from "./CheckoutHero";
import { StepProgress } from "./StepProgress";
import {
  DEFAULT_DELIVERY_FEE_MAD,
  MAP_DEFAULT_CENTER,
} from "@/lib/checkout-constants";

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

export function CheckoutClient({ locale, whatsappNumber }: { locale: string; whatsappNumber: string }) {
  const t = useTranslations("checkoutFlow");
  const router = useRouter();
  const loc = locale as "fr" | "ar" | "en";

  const { entries, totalPrice, clearCart } = useCartStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+212");
  const [phone, setPhone] = useState("");

  const [serviceMode, setServiceMode] = useState<ServiceMode | null>(null);
  const [paymentMode, setPaymentMode] = useState<"cash">("cash");
  const [markerLat, setMarkerLat] = useState(MAP_DEFAULT_CENTER.lat);
  const [markerLng, setMarkerLng] = useState(MAP_DEFAULT_CENTER.lng);
  const [addressLine, setAddressLine] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const subtotal = totalPrice();
  const deliveryFee =
    serviceMode === "delivery" ? DEFAULT_DELIVERY_FEE_MAD : 0;
  const grandTotal = subtotal + deliveryFee;

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

  function geocodeLatLng(lat: number, lng: number) {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.results?.[0]?.formatted_address) {
          setAddressLine(d.results[0].formatted_address);
        }
      })
      .catch(() => {});
  }

  function handleLocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerLat(lat);
        setMarkerLng(lng);
        geocodeLatLng(lat, lng);
      },
      () => {},
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
    setSubmitting(true);
    const orderItems = entries.map((e) => ({
      itemId: e.itemId,
      name: e.itemName[loc] ?? e.itemName.fr,
      quantity: e.quantity,
      basePrice: e.basePrice,
      options: e.chosenOptions.map((o) => ({
        name: o.optionName[loc] ?? o.optionName.fr,
        extraPrice: o.extraPrice,
      })),
      lineTotal: entryTotal(e),
    }));

    const customerAddress =
      serviceMode === "delivery"
        ? addressLine.trim()
        : serviceMode === "pickup"
          ? t("pickupAddress")
          : serviceMode === "dine_in"
            ? t("dineInAddress")
            : "";

    const orderMeta = {
      fullName,
      serviceMode,
      paymentMode,
      mapLat: serviceMode === "delivery" ? markerLat : null,
      mapLng: serviceMode === "delivery" ? markerLng : null,
      subtotal,
      deliveryFee,
      addressLine: serviceMode === "delivery" ? addressLine : null,
    };

    try {
      await createOrder({
        customerName: fullName,
        customerPhone: fullPhone,
        customerAddress,
        items: orderItems,
        total: grandTotal,
        orderMeta,
      });

      const sep = "──────────────";
      const serviceLineFr =
        serviceMode === "delivery"
          ? "Livraison"
          : serviceMode === "pickup"
            ? "A emporter"
            : "Sur place";
      const addressForWhatsapp =
        serviceMode === "delivery"
          ? addressLine.trim()
          : serviceMode === "pickup"
            ? "A emporter (sans adresse)"
            : "Sur place";

      const lines: string[] = [
        "NOUVELLE COMMANDE",
        sep,
        "",
        `Nom          : ${fullName}`,
        `Tel          : ${fullPhone}`,
        `Service      : ${serviceLineFr}`,
        `Paiement     : En espèces`,
        `Adresse      : ${addressForWhatsapp}`,
        "",
        sep,
        "DÉTAIL COMMANDE",
        sep,
        "",
      ];

      for (const entry of entries) {
        const name = entry.itemName.fr;
        const lineTotal = entryTotal(entry).toFixed(2);
        lines.push(`${entry.quantity}x  ${name}`);
        if (entry.chosenOptions.length > 0) {
          for (const opt of entry.chosenOptions) {
            const optName = opt.optionName.fr;
            lines.push(`     + ${optName}${opt.extraPrice > 0 ? ` (${opt.extraPrice.toFixed(2)} MAD)` : ""}`);
          }
        }
        lines.push(`     ${lineTotal} MAD`);
        lines.push("");
      }

      lines.push(sep);
      lines.push(`Sous-total   : ${subtotal.toFixed(2)} MAD`);
      if (deliveryFee > 0) {
        lines.push(`Livraison    : ${deliveryFee.toFixed(2)} MAD`);
      }
      lines.push(`TOTAL        : ${grandTotal.toFixed(2)} MAD`);
      lines.push(sep);

      const message = lines.join("\n");
      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

      const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
      clearCart();
      if (isMobile) window.location.href = url;
      else window.open(url, "_blank");
      router.replace("/");
    } catch {
      // Order save failed — stay on page; user can retry
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
    <div className="min-h-screen bg-white pb-8 pt-[env(safe-area-inset-top)] dark:bg-[#121316]">
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
              <span className="text-[13px] font-semibold text-[#65676B]">
                {t("labels.name")}
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("placeholders.name")}
                autoComplete="name"
                className="min-h-[48px] w-full rounded-xl border border-[#E4E6EB] px-3 text-[15px] outline-none focus:border-[#1877F2]"
              />
            </label>
            <div>
              <span className="text-[13px] font-semibold text-[#65676B]">
                {t("labels.phone")}
              </span>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="min-h-[48px] shrink-0 rounded-xl border border-[#E4E6EB] bg-white px-2 text-[14px] font-medium"
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
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-[#E4E6EB] px-3 text-[15px] outline-none focus:border-[#1877F2]"
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
                      (+{DEFAULT_DELIVERY_FEE_MAD} {t("currency")})
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
            <div className="-mx-4 w-[calc(100%+2rem)] sm:mx-0 sm:w-full">
              <CheckoutMap
                markerLat={markerLat}
                markerLng={markerLng}
                onLocate={handleLocate}
                locateLabel={t("map.locateMe")}
                onMarkerDragEnd={(lat, lng) => {
                  setMarkerLat(lat);
                  setMarkerLng(lng);
                }}
                onGeocode={setAddressLine}
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-[#65676B] dark:text-[#B0B3B8]">
                {t("labels.address")}
              </span>
              <textarea
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                rows={3}
                placeholder={t("placeholders.address")}
                className="w-full rounded-xl border border-[#E4E6EB] bg-white px-3 py-3 text-[14px] outline-none focus:border-[#1877F2] dark:border-[#3a3b3d] dark:bg-[#1c1e21]"
              />
            </label>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="mt-5 flex flex-col gap-5">
            <div className="rounded-2xl border border-[#E4E6EB] bg-[#FAFBFC] p-4">
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
                    ? addressLine || "—"
                    : serviceMode === "pickup"
                      ? t("pickupAddress")
                      : serviceMode === "dine_in"
                        ? t("dineInAddress")
                        : "—"
                }
              />
            </div>

            <div className="rounded-2xl border border-[#E4E6EB] p-4">
              <div className="flex justify-between text-[15px] text-[#65676B]">
                <span>{t("labels.subtotal")}</span>
                <span className="tabular-nums">
                  {subtotal.toFixed(2)} {t("currency")}
                </span>
              </div>
              {deliveryFee > 0 ? (
                <div className="mt-2 flex justify-between text-[15px] text-[#65676B]">
                  <span>{t("labels.deliveryFee")}</span>
                  <span className="tabular-nums">
                    {deliveryFee.toFixed(2)} {t("currency")}
                  </span>
                </div>
              ) : null}
              <div
                className="my-3 border-t border-[#E4E6EB]"
              />
              <div className="flex justify-between text-[17px] font-bold text-[#1C1E21]">
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
                className="min-h-[48px] flex-1 rounded-xl border border-[#E4E6EB] bg-[#F0F2F5] text-[14px] font-semibold text-[#1C1E21]"
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
                className="min-h-[48px] flex-1 rounded-xl border border-[#E4E6EB] bg-[#F0F2F5] text-[14px] font-semibold text-[#1C1E21]"
              >
                {t("actions.back")}
              </button>
              <button
                type="button"
                disabled={submitting}
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
                className="min-h-[48px] flex-1 rounded-xl border border-[#E4E6EB] bg-[#F0F2F5] text-[14px] font-semibold text-[#1C1E21]"
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
      </div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#ECEEF2] py-2.5 last:border-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8D91]">
        {label}
      </p>
      <p className="mt-1 text-[14px] leading-snug text-[#1C1E21]">{value}</p>
    </div>
  );
}
