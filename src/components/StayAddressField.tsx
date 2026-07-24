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
  disabled = false,
}: {
  value: string;
  onChange: (address: string) => void;
  /** Fired when the user picks a suggestion (includes coords when details resolve). */
  onSelect?: (selection: StayPlaceSelection) => void;
  destination?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    setQuery(value);
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
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, destination, disabled]);

  async function selectSuggestion(s: Suggestion) {
    setQuery(s.label);
    onChange(s.label);
    setOpen(false);
    setSuggestions([]);

    if (!onSelect) return;

    // Resolve coords via Place Details when we have a Google place id.
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

  const showPanel = !disabled && open && query.length >= 2 && !loading;

  return (
    <div ref={wrapperRef} className={`relative ${disabled ? "opacity-50" : ""}`}>
      <input
        id="stay-address"
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => !disabled && query.length >= 2 && setOpen(true)}
        placeholder="Hotel name or street address"
        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted disabled:cursor-not-allowed disabled:bg-background"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showPanel}
      />
      {loading && !disabled && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
          Searching...
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
          {fetchError
            ? "Couldn’t load stay suggestions — you can still type a hotel or address."
            : destination.trim()
              ? `No matches near ${destination.split(",")[0]?.trim() || "your destination"} — you can still type a hotel or address.`
              : "No matches — you can still type a hotel or address."}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {destination.trim()
          ? `Suggestions prefer places near ${destination.split(",")[0]?.trim()}.`
          : "Example: Marriott Downtown or 123 Main Street"}
      </p>
    </div>
  );
}
