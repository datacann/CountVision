import {
  AdEventType,
  InterstitialAd,
  TestIds,
} from "react-native-google-mobile-ads";
import { Platform } from "react-native";
import { initializeAds } from "../services/ads";
import { adErrorCode, track, trackAdPaid } from "../services/analytics";
import {
  canShowAds,
  subscribePremiumAccess,
} from "../services/premiumAccess";

// Tek sayaç: her aksiyon puan ekler, POINTS_PER_AD puanda bir reklam gösterilir.
// Kamera açılışı tek başına 5 açılışta bir reklam demek; düzenleme ekranında
// her tamamlanmış işlem (bir taşın düzenlenip kapatılması, bir sürükle-bırak)
// 1 puan sayılır, yani yalnızca düzenleme yapan kullanıcı 10 işlemde bir görür.
export const AD_WEIGHT_CAMERA_OPEN = 2;
export const AD_WEIGHT_EDIT_ACTION = 1;
const POINTS_PER_AD = 10;

// İki geçiş reklamı arasında en az bu kadar süre olmalı.
const MIN_INTERVAL_MS = 90_000;
// Önceden yüklenen reklamlar ~1 saat sonra geçersiz olur; ondan önce yenilenir.
const AD_MAX_AGE_MS = 55 * 60_000;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 10 * 60_000;

const IOS_INTERSTITIAL_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/8176529565";
const ANDROID_INTERSTITIAL_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/1277929748";

type LoadState = "idle" | "loading" | "loaded";

/** Reklamın hangi güvenli anda denendiği (analitik için). */
export type InterstitialTrigger = "camera_open" | "edit_idle";

let ad: InterstitialAd | null = null;
let loadState: LoadState = "idle";
let loadedAt = 0;
let generation = 0;
let removeListeners: Array<() => void> = [];
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

let loadStartedAt = 0;

let isShowing = false;
let showingTrigger: InterstitialTrigger | null = null;
let shownAt = 0;
let resolveShowing: ((shown: boolean) => void) | null = null;

let adPoints = 0;
let lastShownAt = 0;

function interstitialUnitId(): string {
  if (__DEV__) return TestIds.INTERSTITIAL;
  return Platform.OS === "ios"
    ? IOS_INTERSTITIAL_AD_UNIT_ID
    : ANDROID_INTERSTITIAL_AD_UNIT_ID;
}

function discardAd() {
  generation += 1;
  removeListeners.forEach((remove) => remove());
  removeListeners = [];
  ad = null;
  loadState = "idle";
  loadedAt = 0;
}

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry(): number {
  clearRetry();
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryCount, RETRY_MAX_MS);
  retryCount += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    preloadInterstitial();
  }, delay);
  return delay;
}

function finishShowing(shown: boolean) {
  if (!isShowing) return;
  isShowing = false;
  showingTrigger = null;
  const resolve = resolveShowing;
  resolveShowing = null;
  discardAd();
  resolve?.(shown);
  // Gösterilen reklam kapanır kapanmaz bir sonrakini yüklemeye başla.
  preloadInterstitial();
}

function hasFreshAd(): boolean {
  return (
    ad !== null &&
    loadState === "loaded" &&
    Date.now() - loadedAt < AD_MAX_AGE_MS
  );
}

export function preloadInterstitial(): void {
  if (!canShowAds() || isShowing) return;
  if (loadState === "loading" || hasFreshAd()) return;

  discardAd();
  clearRetry();
  loadState = "loading";
  const loadGeneration = generation;

  initializeAds()
    .then(() => {
      if (loadGeneration !== generation) return;
      if (!canShowAds()) {
        discardAd();
        return;
      }

      const next = InterstitialAd.createForAdRequest(interstitialUnitId(), {
        requestNonPersonalizedAdsOnly: true,
      });
      ad = next;
      loadStartedAt = Date.now();

      removeListeners = [
        next.addAdEventListener(AdEventType.LOADED, () => {
          if (ad !== next) return;
          loadState = "loaded";
          loadedAt = Date.now();
          retryCount = 0;
          track("ad_interstitial_loaded", { load_ms: loadedAt - loadStartedAt });
        }),
        next.addAdEventListener(AdEventType.CLOSED, () => {
          if (ad !== next) return;
          track("ad_interstitial_closed", {
            trigger: showingTrigger,
            view_ms: Date.now() - shownAt,
          });
          finishShowing(true);
        }),
        next.addAdEventListener(AdEventType.CLICKED, () => {
          if (ad !== next) return;
          track("ad_interstitial_clicked", { trigger: showingTrigger });
        }),
        next.addAdEventListener(AdEventType.PAID, (event) => {
          trackAdPaid("interstitial", event);
        }),
        next.addAdEventListener(AdEventType.ERROR, (error) => {
          if (ad !== next) return;
          if (__DEV__) console.warn("Geçiş reklamı hatası", error);
          if (isShowing) {
            track("ad_interstitial_show_failed", {
              trigger: showingTrigger,
              code: adErrorCode(error),
            });
            finishShowing(false);
            return;
          }
          discardAd();
          const retryInMs = scheduleRetry();
          track("ad_interstitial_load_failed", {
            code: adErrorCode(error),
            load_ms: Date.now() - loadStartedAt,
            retry_in_ms: retryInMs,
          });
        }),
      ];

      next.load();
    })
    .catch((error) => {
      if (loadGeneration !== generation) return;
      if (__DEV__) console.warn("Geçiş reklamı için SDK hazır değil", error);
      discardAd();
      scheduleRetry();
    });
}

/** Kullanıcı bir aksiyonu tamamladığında puan ekler. Reklam göstermez. */
export function recordAdAction(weight: number): void {
  if (!canShowAds()) return;
  adPoints += weight;
}

/**
 * Yalnızca güvenli anlarda çağrılmalı (ekran geçişi, işlem bittikten sonra).
 * Puan eşiği dolmuşsa, son reklamdan bu yana yeterli süre geçmişse ve önceden
 * yüklenmiş bir reklam hazırsa hemen gösterir; hazır değilse beklemez,
 * yüklemeyi başlatıp false döner. Reklam kapanınca true ile çözülür.
 */
export function showInterstitialIfDue(
  trigger: InterstitialTrigger,
): Promise<boolean> {
  if (!canShowAds() || isShowing) return Promise.resolve(false);
  if (adPoints < POINTS_PER_AD) return Promise.resolve(false);

  // Buradan sonrası "reklam sırası gelmiş" demek; atlanırsa nedeni kaydedilir.
  const sinceLastMs = lastShownAt ? Date.now() - lastShownAt : null;
  if (sinceLastMs !== null && sinceLastMs < MIN_INTERVAL_MS) {
    track("ad_interstitial_skipped", {
      trigger,
      reason: "cooldown",
      points: adPoints,
      since_last_ms: sinceLastMs,
    });
    return Promise.resolve(false);
  }

  if (!hasFreshAd() || !ad) {
    track("ad_interstitial_skipped", {
      trigger,
      reason: "not_ready",
      points: adPoints,
      load_state: loadState,
    });
    preloadInterstitial();
    return Promise.resolve(false);
  }

  const current = ad;
  const previousPoints = adPoints;
  const previousShownAt = lastShownAt;

  track("ad_interstitial_shown", {
    trigger,
    points: adPoints,
    since_last_ms: sinceLastMs,
    ad_age_ms: Date.now() - loadedAt,
  });

  isShowing = true;
  showingTrigger = trigger;
  shownAt = Date.now();
  adPoints = 0;
  lastShownAt = shownAt;

  return new Promise((resolve) => {
    resolveShowing = resolve;
    current.show().catch((error) => {
      if (__DEV__) console.warn("Geçiş reklamı gösterilemedi", error);
      track("ad_interstitial_show_failed", {
        trigger,
        code: adErrorCode(error),
      });
      adPoints = previousPoints;
      lastShownAt = previousShownAt;
      finishShowing(false);
    });
  });
}

subscribePremiumAccess((state) => {
  if (state === "free") {
    preloadInterstitial();
    return;
  }
  adPoints = 0;
  clearRetry();
  if (!isShowing) discardAd();
});

if (canShowAds()) preloadInterstitial();
