import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Orientation from "react-native-orientation-locker";
import AdBanner from "./AdBanner";

const COLORS = ["yellow", "red", "black", "other"];

function getColorValue(color: string) {
  switch (color) {
    case "red":
      return "#C73333";
    case "black":
      return "#171717";
    case "yellow":
      return "#D8841C";
    case "other":
      return "#1FA45A";
    default:
      return "#1FA45A";
  }
}

function getColorLabel(color: string) {
  switch (color) {
    case "yellow":
      return "Sarı";
    case "red":
      return "Kırmızı";
    case "black":
      return "Siyah";
    case "other":
      return "Yeşil";
    default:
      return color;
  }
}

function getFakeOkeyNumber(indicatorNumber: number) {
  return indicatorNumber === 13 ? 1 : indicatorNumber + 1;
}

export default function IndicatorSetupScreen({ navigation, route }: any) {
  const result = route?.params?.result;
  const { width, height } = useWindowDimensions();

  const shortSide = Math.min(width, height);
  const scale = Math.min(1, shortSide / 390);

  const [indicatorNumber, setIndicatorNumber] = useState(1);
  const [indicatorColor, setIndicatorColor] = useState("yellow");
  const [infoVisible, setInfoVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Orientation.lockToLandscape();
      return () => {};
    }, [])
  );

  // Gösterge taşının aynı renkte bir büyüğü gerçek okeydir.
  const okeyNumber = getFakeOkeyNumber(indicatorNumber);
  const okeyColor = indicatorColor;

const continueToEdit = () => {
  const updatedTiles = (result?.all_tiles ?? result?.tiles ?? []).map(
    (tile: any) => {
      // Sadece gerçekten sahte okey olarak işaretlenmiş taşı dönüştür.
      // Normal unknown taşlara dokunma.
      if (!tile?.is_fake_okey) {
        return tile;
      }

      return {
        ...tile,
        number: String(okeyNumber),
        color: okeyColor,
        is_fake_okey: true,
        is_okey: false,
        is_joker: false,
      };
    }
  );

  navigation.replace("EditResult", {
    result: {
      ...result,
      tiles: updatedTiles,
      all_tiles: updatedTiles,
      okeyNumber,
      okeyColor,
      fakeOkeyNumber: okeyNumber,
      fakeOkeyColor: okeyColor,
      indicatorNumber,
      indicatorColor,
    },
  });
};
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text allowFontScaling={false} style={styles.badgeText}>
                ★
              </Text>
            </View>

            <View style={styles.headerTextArea}>
              <Text allowFontScaling={false} style={styles.title}>
                Oyundaki Gösterge Taşını Seç
              </Text>
              <Text allowFontScaling={false} style={styles.subtitle}>
  Masada açık duran gösterge taşını seç.
  {"\n"}
  Sahte okey otomatik olarak hesaplanacaktır.
</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.infoButton}
              onPress={() => setInfoVisible(true)}
            >
              <Text allowFontScaling={false} style={styles.infoButtonText}>
                ?
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contentRow}>
            <View style={styles.previewBox}>
              <Text
  allowFontScaling={false}
  style={{
    position: "absolute",
    top: 10,
    color: "#F5D7A1",
    fontWeight: "900",
    fontSize: 13,
  }}
>
  Gösterge → Sahte Okey
</Text>
              <View style={[styles.tile, { width: 58 * scale, height: 80 * scale }]}>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.tileNumber,
                    {
                      color: getColorValue(indicatorColor),
                      fontSize: 27 * scale,
                    },
                  ]}
                >
                  {indicatorNumber}
                </Text>
                <View
                  style={[
                    styles.tileDot,
                    { backgroundColor: getColorValue(indicatorColor) },
                  ]}
                />
              </View>

              <Text allowFontScaling={false} style={styles.arrow}>
                →
              </Text>

              <View style={[styles.fakeTile, { width: 58 * scale, height: 80 * scale }]}>
                <Text allowFontScaling={false} style={[styles.fakeStar, { fontSize: 27 * scale }]}>
                  ★
                </Text>
              </View>

              <View style={styles.fakeInfo}>
                <Text allowFontScaling={false} style={styles.fakeLabel}>
                  Sahte Okey
                </Text>
                <Text allowFontScaling={false} style={styles.fakeValue}>
                  {getColorLabel(okeyColor)} {okeyNumber}
                </Text>
              </View>
            </View>

            <View style={styles.selectorBox}>
              <Text allowFontScaling={false} style={styles.sectionTitle}>
                Sayı
              </Text>

              <View style={styles.numberRow}>
                {Array.from({ length: 13 }, (_, i) => i + 1).map((num) => (
                  <TouchableOpacity
                    key={num}
                    activeOpacity={0.8}
                    style={[
                      styles.numberButton,
                      indicatorNumber === num && styles.selectedNumber,
                    ]}
                    onPress={() => setIndicatorNumber(num)}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.numberText,
                        indicatorNumber === num && styles.selectedNumberText,
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text allowFontScaling={false} style={[styles.sectionTitle, { marginTop: 12 }]}>
                Renk
              </Text>

              <View style={styles.colorRow}>
                {COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    activeOpacity={0.8}
                    style={[
                      styles.colorButton,
                      indicatorColor === color && styles.selectedColor,
                    ]}
                    onPress={() => setIndicatorColor(color)}
                  >
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: getColorValue(color) },
                      ]}
                    />
                    <Text allowFontScaling={false} style={styles.colorText}>
                      {getColorLabel(color)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.continueButton}
            onPress={continueToEdit}
          >
            <Text allowFontScaling={false} style={styles.continueText}>
                Sahte Okeyi Onayla

            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Gösterge ve Sahte Okey
            </Text>
            <Text allowFontScaling={false} style={styles.modalText}>
              Oyunda masada açık duran gösterge taşını seç.
              {"\n\n"}
              Örnek: Gösterge Kırmızı 5 ise sahte okey Kırmızı 6 olur.
              {"\n\n"}
              Gösterge 13 ise sahte okey otomatik olarak 1 olur.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.modalCloseButton}
              onPress={() => setInfoVisible(false)}
            >
              <Text allowFontScaling={false} style={styles.modalCloseText}>
                Anladım
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#17120F",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 14,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    backgroundColor: "#241B17",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.18)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(168,118,88,0.95)",
    borderWidth: 1,
    borderColor: "#F5D7A1",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#F5D7A1",
    fontSize: 17,
    fontWeight: "900",
  },
  headerTextArea: {
    flex: 1,
    minWidth: 220,
    alignItems: "flex-start",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: "#C9B7A7",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  contentRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "stretch",
  },
  previewBox: {
    flex: 0.9,
    minHeight: 150,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.12)",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 12,
  },
  selectorBox: {
    flex: 1.3,
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 20,
    padding: 12,
  },
  tile: {
    borderRadius: 13,
    backgroundColor: "#F1E3B6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1BE89",
  },
  fakeTile: {
    borderRadius: 13,
    backgroundColor: "#F1E3B6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1BE89",
  },
  tileNumber: {
    fontWeight: "900",
  },
  tileDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
  },
  fakeStar: {
    color: "#6B3F1D",
    fontWeight: "900",
  },
  arrow: {
    color: "#F5D7A1",
    fontSize: 25,
    fontWeight: "900",
  },
  fakeInfo: {
    minWidth: 86,
  },
  fakeLabel: {
    color: "#C9B7A7",
    fontSize: 11,
    fontWeight: "800",
  },
  fakeValue: {
    color: "#00FF88",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },
  sectionTitle: {
    color: "#F5D7A1",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
  },
  numberRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  numberButton: {
    width: 38,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  selectedNumber: {
    backgroundColor: "#00FF88",
    borderColor: "#00FF88",
  },
  numberText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  selectedNumberText: {
    color: "#07130D",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectedColor: {
    borderColor: "#00FF88",
    backgroundColor: "rgba(0,255,136,0.10)",
  },
  colorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  continueButton: {
    marginTop: 14,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: "#07130D",
    fontSize: 14,
    fontWeight: "900",
  },

  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#F5D7A1",
    backgroundColor: "rgba(245,215,161,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoButtonText: {
    color: "#F5D7A1",
    fontSize: 17,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#2A201B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.30)",
    padding: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 10,
  },
  modalText: {
    color: "#E8D8C8",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  modalCloseButton: {
    height: 42,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#07130D",
    fontSize: 13,
    fontWeight: "900",
  },
});