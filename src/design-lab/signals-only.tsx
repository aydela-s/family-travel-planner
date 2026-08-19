"use client";

import { useRouter } from "next/navigation";
import { DesignLabChrome } from "./chrome";
import type { LabScreen } from "./concepts";
import { ConceptScreen } from "./concepts/render";
import { HarborSkinProvider } from "./harbor-skin";
import { DesignLabProvider } from "./state";

const MIX_HOME = "/design-lab/mix";
const MIX_PLAN = "/design-lab/mix/plan";
const MIX_TRIP = "/design-lab/mix/trip";

export function HarborSignalsOnly({ screen }: { screen: LabScreen }) {
  const router = useRouter();

  return (
    <DesignLabProvider conceptId="harbor" screen={screen}>
      <div className="min-h-screen bg-slate-100">
        <DesignLabChrome conceptId="harbor" screen={screen} navBasePath="/design-lab/mix" />
        <HarborSkinProvider skin="signals">
          <div
            onClickCapture={(event) => {
              const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
              if (href === "/design-lab/harbor" || href === "/design-lab/harbor/") {
                event.preventDefault();
                event.stopPropagation();
                router.push(MIX_HOME);
              }
              if (href === "/design-lab/harbor/plan") {
                event.preventDefault();
                event.stopPropagation();
                router.push(MIX_PLAN);
              }
              if (href === "/design-lab/harbor/trip") {
                event.preventDefault();
                event.stopPropagation();
                router.push(MIX_TRIP);
              }
            }}
          >
            <ConceptScreen conceptId="harbor" screen={screen} />
          </div>
        </HarborSkinProvider>
      </div>
    </DesignLabProvider>
  );
}
