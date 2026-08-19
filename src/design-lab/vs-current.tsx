"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { DesignLabChrome } from "./chrome";
import { LAB_SCREENS, type LabScreen } from "./concepts";
import { ConceptScreen } from "./concepts/render";
import { CurrentProductScreen } from "./current-product";
import { DesignLabProvider } from "./state";

export function HarborVsCurrent({ currentHome }: { currentHome: ReactNode }) {
  const [screen, setScreen] = useState<LabScreen>("home");

  return (
    <DesignLabProvider conceptId="harbor" screen={screen}>
      <div className="min-h-screen bg-slate-100">
        <DesignLabChrome conceptId="harbor" screen="vs" />
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Harbor vs current UI</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Harbor on the left. The live product (ui-redesign / current homepage, wizard, and itinerary) on the
            right. Same Dallas trip. Wizard steps stay in sync.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LAB_SCREENS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScreen(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  screen === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid min-h-[calc(100vh-12rem)] lg:grid-cols-2">
          <section className="min-w-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <PaneLabel>Harbor</PaneLabel>
            <div
              className="max-h-[calc(100vh-14rem)] overflow-auto"
              onClickCapture={(event) => {
                const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
                if (href === "/design-lab/harbor" || href === "/design-lab/harbor/") {
                  event.preventDefault();
                  event.stopPropagation();
                  setScreen("home");
                }
                if (href === "/design-lab/harbor/plan") {
                  event.preventDefault();
                  event.stopPropagation();
                  setScreen("wizard");
                }
                if (href === "/design-lab/harbor/trip") {
                  event.preventDefault();
                  event.stopPropagation();
                  setScreen("itinerary");
                }
              }}
            >
              <ConceptScreen conceptId="harbor" screen={screen} />
            </div>
          </section>
          <section className="min-w-0">
            <PaneLabel>Current UI (ui-redesign)</PaneLabel>
            <div className="max-h-[calc(100vh-14rem)] overflow-auto">
              <CurrentProductScreen
                screen={screen}
                currentHome={currentHome}
                onStartPlan={() => setScreen("wizard")}
                onShowItinerary={() => setScreen("itinerary")}
              />
            </div>
          </section>
        </div>
      </div>
    </DesignLabProvider>
  );
}

function PaneLabel({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}
