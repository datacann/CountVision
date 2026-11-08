import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Orientation from "react-native-orientation-locker";
import { usePremium } from "./PremiumProvider";
import {
  getSubscriptionOptions,
  purchaseSubscription,
  restoreSubscription,
  type SubscriptionOption,
  type SubscriptionPlan,
} from "../services/subscriptions";
import { track } from "../services/analytics";

const BENEFITS = [
  "Reklamsız ve kesintisiz kullanım",
  "♛ En Yüksek El ile otomatik dizilim",
  "Daha fazla günlük analiz hakkı",
];

const LEGAL_BASE_URL = "https://countvision-backend-production.up.railway.app/legal";

export default function PaywallScreen({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isPremium, refreshPremium } = usePremium();
  const [options, setOptions] = useState<SubscriptionOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("annual");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<SubscriptionPlan | "restore" | null>(null);

  useEffect(() => {
    Orientation.lockToLandscape();
    getSubscriptionOptions()
      .then(setOptions)
      .catch((error) => {
        if (__DEV__) console.warn("Abonelik paketleri alınamadı", error);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedOption = useMemo(
    () => options.find((option) => option.plan === selectedPlan),
    [options, selectedPlan],
  );

  const buy = async () => {
    if (processing || !selectedOption) return;
    setProcessing(selectedPlan);
    track("purchase_started", { plan: selectedPlan });
    try {
      const premium = await purchaseSubscription(selectedPlan);
      await refreshPremium();
      track("purchase_result", {
        plan: selectedPlan,
        result: premium ? "success" : "not_active",
      });
      if (premium) {
        Alert.alert("Premium aktif ♛", "Tüm Premium özellikler kullanıma açıldı.", [
          { text: "Harika", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      track("purchase_result", {
        plan: selectedPlan,
        result: error?.userCancelled ? "cancelled" : "error",
        code: error?.code == null ? null : String(error.code),
      });
      if (!error?.userCancelled) {
        Alert.alert("Satın alma tamamlanamadı", error?.message ?? "Lütfen tekrar dene.");
      }
    } finally {
      setProcessing(null);
    }
  };

  const restore = async () => {
    if (processing) return;
    setProcessing("restore");
    try {
      const premium = await restoreSubscription();
      await refreshPremium();
      track("restore_result", { result: premium ? "restored" : "not_found" });
      Alert.alert(
        premium ? "Satın alma geri yüklendi" : "Satın alma bulunamadı",
        premium ? "Premium özelliklerin yeniden açıldı." : "Bu mağaza hesabında aktif abonelik bulunamadı.",
      );
    } catch (error: any) {
      track("restore_result", { result: "error" });
      Alert.alert("Geri yüklenemedi", error?.message ?? "Lütfen tekrar dene.");
    } finally {
      setProcessing(null);
    }
  };

  const openLegalLink = async (path: "privacy" | "terms") => {
    try {
      await Linking.openURL(`${LEGAL_BASE_URL}/${path}`);
    } catch {
      Alert.alert("Bağlantı açılamadı", "İnternet bağlantını kontrol edip tekrar dene.");
    }
  };

  const compact = Math.min(width, height) < 390;
  const panelWidth = Math.min(410, Math.max(350, width * 0.52));

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={[styles.closeButton, { left: insets.left + 18 }]}
        onPress={() => navigation.goBack()}
      >
        <Text allowFontScaling={false} style={styles.closeText}>×</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.brandRow}>
            <View style={styles.crownCircle}>
              <Text allowFontScaling={false} style={styles.crown}>♛</Text>
            </View>
            <Text allowFontScaling={false} style={styles.eyebrow}>101 HESAPLAMA PREMIUM</Text>
          </View>
          <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit style={[styles.title, compact && styles.titleCompact]}>
            {isPremium ? "Premium ayrıcalıkların" : "Premium ile elini güçlendir"}
          </Text>
          <Text allowFontScaling={false} style={styles.subtitle}>
            Daha hızlı hesapla, en yüksek eli tek dokunuşla bul.
          </Text>
          <View style={styles.benefits}>
            {BENEFITS.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Text allowFontScaling={false} style={styles.check}>✓</Text>
                <Text allowFontScaling={false} style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.purchasePanel, { width: panelWidth }, compact && styles.purchasePanelCompact]}>
          {isPremium ? (
            <View style={styles.activeCard}>
              <Text allowFontScaling={false} style={styles.activeCrown}>♛</Text>
              <Text allowFontScaling={false} style={styles.activeTitle}>Premium üyeliğin aktif</Text>
              <Text allowFontScaling={false} style={styles.activeText}>Reklamlar kapalı, En Yüksek El kullanıma hazır.</Text>
              <TouchableOpacity style={[styles.primaryButton, styles.activeButton]} onPress={() => navigation.goBack()}>
                <Text allowFontScaling={false} style={styles.primaryButtonText}>Devam et</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#00FF88" size="large" />
            </View>
          ) : (
            <>
              <View style={styles.planRow}>
                {(["monthly", "annual"] as SubscriptionPlan[]).map((plan) => {
                  const option = options.find((item) => item.plan === plan);
                  const selected = selectedPlan === plan;
                  return (
                    <TouchableOpacity
                      key={plan}
                      activeOpacity={0.82}
                      style={[styles.planCard, selected && styles.planCardSelected]}
                      onPress={() => setSelectedPlan(plan)}
                    >
                      {plan === "annual" && (
                        <View style={styles.bestBadge}>
                          <Text allowFontScaling={false} style={styles.bestBadgeText}>EN AVANTAJLI</Text>
                        </View>
                      )}
                      <Text allowFontScaling={false} style={styles.planName}>
                        {plan === "monthly" ? "Aylık" : "Yıllık"}
                      </Text>
                      <Text allowFontScaling={false} style={styles.planPrice}>{option?.price ?? "—"}</Text>
                      <Text allowFontScaling={false} style={styles.planPeriod}>
                        {plan === "monthly" ? "her ay" : "her yıl · 2 ay avantajlı"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.primaryButton, (!selectedOption || processing) && styles.buttonDisabled]}
                disabled={!selectedOption || Boolean(processing)}
                onPress={buy}
              >
                {processing === selectedPlan ? (
                  <ActivityIndicator color="#07130D" />
                ) : (
                  <Text allowFontScaling={false} style={styles.primaryButtonText}>Premium’a geç</Text>
                )}
              </TouchableOpacity>
              <Text allowFontScaling={false} style={styles.renewalText}>
                Ödeme mağaza hesabından alınır. Dönem bitmeden iptal edilmezse abonelik otomatik yenilenir.
              </Text>
            </>
          )}

          <View style={styles.footerLinks}>
            <TouchableOpacity disabled={Boolean(processing)} onPress={restore}>
              <Text allowFontScaling={false} style={styles.linkText}>
                {processing === "restore" ? "Geri yükleniyor..." : "Satın alımları geri yükle"}
              </Text>
            </TouchableOpacity>
            <Text allowFontScaling={false} style={styles.dot}>•</Text>
            <TouchableOpacity onPress={() => openLegalLink("terms")}>
              <Text allowFontScaling={false} style={styles.linkText}>Koşullar</Text>
            </TouchableOpacity>
            <Text allowFontScaling={false} style={styles.dot}>•</Text>
            <TouchableOpacity onPress={() => openLegalLink("privacy")}>
              <Text allowFontScaling={false} style={styles.linkText}>Gizlilik</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#100D0B" },
  content: { flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, paddingHorizontal: 42, paddingVertical: 18 },
  contentCompact: { gap: 18, paddingHorizontal: 34, paddingVertical: 10 },
  closeButton: { position: "absolute", top: 17, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#FFFFFF", fontSize: 28, lineHeight: 30, fontWeight: "500" },
  hero: { flex: 1, minWidth: 190, maxWidth: 410, paddingLeft: 34 },
  heroCompact: { paddingLeft: 28 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  crownCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,255,136,0.12)", borderWidth: 1, borderColor: "rgba(0,255,136,0.45)", alignItems: "center", justifyContent: "center" },
  crown: { color: "#F5D7A1", fontSize: 21 },
  eyebrow: { flexShrink: 1, color: "#00FF88", fontSize: 10.5, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#FFFFFF", fontSize: 28, lineHeight: 32, fontWeight: "900", marginTop: 13 },
  titleCompact: { fontSize: 24, lineHeight: 28 },
  subtitle: { color: "#C9B7A7", fontSize: 14, lineHeight: 20, fontWeight: "700", marginTop: 7 },
  benefits: { marginTop: 18, gap: 10 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, textAlign: "center", lineHeight: 22, color: "#07130D", backgroundColor: "#00FF88", fontWeight: "900" },
  benefitText: { color: "#F2E9E2", fontSize: 13, fontWeight: "800" },
  purchasePanel: { minHeight: 270, borderRadius: 24, padding: 17, backgroundColor: "#1D1815", borderWidth: 1, borderColor: "rgba(245,215,161,0.2)", justifyContent: "center" },
  purchasePanelCompact: { minHeight: 250, paddingVertical: 13 },
  loadingBox: { height: 190, alignItems: "center", justifyContent: "center" },
  planRow: { flexDirection: "row", gap: 10 },
  planCard: { flex: 1, minHeight: 132, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(245,215,161,0.23)", backgroundColor: "rgba(255,255,255,0.025)", justifyContent: "center" },
  planCardSelected: { borderWidth: 2, borderColor: "#00FF88", backgroundColor: "rgba(0,255,136,0.08)" },
  bestBadge: { position: "absolute", top: -9, right: 8, backgroundColor: "#00FF88", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
  bestBadgeText: { color: "#07130D", fontSize: 8, fontWeight: "900" },
  planName: { color: "#F5D7A1", fontSize: 13, fontWeight: "900" },
  planPrice: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginTop: 7 },
  planPeriod: { color: "#AE9D90", fontSize: 10, fontWeight: "700", marginTop: 3 },
  primaryButton: { height: 48, borderRadius: 15, marginTop: 13, backgroundColor: "#00FF88", alignItems: "center", justifyContent: "center" },
  activeButton: { alignSelf: "stretch", minWidth: 210 },
  primaryButtonText: { color: "#07130D", fontSize: 14, fontWeight: "900" },
  buttonDisabled: { opacity: 0.45 },
  renewalText: { color: "#8E8178", fontSize: 9.5, textAlign: "center", marginTop: 7 },
  footerLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 13 },
  linkText: { color: "#C9B7A7", fontSize: 10.5, fontWeight: "800" },
  dot: { color: "#675B54", fontSize: 10 },
  activeCard: { alignItems: "center", paddingHorizontal: 16 },
  activeCrown: { color: "#F5D7A1", fontSize: 42 },
  activeTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 5 },
  activeText: { color: "#B9AAA0", fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 6 },
});
