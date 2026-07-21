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
  const wrapperRef = useRef<HTMLDivElement>(null);

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
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  function selectSuggestion(s: Suggestion) {
    setQuery(s.label);
    onChange(s.label);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Start typing a city..."
        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
          Searching...
        </span>
      )}
      {open && suggestions.length > 0 && (
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
    </div>
  );
}
