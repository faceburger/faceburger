"use client";

import { PublicMenuHero } from "@/components/PublicMenuHero";

type Props = {
  locale: string;
  settings: Record<string, string>;
};

export function CheckoutHero({ locale, settings }: Props) {
  const restaurantName = settings.restaurant_name || "FaceBurger";
  const restaurantAddress = settings.restaurant_address || "Agdal, Rabat, Maroc";
  const restaurantPhone = settings.restaurant_phone || "+212 6 00 00 00 00";

  return (
    <PublicMenuHero
      locale={locale}
      localePath="/checkout"
      coverImageUrl={settings.cover_image_url ?? ""}
      restaurantName={restaurantName}
      restaurantAddress={restaurantAddress}
      restaurantPhone={restaurantPhone}
      mapsUrl={settings.maps_url}
    />
  );
}
