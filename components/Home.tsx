import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  AppState,
Linking,
} from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { useFocusEffect } from "@react-navigation/native";
import Orientation from "react-native-orientation-locker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { showAdEveryFiveCameraOpen } from "./InterstitialAdHelper";

type BackendStatus = "ok" | "not_detected" | "uncertain";

const LOADING_MESSAGES = [
  "📸 Fotoğraf alındı",
  "🔍 Istaka içindeki taşlar aranıyor...",
  "🎯 Taşların renkleri ve sayıları okunuyor...",
  "🧮 Per ve seriler hesaplanıyor...",
  "✨ Sonuç hazırlanıyor...",
];

const API_URL = __DEV__
  ? "https://countvision-backend-production.up.railway.app/count"
  : "https://countvision-backend-production.up.railway.app/count";
  
export default function Home({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const screenWidth = Math.max(width, height);
  const screenHeight = Math.min(width, height);

  const FRAME_X = 0.05;
  const FRAME_Y = 0.25;
  const FRAME_W = 0.86;
  const FRAME_H = 0.38;

  const usableWidth = Math.max(1, screenWidth - insets.left - insets.right);
  const boxWidth = usableWidth * FRAME_W;
  const boxHeight = screenHeight * FRAME_H;
  const frameLeft = insets.left + usableWidth * FRAME_X;
  const frameTop = screenHeight * FRAME_Y;
  const frameXRatio = frameLeft / screenWidth;
  const frameYRatio = frameTop / screenHeight;
  const frameWRatio = boxWidth / screenWidth;

  const cameraRef = useRef<Camera>(null);

  // 0.5x için mümkünse doğrudan ultra geniş fiziksel kamerayı kullan.
  // Cihaz/Android bunu Vision Camera'ya sunmuyorsa normal geniş kameraya düşer.
  const ultraWideDevice = useCameraDevice("back", {
    physicalDevices: ["ultra-wide-angle-camera"],
  });
  const wideDevice = useCameraDevice("back", {
    physicalDevices: ["wide-angle-camera"],
  });
  const device = ultraWideDevice ?? wideDevice;

const [permissionStatus, setPermissionStatus] = useState<
  "loading" | "granted" | "denied"
>("loading");
  const [cameraReady, setCameraReady] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  const requestCameraPermission = useCallback(async () => {
  try {
    setPermissionStatus("loading");

    const permission = await Camera.requestCameraPermission();

    setPermissionStatus(
      permission === "granted" ? "granted" : "denied"
    );
  } catch {
    setPermissionStatus("denied");
  }
}, []);

const openAppSettings = useCallback(async () => {
  try {
    await Linking.openSettings();
  } catch {
    setMessage("Telefon ayarları açılamadı.");
  }
}, []);

  const resetPhoto = useCallback(() => {
    setPhotoTaken(false);
    setPhotoPath(null);
    setMessage(null);
    setStatus(null);
    setCount(0);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setCameraReady(false);
      resetPhoto();

      Orientation.lockToLandscape();

      const readyTimer = setTimeout(() => {
        setCameraReady(true);
      }, 700);

      showAdEveryFiveCameraOpen();

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          navigation.replace("Tutorial");
          return true;
        }
      );

      return () => {
        clearTimeout(readyTimer);
        backHandler.remove();
        setCameraReady(false);
      };
    }, [navigation, resetPhoto])
  );

useEffect(() => {
  requestCameraPermission();
}, [requestCameraPermission]);

useEffect(() => {
  const subscription = AppState.addEventListener(
    "change",
    async (nextState) => {
      if (nextState !== "active") return;

      const permission = await Camera.getCameraPermissionStatus();

      setPermissionStatus(
        permission === "granted" ? "granted" : "denied"
      );
    }
  );

  return () => subscription.remove();
}, []);

  useEffect(() => {
  if (!loading) {
    setLoadingMessageIndex(0);
    return;
  }

  const interval = setInterval(() => {
    setLoadingMessageIndex((prev) => {
      if (prev >= LOADING_MESSAGES.length - 1) return prev;
      return prev + 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [loading]);

  const sendToBackend = async (imagePath: string) => {
    try {
      setLoading(true);
setLoadingMessageIndex(0);
setMessage(LOADING_MESSAGES[0]);
      const formData = new FormData();

      formData.append("file", {
        uri: imagePath,
        name: "photo.jpg",
        type: "image/jpeg",
      } as any);

      formData.append("frame_x", String(frameXRatio));
      formData.append("frame_y", String(frameYRatio));
      formData.append("frame_w", String(frameWRatio));
      formData.append("frame_h", String(FRAME_H));

const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 60000);

let res: Response;

try {
  res = await fetch(API_URL, {
    method: "POST",
    body: formData,
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeout);
}

      if (!res.ok) {
        throw new Error("Backend error");
      }

      const data = await res.json();

const isValidStatus =
  data?.status === "ok" ||
  data?.status === "not_detected" ||
  data?.status === "uncertain";

const hasValidGroups =
  Array.isArray(data?.groups) ||
  Array.isArray(data?.tiles) ||
  Array.isArray(data?.predictions);

if (!data || typeof data !== "object") {
  throw new Error("Invalid response");
}

if (!isValidStatus) {
  throw new Error("Invalid response");
}

if (data.status === "ok" && !hasValidGroups) {
  throw new Error("Invalid response");
}

const safeCount =
  typeof data.count === "number" && Number.isFinite(data.count)
    ? data.count
    : 0;

setCount(safeCount);
setStatus(data.status);

navigation.replace("EditResult", {
  result: data,
});
} catch (err: any) {
  setStatus("not_detected");
  setCount(0);

  if (err?.name === "AbortError") {
    setMessage("⏳ İşlem zaman aşımına uğradı.\nLütfen tekrar deneyin.");
  } else if (err?.message?.includes("Network request failed")) {
    setMessage("📶 İnternet bağlantınızı kontrol edin.");
  } else if (err?.message?.includes("Backend error")) {
    setMessage("📷 Fotoğraf analiz edilemedi.\nLütfen tekrar çekin.");
  } else {
    setMessage("❌ Beklenmeyen bir hata oluştu.\nLütfen tekrar deneyin.");
  }
} finally {
  setLoading(false);
  }; };

const takePhoto = async () => {
  if (!cameraRef.current || loading || !cameraReady || isTakingPhoto) return;

  try {
    setIsTakingPhoto(true);

const photo = await cameraRef.current.takePhoto({
  flash: "off",
  enableShutterSound: false,
});

    const imagePath = `file://${photo.path}`;

    setPhotoPath(imagePath);
    setPhotoTaken(true);
    setCount(0);
    setStatus(null);
    setMessage(null);

    await sendToBackend(imagePath);
  } finally {
    setIsTakingPhoto(false);
  }
};
if (permissionStatus === "loading") {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#00FF88" />

      <Text allowFontScaling={false} style={styles.loadingText}>
        Kamera izni kontrol ediliyor...
      </Text>
    </View>
  );
}

if (permissionStatus === "denied") {
  return (
    <SafeAreaView
      style={styles.permissionContainer}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.permissionCard}>
        <Text
          allowFontScaling={false}
          style={styles.permissionIcon}
        >
          📷
        </Text>

        <Text
          allowFontScaling={false}
          style={styles.permissionTitle}
        >
          Kamera izni gerekli
        </Text>

        <Text
          allowFontScaling={false}
          style={styles.permissionDescription}
        >
          Istakanı çekip taşları analiz edebilmek için kamera
          erişimine izin vermen gerekiyor.
        </Text>

        <View style={styles.permissionButtons}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.permissionButton,
              styles.settingsButton,
            ]}
            onPress={openAppSettings}
          >
            <Text
              allowFontScaling={false}
              style={styles.settingsButtonText}
            >
              Ayarları aç
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.permissionButton,
              styles.retryPermissionButton,
            ]}
            onPress={requestCameraPermission}
          >
            <Text
              allowFontScaling={false}
              style={styles.retryPermissionText}
            >
              Tekrar dene
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

if (!device) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#00FF88" />

      <Text allowFontScaling={false} style={styles.loadingText}>
        Kamera hazırlanıyor...
      </Text>
    </View>
  );
}

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      {!photoTaken && cameraReady && (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={cameraReady && !photoTaken && !loading}
          photo={true}
          resizeMode="cover"
          zoom={device.neutralZoom ?? device.minZoom ?? 1}
        />
      )}

      {!photoTaken && !cameraReady && (
        <View style={styles.center}>
          <ActivityIndicator color="#00FF88" />
          <Text allowFontScaling={false} style={styles.loadingText}>
            Kamera hazırlanıyor...
          </Text>
        </View>
      )}

      {photoTaken && photoPath && (
        <Image source={{ uri: photoPath }} style={styles.fullPreview} resizeMode="cover" />
      )}

      <View style={styles.darkLayer} />

      <View style={[styles.header, { left: insets.left + 26 }]}>
        <Text allowFontScaling={false} style={styles.appName}>
          101 Hesaplama
        </Text>
        <Text allowFontScaling={false} style={styles.headerSubtitle}>
          Istakanı çerçeveye al
        </Text>
      </View>

      <View style={[styles.badge, { right: insets.right + 24 }]}>
        <Text allowFontScaling={false} style={styles.badgeText}>
          AI
        </Text>
      </View>

      {cameraReady && (
        <View
          style={[
            styles.scanArea,
            {
              width: boxWidth,
              height: boxHeight,
              left: frameLeft,
              top: frameTop,
            },
          ]}
        >
          <View style={styles.guideBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.centerLine} />
            <Text allowFontScaling={false} style={styles.insideHint}>
              Istaka alanı
            </Text>
          </View>
        </View>
      )}

      {cameraReady && !photoTaken && (
        <View style={[styles.helperWrapper, { left: insets.left, right: insets.right }]}>
          <Text allowFontScaling={false} style={styles.helperText}>
            Taşların tamamını yeşil çerçeveye sığdır
          </Text>
        </View>
      )}

      {cameraReady && !photoTaken && (
        <View style={[styles.bottomHintBox, { right: insets.right + 22 }]}>
          <Text allowFontScaling={false} style={styles.bottomHint}>
            Telefonu yatay tut, ıstaka net görünsün.
          </Text>
        </View>
      )}

      {photoTaken && (
        <View style={styles.resultCard}>
          {loading ? (
            <>
              <ActivityIndicator color="#F5D7A1" />
              <Text allowFontScaling={false} style={styles.resultTitle}>
                  {LOADING_MESSAGES[loadingMessageIndex]}

              </Text>
            </>
          ) : (
            <Text allowFontScaling={false} style={styles.resultTitle}>
              {message ?? "Fotoğraf hazır"}
            </Text>
          )}
        </View>
      )}

      {!photoTaken ? (
        <View style={[styles.captureArea, { left: insets.left + 24 }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.captureButton,
(!cameraReady || loading || isTakingPhoto) && styles.captureButtonDisabled,
            ]}
            onPress={takePhoto}
disabled={!cameraReady || loading || isTakingPhoto}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>

          <Text allowFontScaling={false} style={styles.captureText}>
            Çek
          </Text>
        </View>
      ) : (
        <View style={[styles.actionRow, { left: insets.left + 24 }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={resetPhoto}
            disabled={loading}
          >
            <Text allowFontScaling={false} style={styles.secondaryText}>
              Tekrar çek
            </Text>
          </TouchableOpacity>

          {!loading && status === "not_detected" && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => photoPath && sendToBackend(photoPath)}
            >
              <Text allowFontScaling={false} style={styles.primaryText}>
                Tekrar dene
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#17120F",
    overflow: "hidden",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#17120F",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  fullPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  darkLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  header: {
    position: "absolute",
    top: 30,
    left: 26,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  headerSubtitle: {
    marginTop: 2,
    color: "#D8C5B5",
    fontSize: 12,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: 28,
    right: 24,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(168,118,88,0.95)",
    borderWidth: 1,
    borderColor: "#F5D7A1",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  scanArea: {
    position: "absolute",
  },
  guideBox: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.28)",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: "#00FF88",
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 18,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 18,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 18,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 18,
  },
  centerLine: {
    position: "absolute",
    left: 18,
    right: 18,
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  insideHint: {
    position: "absolute",
    alignSelf: "center",
    top: 9,
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: "800",
  },
  helperWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
  },
  helperText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  bottomHintBox: {
    position: "absolute",
    right: 22,
    bottom: 22,
    width: 150,
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bottomHint: {
    color: "#E8D8C8",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    fontWeight: "800",
  },
  captureArea: {
    position: "absolute",
    left: 24,
    bottom: 20,
    alignItems: "center",
  },
  captureButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 3,
    borderColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonDisabled: {
    opacity: 0.45,
    borderColor: "rgba(255,255,255,0.35)",
  },
  captureInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  captureText: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  resultCard: {
    position: "absolute",
    top: 64,
    left: 120,
    right: 120,
    backgroundColor: "rgba(23,18,15,0.94)",
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.25)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  resultTitle: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  actionRow: {
    position: "absolute",
    left: 24,
    bottom: 20,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    height: 44,
    minWidth: 124,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButton: {
    backgroundColor: "#00FF88",
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  primaryText: {
    color: "#07130D",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  permissionContainer: {
  flex: 1,
  backgroundColor: "#17120F",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 24,
},

permissionCard: {
  width: "100%",
  maxWidth: 520,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1,
  borderColor: "rgba(245,215,161,0.18)",
  borderRadius: 24,
  paddingHorizontal: 28,
  paddingVertical: 24,
  alignItems: "center",
},

permissionIcon: {
  fontSize: 40,
},

permissionTitle: {
  marginTop: 10,
  color: "#FFFFFF",
  fontSize: 24,
  fontWeight: "900",
  textAlign: "center",
},

permissionDescription: {
  marginTop: 8,
  maxWidth: 410,
  color: "#C9B7A7",
  fontSize: 14,
  lineHeight: 20,
  fontWeight: "600",
  textAlign: "center",
},

permissionButtons: {
  marginTop: 20,
  flexDirection: "row",
  gap: 12,
},

permissionButton: {
  minWidth: 145,
  height: 48,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 18,
},

settingsButton: {
  backgroundColor: "#00FF88",
},

settingsButtonText: {
  color: "#07130D",
  fontSize: 14,
  fontWeight: "900",
},

retryPermissionButton: {
  backgroundColor: "rgba(255,255,255,0.10)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
},

retryPermissionText: {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "900",
},
});