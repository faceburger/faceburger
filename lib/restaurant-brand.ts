/** Shared branding / hero assets for menu + checkout. */
export const COVER_IMAGE =
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80";
export const RESTAURANT_NAME = "FaceBurger";
export const RESTAURANT_ADDRESS = "Agdal, Rabat, Maroc";
export const RESTAURANT_PHONE = "+212 6 00 00 00 00";
export const MAPS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(RESTAURANT_ADDRESS)}`;
export const PHONE_HREF = `tel:${RESTAURANT_PHONE.replace(/\s/g, "")}`;
