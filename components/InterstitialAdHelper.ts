import {
  AdEventType,
  InterstitialAd,
} from "react-native-google-mobile-ads";

const CAMERA_INTERVAL = 5;
const EDIT_INTERVAL = 5;
const LOAD_TIMEOUT_MS = 5000;

const IOS_INTERSTITIAL_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/8176529565";

let cameraOpenCount = 0;
let editActionCount = 0;
let isShowing = false;

function createInterstitial() {
  return InterstitialAd.createForAdRequest(
    IOS_INTERSTITIAL_AD_UNIT_ID,
    {
      requestNonPersonalizedAdsOnly: true,
    }
  );
}

function showInterstitial(): Promise<void> {
  return new Promise((resolve) => {
    if (isShowing) {
      resolve();
      return;
    }

    const interstitial = createInterstitial();

    let finished = false;
    let hasShown = false;

    const cleanups: Array<() => void> = [];

    const finish = () => {
      if (finished) return;

      finished = true;
      isShowing = false;

      cleanups.forEach((cleanup) => cleanup());
      clearTimeout(timeoutId);
      resolve();
    };

    cleanups.push(
      interstitial.addAdEventListener(AdEventType.LOADED, async () => {
        if (finished || hasShown || isShowing) return;

        hasShown = true;
        isShowing = true;

        try {
          await interstitial.show();
        } catch {
          finish();
        }
      })
    );

    cleanups.push(
      interstitial.addAdEventListener(AdEventType.CLOSED, finish)
    );

    cleanups.push(
      interstitial.addAdEventListener(AdEventType.ERROR, finish)
    );

    const timeoutId = setTimeout(finish, LOAD_TIMEOUT_MS);

    interstitial.load();
  });
}

export async function showAdEveryFiveCameraOpen(): Promise<void> {
  cameraOpenCount += 1;

  if (cameraOpenCount >= CAMERA_INTERVAL) {
    cameraOpenCount = 0;
    await showInterstitial();
  }
}

export async function showAdEveryFiveEditAction(): Promise<void> {
  editActionCount += 1;

  if (editActionCount >= EDIT_INTERVAL) {
    editActionCount = 0;
    await showInterstitial();
  }
}