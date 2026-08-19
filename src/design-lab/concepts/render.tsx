"use client";

import type { ReactNode } from "react";
import type { LabConceptId, LabScreen } from "../concepts";
import { AtlasHome, AtlasItinerary, AtlasWizard } from "./atlas";
import { BoardHome, BoardItinerary, BoardWizard } from "./board";
import { CompanionHome, CompanionItinerary, CompanionWizard } from "./companion";
import { JournalHome, JournalItinerary, JournalWizard } from "./journal";
import { LedgerHome, LedgerItinerary, LedgerWizard } from "./ledger";
import {
  DaylightHome,
  DaylightItinerary,
  DaylightWizard,
  HarborHome,
  HarborItinerary,
  HarborWizard,
  RouteHome,
  RouteItinerary,
  RouteWizard,
} from "../mix/screens";

const CONCEPT_FONT: Record<LabConceptId, string> = {
  ledger: "font-[family-name:var(--font-lab-plex)]",
  atlas: "font-[family-name:var(--font-lab-dm)]",
  journal: "font-[family-name:var(--font-poppins)]",
  board: "font-[family-name:var(--font-lab-plex)]",
  companion: "font-[family-name:var(--font-lab-outfit)]",
  harbor: "font-[family-name:var(--font-poppins)]",
  route: "font-[family-name:var(--font-lab-dm)]",
  daylight: "font-[family-name:var(--font-lab-outfit)]",
};

export function ConceptScreen({ conceptId, screen }: { conceptId: LabConceptId; screen: LabScreen }) {
  let view: ReactNode = null;
  if (conceptId === "ledger") {
    view = screen === "home" ? <LedgerHome /> : screen === "wizard" ? <LedgerWizard /> : <LedgerItinerary />;
  } else if (conceptId === "atlas") {
    view = screen === "home" ? <AtlasHome /> : screen === "wizard" ? <AtlasWizard /> : <AtlasItinerary />;
  } else if (conceptId === "journal") {
    view = screen === "home" ? <JournalHome /> : screen === "wizard" ? <JournalWizard /> : <JournalItinerary />;
  } else if (conceptId === "board") {
    view = screen === "home" ? <BoardHome /> : screen === "wizard" ? <BoardWizard /> : <BoardItinerary />;
  } else if (conceptId === "companion") {
    view = screen === "home" ? <CompanionHome /> : screen === "wizard" ? <CompanionWizard /> : <CompanionItinerary />;
  } else if (conceptId === "harbor") {
    view = screen === "home" ? <HarborHome /> : screen === "wizard" ? <HarborWizard /> : <HarborItinerary />;
  } else if (conceptId === "route") {
    view = screen === "home" ? <RouteHome /> : screen === "wizard" ? <RouteWizard /> : <RouteItinerary />;
  } else {
    view = screen === "home" ? <DaylightHome /> : screen === "wizard" ? <DaylightWizard /> : <DaylightItinerary />;
  }

  return (
    <div data-lab-concept={conceptId} className={CONCEPT_FONT[conceptId]}>
      {view}
    </div>
  );
}
