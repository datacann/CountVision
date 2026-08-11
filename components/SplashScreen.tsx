import React, { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SplashScreen({ navigation }: any) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("Tutorial");
    }, 1600);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>101</Text>
      </View>

      <Text style={styles.title}>101 Hesaplama</Text>
      <Text style={styles.subtitle}>Taşlarını tara, perlerini hesapla</Text>

      <ActivityIndicator style={styles.loader} color="#F5D7A1" size="small" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#17120F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoBox: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: "#A87658",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#F5D7A1",
  },
  logoText: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#C9B7A7",
    textAlign: "center",
  },
  loader: {
    marginTop: 36,
  },
});