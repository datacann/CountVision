import mobileAds from "react-native-google-mobile-ads";

const ANDROID_TEST_DEVICE_ID = "6CEF97B5BE009C695E02D6E3407A51DC";

let initializationPromise: Promise<void> | null = null;

export function initializeAds(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (__DEV__) {
        await mobileAds().setRequestConfiguration({
          testDeviceIdentifiers: [ANDROID_TEST_DEVICE_ID],
        });
      }

      await mobileAds().initialize();
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}
