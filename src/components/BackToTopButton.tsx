"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 150;

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function UpArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(getScrollTop() > SHOW_AFTER_PX);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    // Re-check shortly after mount too — content (e.g. images, autocomplete
    // results) can grow the page height after the initial layout pass.
    const recheck = window.setTimeout(handleScroll, 300);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      window.clearTimeout(recheck);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      title="Back to top"
      className="animate-fade-in fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-soft transition hover:bg-primary-hover hover:shadow-md"
    >
      <UpArrowIcon />
    </button>
  );
}
