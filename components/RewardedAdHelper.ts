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

export async function showRewardedAnalysisAd(): Promise<boolean> {
  if (!canShowAds()) return false;
  try {
    await initializeAds();
  } catch (error) {
    if (__DEV__) console.warn("Ödüllü reklam SDK'sı hazır değil", error);
    return false;
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
    let finished = false;
    const cleanups: Array<() => void> = [];

    const finish = (value: boolean) => {
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
        rewarded.show().catch(() => finish(false));
      }),
      rewarded.addAdEventListener(AdEventType.CLOSED, () => finish(earned)),
      rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        if (__DEV__) console.warn("Ödüllü reklam yüklenemedi", error);
        finish(false);
      }),
    );

    const timeoutId = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
    rewarded.load();
  });
}
