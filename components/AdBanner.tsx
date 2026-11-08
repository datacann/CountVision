import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { usePremium } from "./PremiumProvider";

const BANNER_HEIGHT = 50;

const IOS_BANNER_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/7319964658";
const ANDROID_BANNER_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/1171310501";

export default function AdBanner() {
  const { isPremium, isPremiumReady } = usePremium();
  // Reklam yüklenemezse (doluluk yok, ağ hatası vb.) boş şeridi gösterme.
  // Ekran bir sonraki açılışında yeniden bağlandığında tekrar denenir.
  const [failed, setFailed] = useState(false);
  if (!isPremiumReady || isPremium || failed) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={
          __DEV__
            ? TestIds.BANNER
            : Platform.OS === "ios"
              ? IOS_BANNER_AD_UNIT_ID
              : ANDROID_BANNER_AD_UNIT_ID
        }
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          if (__DEV__) console.warn("Banner reklam yüklenemedi", error);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: BANNER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17120F",
    overflow: "hidden",
    flexShrink: 0,
  },
});
