import { afterEach, describe, expect, it } from "vitest";
import { resolvePlannerEngine } from "@/lib/planning-engine/staged/engine-flag";

describe("resolvePlannerEngine", () => {
  const prev = process.env.PLANNER_ENGINE;

  afterEach(() => {
    if (prev === undefined) delete process.env.PLANNER_ENGINE;
    else process.env.PLANNER_ENGINE = prev;
  });

  it("defaults to score when unset", () => {
    delete process.env.PLANNER_ENGINE;
    expect(resolvePlannerEngine()).toBe("score");
  });

  it("honors explicit option over env", () => {
    process.env.PLANNER_ENGINE = "staged";
    expect(resolvePlannerEngine("score")).toBe("score");
  });

  it("reads PLANNER_ENGINE=staged from env", () => {
    process.env.PLANNER_ENGINE = "staged";
    expect(resolvePlannerEngine()).toBe("staged");
  });
});
