"use client";

import { createContext, useContext, type ReactNode } from "react";

/** brand-heavy = current Harbor. signals = neutrals first, teal/coral only for state. */
export type HarborSkin = "brand-heavy" | "signals";

const HarborSkinContext = createContext<HarborSkin>("brand-heavy");

export function HarborSkinProvider({
  skin,
  children,
}: {
  skin: HarborSkin;
  children: ReactNode;
}) {
  return <HarborSkinContext.Provider value={skin}>{children}</HarborSkinContext.Provider>;
}

export function useHarborSkin() {
  return useContext(HarborSkinContext);
}
