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

/**
 * Premium durumu "unknown" ise belirlenene kadar (en fazla timeoutMs) bekler.
 * Süre dolarsa "unknown" döner.
 */
export function waitForPremiumAccess(
  timeoutMs: number,
): Promise<PremiumAccessState> {
  if (premiumAccessState !== "unknown") {
    return Promise.resolve(premiumAccessState);
  }

  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(premiumAccessState);
    }, timeoutMs);
    unsubscribe = subscribePremiumAccess((state) => {
      if (state === "unknown") return;
      clearTimeout(timer);
      unsubscribe();
      resolve(state);
    });
  });
}

export function canShowAds(): boolean {
  return premiumAccessState === "free";
}
