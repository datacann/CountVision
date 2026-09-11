export type PremiumAccessState = "unknown" | "free" | "premium";

let premiumAccessState: PremiumAccessState = "unknown";

export function setPremiumAccessState(state: PremiumAccessState): void {
  premiumAccessState = state;
}

export function canShowAds(): boolean {
  return premiumAccessState === "free";
}
