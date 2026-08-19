"use client";

import { useState } from "react";
import { DesignLabChrome } from "./chrome";
import { LAB_SCREENS, type LabScreen } from "./concepts";
import { ConceptScreen } from "./concepts/render";
import { HarborSkinProvider } from "./harbor-skin";
import { DesignLabProvider } from "./state";

export function HarborVsSignals() {
  const [screen, setScreen] = useState<LabScreen>("home");

  return (
    <DesignLabProvider conceptId="harbor" screen={screen}>
      <div className="min-h-screen bg-slate-100">
        <DesignLabChrome conceptId="harbor" screen="signals" />
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Harbor vs neutrals-first</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Left is Harbor as it looks today. Right is the mixed direction: Harbor homepage, signals wizard, and a
            hybrid itinerary. Same Dallas trip; wizard steps stay in sync.
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
            <PaneLabel>Harbor (current mix)</PaneLabel>
            <HarborPane onScreen={setScreen}>
              <HarborSkinProvider skin="brand-heavy">
                <ConceptScreen conceptId="harbor" screen={screen} />
              </HarborSkinProvider>
            </HarborPane>
          </section>
          <section className="min-w-0">
            <PaneLabel>Mixed direction</PaneLabel>
            <HarborPane onScreen={setScreen}>
              <HarborSkinProvider skin="signals">
                <ConceptScreen conceptId="harbor" screen={screen} />
              </HarborSkinProvider>
            </HarborPane>
          </section>
        </div>
      </div>
    </DesignLabProvider>
  );
}

function HarborPane({
  children,
  onScreen,
}: {
  children: React.ReactNode;
  onScreen: (screen: LabScreen) => void;
}) {
  return (
    <div
      className="max-h-[calc(100vh-14rem)] overflow-auto"
      onClickCapture={(event) => {
        const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
        if (href === "/design-lab/harbor" || href === "/design-lab/harbor/") {
          event.preventDefault();
          event.stopPropagation();
          onScreen("home");
        }
        if (href === "/design-lab/harbor/plan") {
          event.preventDefault();
          event.stopPropagation();
          onScreen("wizard");
        }
        if (href === "/design-lab/harbor/trip") {
          event.preventDefault();
          event.stopPropagation();
          onScreen("itinerary");
        }
      }}
    >
      {children}
    </div>
  );
}

function PaneLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}
