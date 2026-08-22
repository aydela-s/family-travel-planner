"use client";

import { useState } from "react";
import Link from "next/link";
import { LAB_SCREENS, type LabScreen } from "./concepts";
import { ConceptScreen } from "./concepts/render";
import { DesignLabProvider } from "./state";

const FONT_OPTIONS = [
  {
    id: "inter",
    name: "Inter",
    oneLiner: "Neutral product UI default — highly legible, slightly technical.",
    className: "lab-font-inter",
  },
  {
    id: "jakarta",
    name: "Plus Jakarta Sans",
    oneLiner: "Softer geometric sans — friendly and modern without feeling playful.",
    className: "lab-font-jakarta",
  },
  {
    id: "manrope",
    name: "Manrope",
    oneLiner: "Clean semi-rounded sans — calm and contemporary for family travel.",
    className: "lab-font-manrope",
  },
] as const;

type FontId = (typeof FONT_OPTIONS)[number]["id"];

export function FontsOptionsPage() {
  const [fontId, setFontId] = useState<FontId>("jakarta");
  const [screen, setScreen] = useState<LabScreen>("home");
  const [compareAll, setCompareAll] = useState(false);

  const active = FONT_OPTIONS.find((f) => f.id === fontId)!;

  return (
    <DesignLabProvider conceptId="harbor" screen={screen}>
      <div className="min-h-screen bg-background text-ink">
        <div className="border-b border-border bg-surface px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-medium text-primary">Design Lab · Typography</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">App font styles</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Three modern UI faces for Harbor. The logo stays Poppins (it&apos;s in the brand PNG). Only body,
              headings, and controls change.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => {
                    setFontId(font.id);
                    setCompareAll(false);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    !compareAll && fontId === font.id
                      ? "bg-primary text-white"
                      : "border border-border bg-surface text-ink hover:border-ink/40"
                  }`}
                >
                  {font.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCompareAll(true)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  compareAll
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-ink hover:border-ink/40"
                }`}
              >
                Compare all three
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {LAB_SCREENS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScreen(item.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    screen === item.id ? "bg-ink text-white" : "bg-background text-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {!compareAll ? (
              <p className="mt-4 text-sm text-muted">
                <span className="font-semibold text-ink">{active.name}</span> — {active.oneLiner}
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Same <span className="font-semibold text-ink">{LAB_SCREENS.find((s) => s.id === screen)?.label}</span>{" "}
                screen in all three faces.
              </p>
            )}

            <p className="mt-2 text-sm text-muted">
              <Link href="/design-lab/harbor" className="font-medium text-primary underline-offset-2 hover:underline">
                Open Harbor
              </Link>
              {" · "}
              production UI uses Plus Jakarta Sans (logo stays Poppins in the brand PNG).
            </p>
          </div>
        </div>

        {compareAll ? (
          <div className="grid min-h-[calc(100vh-14rem)] lg:grid-cols-3">
            {FONT_OPTIONS.map((font) => (
              <section key={font.id} className="min-w-0 border-b border-border lg:border-b-0 lg:border-r lg:last:border-r-0">
                <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{font.name}</p>
                </div>
                <div className={`max-h-[calc(100vh-16rem)] overflow-auto ${font.className}`}>
                  <FontPreviewScreen screen={screen} onNavigate={setScreen} />
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={`mx-auto max-w-6xl ${active.className}`}>
            <FontPreviewScreen screen={screen} onNavigate={setScreen} />
          </div>
        )}
      </div>
    </DesignLabProvider>
  );
}

function FontPreviewScreen({
  screen,
  onNavigate,
}: {
  screen: LabScreen;
  onNavigate: (screen: LabScreen) => void;
}) {
  return (
    <div
      onClickCapture={(event) => {
        const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
        if (!href) return;
        if (href === "/design-lab/harbor" || href === "/design-lab/harbor/") {
          event.preventDefault();
          event.stopPropagation();
          onNavigate("home");
        }
        if (href === "/design-lab/harbor/plan") {
          event.preventDefault();
          event.stopPropagation();
          onNavigate("wizard");
        }
        if (href === "/design-lab/harbor/trip") {
          event.preventDefault();
          event.stopPropagation();
          onNavigate("itinerary");
        }
      }}
    >
      <ConceptScreen conceptId="harbor" screen={screen} />
    </div>
  );
}
