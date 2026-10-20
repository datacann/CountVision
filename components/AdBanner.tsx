import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
} from "react-native-google-mobile-ads";
import { usePremium } from "./PremiumProvider";

const BANNER_HEIGHT = 50;

const IOS_BANNER_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/7319964658";
const ANDROID_BANNER_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/1171310501";

export default function AdBanner() {
  const { isPremium, isPremiumReady } = usePremium();
  if (!isPremiumReady || isPremium) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={
          Platform.OS === "ios"
            ? IOS_BANNER_AD_UNIT_ID
            : ANDROID_BANNER_AD_UNIT_ID
        }
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
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
