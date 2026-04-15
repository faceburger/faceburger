import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { getSettings } from "@/actions/settings";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const settings = await getSettings();
  return <CheckoutClient locale={locale} whatsappNumber={settings.whatsapp_number} settings={settings} />;
}
