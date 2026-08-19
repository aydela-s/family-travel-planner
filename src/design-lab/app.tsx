"use client";

import { DesignLabChrome } from "./chrome";
import { DesignLabCompare } from "./compare";
import { isLabConceptId, type LabConceptId, type LabScreen } from "./concepts";
import { ConceptScreen } from "./concepts/render";
import { DesignLabHub } from "./hub";
import { DesignLabProvider } from "./state";

export function DesignLabApp({ slug }: { slug?: string[] }) {
  const parsed = parseLabSlug(slug);

  return (
    <DesignLabProvider conceptId={parsed.conceptId ?? "ledger"} screen={parsed.screen === "wizard" || parsed.screen === "itinerary" || parsed.screen === "home" ? parsed.screen : "home"}>
      <div className="min-h-screen bg-slate-100">
        <DesignLabChrome conceptId={parsed.conceptId} screen={parsed.chrome} />
        {parsed.kind === "hub" ? <DesignLabHub /> : null}
        {parsed.kind === "compare" ? <DesignLabCompare /> : null}
        {parsed.kind === "concept" && parsed.conceptId ? (
          <ConceptScreen conceptId={parsed.conceptId} screen={parsed.screen as LabScreen} />
        ) : null}
      </div>
    </DesignLabProvider>
  );
}

function parseLabSlug(slug?: string[]): {
  kind: "hub" | "compare" | "concept";
  conceptId?: LabConceptId;
  screen?: LabScreen;
  chrome: LabScreen | "hub" | "compare";
} {
  if (!slug || slug.length === 0) {
    return { kind: "hub", chrome: "hub" };
  }
  if (slug[0] === "compare") {
    return { kind: "compare", chrome: "compare" };
  }
  if (!isLabConceptId(slug[0])) {
    return { kind: "hub", chrome: "hub" };
  }
  const conceptId = slug[0];
  const page = slug[1];
  const screen: LabScreen = page === "plan" ? "wizard" : page === "trip" ? "itinerary" : "home";
  return { kind: "concept", conceptId, screen, chrome: screen };
}
