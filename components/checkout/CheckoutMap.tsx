"use client";

import { useCallback } from "react";
import {
  Circle,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import {
  DELIVERY_RADIUS_M,
  MAP_DEFAULT_CENTER,
} from "@/lib/checkout-constants";

const mapContainerStyle = { width: "100%", height: 300 };

type Props = {
  markerLat: number;
  markerLng: number;
  onMarkerDragEnd: (lat: number, lng: number) => void;
  onGeocode: (address: string) => void;
  onLocate: () => void;
  locateLabel: string;
};

export function CheckoutMap({
  markerLat,
  markerLng,
  onMarkerDragEnd,
  onGeocode,
  onLocate,
  locateLabel,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const center = { lat: markerLat, lng: markerLng };

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const ll = e.latLng;
      const lat = typeof ll?.lat === "function" ? ll.lat() : null;
      const lng = typeof ll?.lng === "function" ? ll.lng() : null;
      if (lat == null || lng == null) return;
      onMarkerDragEnd(lat, lng);
      if (typeof window !== "undefined" && window.google?.maps) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results?.[0]?.formatted_address) {
            onGeocode(results[0].formatted_address);
          }
        });
      }
    },
    [onMarkerDragEnd, onGeocode],
  );

  if (!apiKey || loadError) {
    return (
      <div
        className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#E4E6EB] bg-[#F9FAFB] px-4 py-10 text-center text-[13px] text-[#65676B]"
        style={{ minHeight: 300 }}
      >
        <p className="font-semibold text-[#1C1E21]">Carte non disponible</p>
        <p className="mt-2 max-w-sm">
          Ajoutez{" "}
          <code className="rounded bg-[#E4E6EB] px-1 py-0.5 text-xs">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>{" "}
          pour activer la carte interactive.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-2xl bg-[#F0F2F5] text-[14px] text-[#65676B]"
        style={{ minHeight: 300 }}
      >
        Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#E4E6EB]">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        mapTypeId="roadmap"
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        <Circle
          center={MAP_DEFAULT_CENTER}
          radius={DELIVERY_RADIUS_M}
          options={{
            fillColor: "#1877F2",
            fillOpacity: 0.08,
            strokeColor: "#1877F2",
            strokeOpacity: 0.35,
            strokeWeight: 1,
          }}
        />
        <Marker
          position={{ lat: markerLat, lng: markerLng }}
          draggable
          onDragEnd={handleDragEnd}
        />
      </GoogleMap>
      <button
        type="button"
        onClick={onLocate}
        className="absolute end-3 top-3 z-10 rounded-xl border border-white/90 bg-white px-3 py-2 text-[13px] font-semibold text-[#1877F2] shadow-md transition-opacity active:opacity-90"
      >
        {locateLabel}
      </button>
    </div>
  );
}
