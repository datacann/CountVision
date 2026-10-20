import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";
import { getInstallationId } from "./usage";

const TEST_STORE_API_KEY = "test_WUNQQjcyJKZtfClKeEEPUOfpyGV";
// Public RevenueCat SDK keys. Fill these after the real App Store and Play Store
// configurations are created in RevenueCat; secret keys must never be put here.
const IOS_REVENUECAT_API_KEY = "appl_faqyTmkRUjDwubdRLFFbhoJPIkb";
const ANDROID_REVENUECAT_API_KEY = "goog_dArXYuJTZgIwHYcuoxeAqCVdFLe";
export const PREMIUM_ENTITLEMENT_ID = "101_hesaplama_pro";

export type SubscriptionPlan = "monthly" | "annual";
export type SubscriptionOption = {
  plan: SubscriptionPlan;
  price: string;
  productIdentifier: string;
};

const STORE_PRODUCT_IDS: Record<SubscriptionPlan, string> = {
  monthly: "com.datacanstudio.countvision.premium.monthly",
  annual: "com.datacanstudio.countvision.premium.yearly",
};

const FALLBACK_PRICES: Record<SubscriptionPlan, string> = {
  monthly: "₺29,99",
  annual: "₺299,99",
};

let initializationPromise: Promise<void> | null = null;

export function initializePurchases(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const apiKey = __DEV__
        ? TEST_STORE_API_KEY
        : Platform.OS === "ios"
          ? IOS_REVENUECAT_API_KEY
          : ANDROID_REVENUECAT_API_KEY;
      if (!apiKey) {
        throw new Error(`RevenueCat ${Platform.OS} production API key is missing`);
      }

      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      const appUserID = await getInstallationId();
      Purchases.configure({ apiKey, appUserID });
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

function hasPremium(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

async function getPlanPackage(plan: SubscriptionPlan): Promise<PurchasesPackage> {
  await initializePurchases();
  const offering = (await Purchases.getOfferings()).current;
  if (!offering) throw new Error("RevenueCat offering bulunamadı");

  const packageType = plan === "monthly" ? PACKAGE_TYPE.MONTHLY : PACKAGE_TYPE.ANNUAL;
  const selectedPackage = offering.availablePackages.find(
    (item) => item.packageType === packageType,
  );
  if (!selectedPackage) throw new Error(`${plan} paketi bulunamadı`);
  return selectedPackage;
}

export async function getSubscriptionOptions(): Promise<SubscriptionOption[]> {
  const plans: SubscriptionPlan[] = ["monthly", "annual"];
  return Promise.all(plans.map(async (plan) => {
    try {
      const selectedPackage = await getPlanPackage(plan);
      return {
        plan,
        price: __DEV__ ? FALLBACK_PRICES[plan] : selectedPackage.product.priceString,
        productIdentifier: selectedPackage.product.identifier,
      };
    } catch (error) {
      // App Store yeni ürünleri yayarken StoreKit kısa süreli boş dönebilir.
      // Paywall fiyat alanlarını kaybetmesin; satın alma anında paket yeniden alınır.
      if (__DEV__) console.warn(`${plan} paketi henüz mağazadan alınamadı`, error);
      return {
        plan,
        price: FALLBACK_PRICES[plan],
        productIdentifier: STORE_PRODUCT_IDS[plan],
      };
    }
  }));
}

export async function purchaseSubscription(plan: SubscriptionPlan): Promise<boolean> {
  const selectedPackage = await getPlanPackage(plan);
  const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
  return hasPremium(customerInfo);
}

export async function restoreSubscription(): Promise<boolean> {
  await initializePurchases();
  return hasPremium(await Purchases.restorePurchases());
}

export async function getPremiumStatus(): Promise<boolean> {
  await initializePurchases();
  return hasPremium(await Purchases.getCustomerInfo());
}
