"use client";

import { ReactNode } from "react";

export default function StepTransition({
  stepKey,
  direction,
  children,
}: {
  stepKey: number;
  direction: "forward" | "back";
  children: ReactNode;
}) {
  return (
    <div
      key={stepKey}
      className={direction === "forward" ? "animate-step-forward" : "animate-step-back"}
    >
      {children}
    </div>
  );
}
