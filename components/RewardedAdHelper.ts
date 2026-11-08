import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { Platform } from "react-native";
import { initializeAds } from "../services/ads";
import { canShowAds } from "../services/premiumAccess";
import { adErrorCode, track, trackAdPaid } from "../services/analytics";

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
  const code = adErrorCode(error);
  if (code.includes("no-fill")) return "no_fill";
  if (code.includes("network-error")) return "network_error";
  return "error";
}

export async function showRewardedAnalysisAd(): Promise<RewardedAdResult> {
  const requestedAt = Date.now();
  track("ad_rewarded_requested");

  if (!canShowAds()) {
    track("ad_rewarded_result", { result: "error", code: "ads_disabled" });
    return "error";
  }
  try {
    await initializeAds();
  } catch (error) {
    if (__DEV__) console.warn("Ödüllü reklam SDK'sı hazır değil", error);
    track("ad_rewarded_result", { result: "error", code: "sdk_init_failed" });
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
    let shownAt = 0;
    let finished = false;
    const cleanups: Array<() => void> = [];

    const finish = (value: RewardedAdResult, code?: string) => {
      if (finished) return;
      finished = true;
      const now = Date.now();
      track("ad_rewarded_result", {
        result: value,
        code,
        load_ms: (shown ? shownAt : now) - requestedAt,
        view_ms: shown ? now - shownAt : null,
      });
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
        shownAt = Date.now();
        clearTimeout(timeoutId);
        rewarded.show().catch((error) => finish("error", adErrorCode(error)));
      }),
      rewarded.addAdEventListener(AdEventType.CLICKED, () => {
        track("ad_rewarded_clicked");
      }),
      rewarded.addAdEventListener(AdEventType.PAID, (event) => {
        trackAdPaid("rewarded", event);
      }),
      rewarded.addAdEventListener(AdEventType.CLOSED, () =>
        finish(earned ? "earned" : "dismissed"),
      ),
      rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        if (__DEV__) console.warn("Ödüllü reklam hatası", error);
        if (shown) {
          finish(earned ? "earned" : "error", adErrorCode(error));
          return;
        }
        finish(classifyLoadError(error), adErrorCode(error));
      }),
    );

    // Süre içinde reklam gelmediyse kullanıcı açısından "reklam bulunamadı".
    const timeoutId = setTimeout(
      () => finish("no_fill", "load_timeout"),
      LOAD_TIMEOUT_MS,
    );
    rewarded.load();
  });
}
