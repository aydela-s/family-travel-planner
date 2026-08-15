"use client";

import { useEffect, useRef, useState } from "react";
import { coordsForDestinationPick } from "@/lib/destination-bias";
import {
  getLocalPlaceSuggestions,
  mergePlaceSuggestions,
} from "@/lib/places-autocomplete";

type Suggestion = { label: string; placeId: string };

export type DestinationSelection = {
  destination: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
};

const MIN_QUERY_LEN = 1;
/** Debounce network only — local catalog paints immediately. */
const NETWORK_DEBOUNCE_MS = 120;

/**
 * City autocomplete from Google Places `(cities)` + local popular fallback.
 * Typing updates the field; only picking a suggestion commits a resolved center.
 *
 * Local matches appear on the first letter; Places results merge in without
 * hiding the list while the request is in flight.
 */
export default function DestinationAutocomplete({
  value,
  onChange,
  onSelect,
  onResolvingChange,
}: {
  value: string;
  /** Fired while typing — clears a previous Places selection on the plan. */
  onChange: (destination: string) => void;
  /** Fired when the user picks a suggestion (coords from Details or popular bias). */
  onSelect: (selection: DestinationSelection) => void;
  /** Fired only while waiting on Place Details for an unknown city (button busy). */
  onResolvingChange?: (resolving: boolean) => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);
  /** When set, query matches a picked suggestion — don't re-fetch or show empty state. */
  const pickedLabelRef = useRef<string | null>(null);
  const selectSeq = useRef(0);

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
    if (query.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setFetchError(false);
      setLoading(false);
      return;
    }

    // Selecting from the list updates `query` to the full label — don't treat that as a failed search.
    if (pickedLabelRef.current === query) {
      setSuggestions([]);
      setFetchError(false);
      setLoading(false);
      setOpen(false);
      return;
    }

    // Paint local catalog immediately so typing never waits on Places.
    const local = getLocalPlaceSuggestions(query);
    setSuggestions(local);
    setFetchError(false);
    setOpen(true);

    const seq = ++requestSeq.current;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (seq !== requestSeq.current) return;
        if (!res.ok) {
          // Keep local rows; only show empty-state error when nothing local either.
          setSuggestions(getLocalPlaceSuggestions(query));
          setFetchError(true);
          setOpen(true);
          return;
        }
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        if (seq !== requestSeq.current) return;
        const remote = data.suggestions ?? [];
        // API already merges Google+local; re-merge with a fresh local pass so a
        // slower response can't wipe an updated prefix's instant rows.
        setSuggestions(
          mergePlaceSuggestions(remote, getLocalPlaceSuggestions(query)),
        );
        setOpen(true);
      } catch {
        if (controller.signal.aborted) return;
        if (seq !== requestSeq.current) return;
        setSuggestions(getLocalPlaceSuggestions(query));
        setFetchError(true);
        setOpen(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, NETWORK_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function selectSuggestion(s: Suggestion) {
    const seq = ++selectSeq.current;
    pickedLabelRef.current = s.label;
    requestSeq.current += 1;
    setQuery(s.label);
    setSuggestions([]);
    setFetchError(false);
    setLoading(false);
    setOpen(false);

    const instant = coordsForDestinationPick(s.label, s.placeId);
    if (instant) {
      // Commit immediately — Continue can proceed; refine coords in background.
      onSelect({
        destination: s.label,
        placeId: s.placeId,
        lat: instant.lat,
        lng: instant.lng,
      });
      onResolvingChange?.(false);
      void refineWithPlaceDetails(s, seq);
      return;
    }

    // Unknown city: need Place Details before Continue is valid.
    onResolvingChange?.(true);
    const details = await fetchPlaceDetails(s.placeId);
    if (seq !== selectSeq.current) return;

    if (details) {
      const label = details.address || s.label;
      pickedLabelRef.current = label;
      setQuery(label);
      onSelect({
        destination: label,
        placeId: details.placeId || s.placeId,
        lat: details.lat,
        lng: details.lng,
      });
      onResolvingChange?.(false);
      return;
    }

    onResolvingChange?.(false);
    pickedLabelRef.current = null;
    setFetchError(true);
    setOpen(true);
  }

  async function refineWithPlaceDetails(s: Suggestion, seq: number) {
    const details = await fetchPlaceDetails(s.placeId);
    if (seq !== selectSeq.current || !details) return;
    const label = details.address || s.label;
    pickedLabelRef.current = label;
    setQuery(label);
    onSelect({
      destination: label,
      placeId: details.placeId || s.placeId,
      lat: details.lat,
      lng: details.lng,
    });
  }

  const canShow = open && query.length >= MIN_QUERY_LEN && pickedLabelRef.current !== query;
  // Keep the list visible while Places loads — hiding it made typing feel broken.
  const showList = canShow && suggestions.length > 0;
  const showEmptyState =
    canShow && !loading && suggestions.length === 0;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id="destination"
        type="text"
        value={query}
        onChange={(e) => {
          pickedLabelRef.current = null;
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (pickedLabelRef.current === query) return;
          if (suggestions.length > 0 || query.length >= MIN_QUERY_LEN) setOpen(true);
        }}
        placeholder="Start typing a city..."
        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList || showEmptyState}
      />
      {loading && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
          Searching…
        </span>
      )}
      {showList && (
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
      {showEmptyState && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted shadow-[var(--shadow-card)]">
          {fetchError
            ? "Couldn’t confirm that city. Pick another suggestion from the list."
            : "No cities found — pick a suggested city from the list to continue."}
        </div>
      )}
    </div>
  );
}

async function fetchPlaceDetails(
  placeId: string,
): Promise<{ address?: string; placeId?: string; lat: number; lng: number } | null> {
  // Local catalog ids are not Google place ids — skip the network round-trip.
  if (!placeId.startsWith("ChIJ") && !placeId.includes("/") && placeId.length < 20) {
    return null;
  }
  try {
    const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: string;
      placeId?: string;
      lat?: number;
      lng?: number;
    };
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    return { address: data.address, placeId: data.placeId, lat: data.lat, lng: data.lng };
  } catch {
    return null;
  }
}
