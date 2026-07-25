"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { label: string; placeId: string };

export default function DestinationAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
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
    if (query.length < 2) {
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

    const seq = ++requestSeq.current;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
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
  }, [query]);

  function selectSuggestion(s: Suggestion) {
    pickedLabelRef.current = s.label;
    requestSeq.current += 1; // cancel in-flight search for the typed prefix
    setQuery(s.label);
    onChange(s.label);
    setSuggestions([]);
    setFetchError(false);
    setLoading(false);
    setOpen(false);
  }

  const showPanel = open && query.length >= 2 && !loading;
  const showEmptyState =
    showPanel && suggestions.length === 0 && pickedLabelRef.current !== query;

  return (
    <div ref={wrapperRef} className="relative">
      <input
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
          if (suggestions.length > 0 || query.length >= 2) setOpen(true);
        }}
        placeholder="Start typing a city..."
        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showPanel && (suggestions.length > 0 || showEmptyState)}
      />
      {loading && (
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
                onClick={() => selectSuggestion(s)}
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
            ? "Couldn’t load city suggestions — you can still type your destination and continue."
            : "No cities found — you can still type your destination and continue."}
        </div>
      )}
    </div>
  );
}
