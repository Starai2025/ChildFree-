export type PlanOption = {
  id: string;
  kind: string;
  created_by: string | null;
  place_id?: string | null;
  label: string;
  detail?: string | null;
  maps_url?: string | null;
  rating?: number | null;
  [key: string]: unknown;
};

export function storedGoogleOption(planId: string, place: { id: string; reason: string }) {
  return { plan_id: planId, kind: "place", place_id: place.id, label: "Suggested place", reason: place.reason };
}

export async function freshPlaceOptions(options: PlanOption[], apiKey: string, fetcher: typeof fetch = fetch): Promise<PlanOption[]> {
  return Promise.all(options.map(async (option) => {
    if (option.kind !== "place" || option.created_by !== null) return option;
    const unavailable = { ...option, label: "Suggested place unavailable", detail: null, maps_url: null, rating: null, attributions: [] };
    if (!option.place_id || !apiKey) return unavailable;
    try {
      const response = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(option.place_id)}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,googleMapsUri,rating,businessStatus,attributions",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return unavailable;
      const place = await response.json();
      if (place.id !== option.place_id || !place.displayName?.text || (place.businessStatus && place.businessStatus !== "OPERATIONAL")) return unavailable;
      return {
        ...option,
        label: String(place.displayName.text).slice(0, 120),
        detail: String(place.formattedAddress ?? "").slice(0, 240),
        maps_url: /^https:\/\//.test(place.googleMapsUri ?? "") ? place.googleMapsUri : null,
        rating: typeof place.rating === "number" && place.rating >= 0 && place.rating <= 5 ? place.rating : null,
        attributions: Array.isArray(place.attributions) ? place.attributions : [],
      };
    } catch {
      return unavailable;
    }
  }));
}
