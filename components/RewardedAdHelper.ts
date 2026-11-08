import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { Platform } from "react-native";
import { initializeAds } from "../services/ads";
import { canShowAds } from "../services/premiumAccess";

const LOAD_TIMEOUT_MS = 30_000;
const IOS_REWARDED_AD_UNIT_ID = "ca-app-pub-4858173270247933/4083139214";
const ANDROID_REWARDED_AD_UNIT_ID = "ca-app-pub-4858173270247933/7937250595";

/**
 * - earned: reklam sonuna kadar izlendi, ödül verilmeli.
 * - dismissed: reklam açıldı ama ödül kazanılmadan kapatıldı.
 * - no_fill: şu anda gösterilecek reklam yok (doluluk yok ya da zaman aşımı).
 * - network_error: reklam ağ hatası yüzünden yüklenemedi.
 * - error: başka bir SDK/gösterim hatası ya da reklam gösterilemiyor.
 */
export type RewardedAdResult =
  | "earned"
  | "dismissed"
  | "no_fill"
  | "network_error"
  | "error";

function classifyLoadError(error: unknown): RewardedAdResult {
  const code = String(
    (error as { code?: unknown })?.code ??
      (error as { message?: unknown })?.message ??
      "",
  );
  if (code.includes("no-fill")) return "no_fill";
  if (code.includes("network-error")) return "network_error";
  return "error";
}

export async function showRewardedAnalysisAd(): Promise<RewardedAdResult> {
  if (!canShowAds()) return "error";
  try {
    await initializeAds();
  } catch (error) {
    if (__DEV__) console.warn("Ödüllü reklam SDK'sı hazır değil", error);
    return "error";
  }

  return new Promise((resolve) => {
    const rewarded = RewardedAd.createForAdRequest(
      __DEV__
        ? TestIds.REWARDED
        : Platform.OS === "ios"
          ? IOS_REWARDED_AD_UNIT_ID
          : ANDROID_REWARDED_AD_UNIT_ID,
      {
      requestNonPersonalizedAdsOnly: true,
      },
    );
    let earned = false;
    let shown = false;
    let finished = false;
    const cleanups: Array<() => void> = [];

    const finish = (value: RewardedAdResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      cleanups.forEach((cleanup) => cleanup());
      resolve(value);
    };

    cleanups.push(
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        if (finished) return;
        shown = true;
        clearTimeout(timeoutId);
        rewarded.show().catch(() => finish("error"));
      }),
      rewarded.addAdEventListener(AdEventType.CLOSED, () =>
        finish(earned ? "earned" : "dismissed"),
      ),
      rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        if (__DEV__) console.warn("Ödüllü reklam hatası", error);
        if (shown) {
          finish(earned ? "earned" : "error");
          return;
        }
        finish(classifyLoadError(error));
      }),
    );

    // Süre içinde reklam gelmediyse kullanıcı açısından "reklam bulunamadı".
    const timeoutId = setTimeout(() => finish("no_fill"), LOAD_TIMEOUT_MS);
    rewarded.load();
  });
}
