export function childTicketMultiplier(age: number): number {
  if (age <= 2) return 0;
  if (age <= 6) return 0.5;
  if (age <= 12) return 0.7;
  return 1;
}

export function familyActivityCost(
  adultPrice: number,
  adults: number,
  children: number[],
): number {
  let total = adults * adultPrice;
  for (const age of children) {
    total += adultPrice * childTicketMultiplier(age);
  }
  return Math.round(total * 100) / 100;
}

export function defaultActivityPrice(type: string, budgetPerDay: number): number {
  if (type === "meal" || type === "rest" || type === "nap" || type === "travel") return 0;
  return Math.max(15, Math.round(budgetPerDay * 0.12));
}
