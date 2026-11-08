export type PremiumAccessState = "unknown" | "free" | "premium";

type PremiumAccessListener = (state: PremiumAccessState) => void;

let premiumAccessState: PremiumAccessState = "unknown";
const listeners = new Set<PremiumAccessListener>();

export function setPremiumAccessState(state: PremiumAccessState): void {
  if (state === premiumAccessState) return;
  premiumAccessState = state;
  listeners.forEach((listener) => listener(state));
}

export function getPremiumAccessState(): PremiumAccessState {
  return premiumAccessState;
}

export function subscribePremiumAccess(
  listener: PremiumAccessListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function canShowAds(): boolean {
  return premiumAccessState === "free";
}
