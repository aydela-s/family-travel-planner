"use client";

import { useEffect, useState } from "react";
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
      <div className="relative mb-8">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        <span className="absolute inset-0 flex items-center justify-center text-xl" aria-hidden>
          ✈️
        </span>
      </div>

      <p
        key={displayMessage}
        className="animate-fade-in text-lg font-semibold text-slate-800"
      >
        {displayMessage}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        Building a plan your whole family can actually enjoy...
      </p>

      <div className="mt-8 flex gap-2">
        {LOADING_MESSAGES.map((_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              index === messageIndex && !message
                ? "w-6 bg-sky-500"
                : "w-1.5 bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
