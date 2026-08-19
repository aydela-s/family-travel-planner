"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/config/brand";
import { LOADING_MESSAGES } from "@/types/generate";

export default function LoadingScreen({ message }: { message?: string }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [message]);

  const displayMessage = message ?? LOADING_MESSAGES[messageIndex];

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8 h-20 w-20 animate-loading-pin-pulse" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img src={BRAND.pinSrc} alt="" className="h-full w-full object-contain" />
      </div>

      <p
        key={displayMessage}
        className="animate-fade-in text-lg font-semibold text-ink"
      >
        {displayMessage}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {message
          ? "Hang tight. This won’t take long."
          : "Building a plan your whole family can actually enjoy..."}
      </p>

      <div className="mt-8 flex gap-2">
        {LOADING_MESSAGES.map((_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              index === messageIndex && !message
                ? "w-6 bg-accent"
                : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
