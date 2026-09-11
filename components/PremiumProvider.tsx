import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import Purchases, { type CustomerInfo } from "react-native-purchases";
import {
  PREMIUM_ENTITLEMENT_ID,
  getPremiumStatus,
  initializePurchases,
} from "../services/subscriptions";
import { setPremiumAccessState } from "../services/premiumAccess";
import { syncPremiumWithBackend } from "../services/usage";

type PremiumContextValue = {
  isPremium: boolean;
  isPremiumReady: boolean;
  refreshPremium: () => Promise<boolean>;
};

const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  isPremiumReady: false,
  refreshPremium: async () => false,
});

function customerHasPremium(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

export function PremiumProvider({ children }: PropsWithChildren) {
  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumReady, setIsPremiumReady] = useState(false);

  const applyPremium = useCallback((active: boolean) => {
    setIsPremium(active);
    setIsPremiumReady(true);
    setPremiumAccessState(active ? "premium" : "free");
    return active;
  }, []);

  const refreshPremium = useCallback(async () => {
    try {
      const active = applyPremium(await getPremiumStatus());
      await syncPremiumWithBackend();
      return active;
    } catch (error) {
      if (__DEV__) console.warn("Premium durumu alınamadı", error);
      return applyPremium(false);
    }
  }, [applyPremium]);

  useEffect(() => {
    let active = true;
    const customerInfoListener = (customerInfo: CustomerInfo) => {
      if (active) {
        applyPremium(customerHasPremium(customerInfo));
        syncPremiumWithBackend().catch(() => undefined);
      }
    };

    initializePurchases()
      .then(() => {
        if (!active) return;
        Purchases.addCustomerInfoUpdateListener(customerInfoListener);
        return refreshPremium();
      })
      .catch(() => {
        if (active) applyPremium(false);
      });

    return () => {
      active = false;
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      setPremiumAccessState("unknown");
    };
  }, [applyPremium, refreshPremium]);

  const value = useMemo(
    () => ({ isPremium, isPremiumReady, refreshPremium }),
    [isPremium, isPremiumReady, refreshPremium],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  return useContext(PremiumContext);
}
