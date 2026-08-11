import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Orientation from "react-native-orientation-locker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AdBanner from "./AdBanner";

const TIPS = [
  "Çerçevenin dışında taş kalmasın.",
  "Işık yeterli olsun, fotoğraf bulanık olmasın.",
  "Telefonu mümkün olduğunca düz tut.",
];

const AD_AREA_HEIGHT = 50;

export default function TutorialScreen({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const screenWidth = Math.max(width, height);
  const screenHeight = Math.min(width, height);

  const isVerySmall = screenHeight <= 340;
  const isSmall = screenHeight <= 400;
  const isLarge = screenWidth >= 900;

  const horizontalPadding = isVerySmall ? 14 : isSmall ? 18 : 28;
  const verticalPadding = isVerySmall ? 6 : isSmall ? 10 : 16;

  const safeScreenHeight = Math.max(1, screenHeight - insets.top - insets.bottom);
  const availableHeight =
    safeScreenHeight - AD_AREA_HEIGHT - verticalPadding * 2;

  const leftWidth = Math.min(
    screenWidth * (isLarge ? 0.39 : 0.42),
    isLarge ? 430 : 370
  );

  const demoWidth = Math.min(
    screenWidth - leftWidth - horizontalPadding * 2 - 24,
    isLarge ? 610 : 510
  );

  const demoHeight = Math.min(
    availableHeight,
    isLarge ? 310 : 270
  );

  const frameWidth = demoWidth * 0.88;
  const frameHeight = demoHeight * (isVerySmall ? 0.5 : 0.54);

  const tileWidth = Math.max(
    30,
    Math.min(isLarge ? 48 : 42, frameWidth * 0.105)
  );

  const tileHeight = tileWidth * 1.3;

  const moveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      Orientation.lockToLandscape();

      return () => {};
    }, [])
  );

  useEffect(() => {
    const moveAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(moveAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(moveAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.025,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    moveAnimation.start();
    pulseAnimation.start();

    return () => {
      moveAnimation.stop();
      pulseAnimation.stop();
    };
  }, [moveAnim, pulseAnim]);

  const rackTranslateY = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isVerySmall ? 5 : 9, isVerySmall ? -2 : -5],
  });

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right", "bottom"]}
    >
      <View
        style={[
          styles.mainContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: verticalPadding,
            paddingBottom: verticalPadding,
            flex: 1,
          },
        ]}
      >
        <View
          style={[
            styles.leftSection,
            {
              width: leftWidth,
            },
          ]}
        >
          <View
            style={[
              styles.badge,
              {
                width: isVerySmall ? 24 : isSmall ? 28 : 34,
                height: isVerySmall ? 24 : isSmall ? 28 : 34,
                borderRadius: isVerySmall ? 12 : isSmall ? 14 : 17,
                marginBottom: isVerySmall ? 4 : 7,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.badgeText,
                {
                  fontSize: isVerySmall ? 11 : isSmall ? 13 : 15,
                },
              ]}
            >
              1
            </Text>
          </View>

          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.title,
              {
                fontSize: isVerySmall ? 18 : isSmall ? 21 : 27,
              },
            ]}
          >
            Istakanı doğru hizala
          </Text>

          <Text
            allowFontScaling={false}
            style={[
              styles.subtitle,
              {
                marginTop: isVerySmall ? 3 : 5,
                fontSize: isVerySmall ? 10 : isSmall ? 11 : 13,
                lineHeight: isVerySmall ? 13 : isSmall ? 15 : 18,
              },
            ]}
          >
            En iyi sonuç için ıstakanın tamamını yeşil çerçeveye
            sığdır.
          </Text>

          <View
            style={[
              styles.tipsCard,
              {
                marginTop: isVerySmall ? 6 : isSmall ? 9 : 13,
                paddingHorizontal: isVerySmall ? 8 : 11,
                paddingVertical: isVerySmall ? 5 : 8,
                gap: isVerySmall ? 3 : 6,
                borderRadius: isVerySmall ? 12 : 16,
              },
            ]}
          >
            {TIPS.map((tip) => (
              <View key={tip} style={styles.tipRow}>
                <View
                  style={[
                    styles.tipIconWrapper,
                    {
                      width: isVerySmall ? 16 : 20,
                      height: isVerySmall ? 16 : 20,
                      borderRadius: isVerySmall ? 8 : 10,
                    },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.tipIcon,
                      {
                        fontSize: isVerySmall ? 10 : 12,
                      },
                    ]}
                  >
                    ✓
                  </Text>
                </View>

                <Text
                  allowFontScaling={false}
                  numberOfLines={isVerySmall ? 1 : 2}
                  style={[
                    styles.tipText,
                    {
                      fontSize: isVerySmall ? 9 : isSmall ? 10 : 12,
                      lineHeight: isVerySmall ? 12 : isSmall ? 14 : 16,
                    },
                  ]}
                >
                  {tip}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.button,
              {
                marginTop: isVerySmall ? 6 : isSmall ? 8 : 12,
                height: isVerySmall ? 34 : isSmall ? 40 : 46,
                borderRadius: isVerySmall ? 12 : 16,
              },
            ]}
            onPress={() => navigation.replace("Home")}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.buttonText,
                {
                  fontSize: isVerySmall ? 11 : isSmall ? 13 : 15,
                },
              ]}
            >
              Taramaya başla
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.demoArea,
            {
              width: demoWidth,
              height: demoHeight,
              borderRadius: isVerySmall ? 16 : 22,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.demoTitle,
              {
                top: isVerySmall ? 8 : 12,
                left: isVerySmall ? 10 : 15,
                fontSize: isVerySmall ? 9 : isSmall ? 11 : 13,
              },
            ]}
          >
            Doğru çekim alanı
          </Text>

          <Animated.View
            style={[
              styles.frame,
              {
                width: frameWidth,
                height: frameHeight,
                borderRadius: isVerySmall ? 16 : 21,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.centerLine} />
          </Animated.View>

          <Animated.View
            style={[
              styles.rackMock,
              {
                width: frameWidth * 0.82,
                height: frameHeight * 0.56,
                borderRadius: isVerySmall ? 10 : 14,
                transform: [{ translateY: rackTranslateY }],
              },
            ]}
          >
            <View style={styles.rackWood}>
              <View
                style={[
                  styles.tileRow,
                  {
                    gap: isVerySmall ? 4 : 7,
                  },
                ]}
              >
                {["11", "12", "13", "3", "3"].map(
                  (item, index) => (
                    <View
                      key={`${item}-${index}`}
                      style={[
                        styles.tile,
                        {
                          width: tileWidth,
                          height: tileHeight,
                          borderRadius: isVerySmall ? 5 : 7,
                        },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.tileText,
                          {
                            fontSize: tileWidth * 0.48,
                          },
                          index === 3
                            ? styles.redText
                            : styles.blackText,
                        ]}
                      >
                        {item}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          </Animated.View>

          <Text
            allowFontScaling={false}
            style={[
              styles.demoHint,
              {
                bottom: isVerySmall ? 7 : 11,
                fontSize: isVerySmall ? 8 : isSmall ? 10 : 11,
                paddingHorizontal: isVerySmall ? 8 : 12,
                paddingVertical: isVerySmall ? 4 : 6,
              },
            ]}
          >
            Istaka yatay dursun, taşlar net görünsün.
          </Text>
        </View>
      </View>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#17120F",
  },

  mainContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },

  leftSection: {
    height: "100%",
    justifyContent: "center",
    flexShrink: 1,
  },

  badge: {
    backgroundColor: "#A87658",
    borderWidth: 1,
    borderColor: "#F5D7A1",
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  title: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  subtitle: {
    color: "#C9B7A7",
    fontWeight: "600",
  },

  tipsCard: {
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.12)",
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  tipIconWrapper: {
    backgroundColor: "rgba(0,255,136,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  tipIcon: {
    color: "#00FF88",
    fontWeight: "900",
  },

  tipText: {
    flex: 1,
    color: "#D8C5B5",
    fontWeight: "600",
  },

  button: {
    width: "100%",
    backgroundColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  buttonText: {
    color: "#07130D",
    fontWeight: "900",
  },

  demoArea: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.12)",
    overflow: "hidden",
    flexShrink: 1,
  },

  demoTitle: {
    position: "absolute",
    color: "#FFFFFF",
    fontWeight: "800",
  },

  frame: {
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.22)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },

  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#00FF88",
  },

  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },

  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },

  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },

  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },

  centerLine: {
    position: "absolute",
    left: 14,
    right: 14,
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  rackMock: {
    position: "absolute",
    overflow: "hidden",
  },

  rackWood: {
    flex: 1,
    backgroundColor: "#8B5A2B",
    borderWidth: 2,
    borderColor: "#5A3618",
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 14,
  },

  tileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  tile: {
    backgroundColor: "#F1E3B6",
    alignItems: "center",
    justifyContent: "center",
  },

  tileText: {
    fontWeight: "900",
  },

  blackText: {
    color: "#17120F",
  },

  redText: {
    color: "#9D1D24",
  },

  demoHint: {
    position: "absolute",
    color: "#E8D8C8",
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    overflow: "hidden",
  },

  adArea: { height: AD_AREA_HEIGHT, width: "100%", flexShrink: 0 },
});