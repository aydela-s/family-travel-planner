"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { label: string; placeId: string };

export type StayPlaceSelection = {
  address: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
};

/** Stay hotel/address field with Places autocomplete biased to the trip destination. */
export default function StayAddressField({
  value,
  onChange,
  onSelect,
  destination = "",
  destinationLat = null,
  destinationLng = null,
  disabled = false,
}: {
  value: string;
  onChange: (address: string) => void;
  /** Fired when the user picks a suggestion (includes coords when details resolve). */
  onSelect?: (selection: StayPlaceSelection) => void;
  destination?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);
  /** When set, query matches a committed pick — don't re-fetch or reopen the list. */
  const pickedLabelRef = useRef<string | null>(null);

  const destinationCity = destination.split(",")[0]?.trim() || "";

  useEffect(() => {
    setQuery(value);
    if (!value.trim()) pickedLabelRef.current = null;
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (disabled || query.length < 2) {
      setSuggestions([]);
      setFetchError(false);
      setLoading(false);
      return;
    }

    if (pickedLabelRef.current === query) {
      setSuggestions([]);
      setFetchError(false);
      setLoading(false);
      setOpen(false);
      return;
    }

    const seq = ++requestSeq.current;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const params = new URLSearchParams({
          q: query,
          mode: "address",
        });
        if (destination.trim()) {
          params.set("destination", destination.trim());
        }
        if (typeof destinationLat === "number" && typeof destinationLng === "number") {
          params.set("lat", String(destinationLat));
          params.set("lng", String(destinationLng));
        }
        const res = await fetch(`/api/places/autocomplete?${params}`, {
          signal: controller.signal,
        });
        if (seq !== requestSeq.current) return;
        if (!res.ok) {
          setSuggestions([]);
          setFetchError(true);
          setOpen(true);
          return;
        }
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        if (seq !== requestSeq.current) return;
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        if (controller.signal.aborted) return;
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
        setFetchError(true);
        setOpen(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, destination, destinationLat, destinationLng, disabled]);

  async function selectSuggestion(s: Suggestion) {
    pickedLabelRef.current = s.label;
    requestSeq.current += 1;
    setQuery(s.label);
    onChange(s.label);
    setOpen(false);
    setSuggestions([]);
    setLoading(false);
    setFetchError(false);

    if (!onSelect) return;

    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(s.placeId)}`,
      );
      if (!res.ok) {
        onSelect({
          address: s.label,
          placeId: s.placeId,
          lat: null,
          lng: null,
        });
        return;
      }
      const data = (await res.json()) as {
        address?: string;
        placeId?: string;
        lat?: number;
        lng?: number;
      };
      const address = data.address?.trim() || s.label;
      pickedLabelRef.current = address;
      setQuery(address);
      onSelect({
        address,
        placeId: data.placeId || s.placeId,
        lat: typeof data.lat === "number" ? data.lat : null,
        lng: typeof data.lng === "number" ? data.lng : null,
      });
    } catch {
      onSelect({
        address: s.label,
        placeId: s.placeId,
        lat: null,
        lng: null,
      });
    }
  }

  const showPanel =
    !disabled && open && query.length >= 2 && !loading && pickedLabelRef.current !== query;

  const emptyHint = fetchError
    ? "Suggestions aren’t loading right now — type your hotel or address and continue."
    : query.trim().length < 3
      ? "Keep typing your hotel name or street address."
      : "No suggestions yet — keep typing, or enter the stay as you know it.";

  return (
    <div ref={wrapperRef} className={`relative ${disabled ? "opacity-50" : ""}`}>
      <input
        id="stay-address"
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          pickedLabelRef.current = null;
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => {
          if (disabled || pickedLabelRef.current === query) return;
          if (query.length >= 2) setOpen(true);
        }}
        placeholder="Hotel name or street address"
        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted disabled:cursor-not-allowed disabled:bg-background"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showPanel && suggestions.length > 0}
      />
      {loading && !disabled && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
          Searching…
        </span>
      )}
      {showPanel && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-border bg-surface py-2 shadow-[var(--shadow-card)]">
          {suggestions.map((s) => (
            <li key={`${s.placeId}-${s.label}`}>
              <button
                type="button"
                onClick={() => void selectSuggestion(s)}
                className="w-full px-4 py-2.5 text-left text-sm text-ink transition hover:bg-primary-muted"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showPanel && suggestions.length === 0 && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted shadow-[var(--shadow-card)]">
          {emptyHint}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {destinationCity
          ? `We’ll prefer places near ${destinationCity}.`
          : "Example: Marriott Downtown or 123 Main Street"}
      </p>
    </div>
  );
}
