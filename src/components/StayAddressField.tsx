"use client";

import { useEffect, useState } from "react";

/** Free-text stay field — hotel name or address; resolved against the destination city on Next. */
export default function StayAddressField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (address: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <input
        id="stay-address"
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
        }}
        placeholder="Hotel name or street address"
        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted disabled:cursor-not-allowed disabled:bg-background"
        autoComplete="street-address"
      />
      <p className="mt-2 text-xs text-muted">
        Example: Marriott Downtown or 123 Main Street
      </p>
    </div>
  );
}
