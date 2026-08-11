import React from "react";
import { StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
} from "react-native-google-mobile-ads";

const BANNER_HEIGHT = 50;

const IOS_BANNER_AD_UNIT_ID =
  "ca-app-pub-4858173270247933/7319964658";

export default function AdBanner() {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={IOS_BANNER_AD_UNIT_ID}
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