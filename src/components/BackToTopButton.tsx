"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 150;

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
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
      className="animate-fade-in fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-700 hover:shadow-xl"
    >
      ↑
    </button>
  );
}
