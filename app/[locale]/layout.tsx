import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { HtmlAttributes } from "@/components/HtmlAttributes";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();
  const isRTL = locale === "ar";

  return (
    <NextIntlClientProvider messages={messages}>
      {/* Sets lang and dir on <html> after hydration */}
      <HtmlAttributes lang={locale} dir={isRTL ? "rtl" : "ltr"} />
      {children}
    </NextIntlClientProvider>
  );
}
