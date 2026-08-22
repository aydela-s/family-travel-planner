import { describe, expect, it } from "vitest";
import { weekBoardStopLabel } from "./week-board-labels";

describe("weekBoardStopLabel", () => {
  it("uses the meal name instead of where it is served", () => {
    expect(weekBoardStopLabel({ type: "meal", title: "Kitchen breakfast" })).toBe("Breakfast");
    expect(weekBoardStopLabel({ type: "meal", title: "Breakfast near Louvre" })).toBe("Breakfast");
    expect(weekBoardStopLabel({ type: "meal", title: "Lunch at the hotel" })).toBe("Lunch");
    expect(weekBoardStopLabel({ type: "meal", title: "Dinner at Native Foods", slotKind: "dinner" })).toBe(
      "Dinner",
    );
  });

  it("labels naps as Nap", () => {
    expect(weekBoardStopLabel({ type: "nap", title: "Nap" })).toBe("Nap");
    expect(weekBoardStopLabel({ type: "nap", title: "Nap at sister’s house" })).toBe("Nap");
  });

  it("drops Explore / Family time at prefixes from activities", () => {
    expect(weekBoardStopLabel({ type: "activity", title: "Explore Play Street Museum" })).toBe(
      "Play Street Museum",
    );
    expect(weekBoardStopLabel({ type: "activity", title: "Family time at Kids Empire" })).toBe(
      "Kids Empire",
    );
  });
});
