import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { API_BASE_URL, createOpaqueId, getInstallationId } from "./usage";
import { getPremiumAccessState, type PremiumAccessState } from "./premiumAccess";

// Olaylar bellekte kuyruğa alınır, AsyncStorage'a yazılır (uygulama kapansa da
// kaybolmasın diye) ve toplu halde backend'e POST /events ile gönderilir.
// Gönderim başarısız olursa olaylar kuyrukta kalır ve sonra tekrar denenir.

const EVENTS_URL = `${API_BASE_URL}/events`;
const QUEUE_STORAGE_KEY = "@countvision/analytics-queue-v1";
const FLUSH_INTERVAL_MS = 20_000;
const FLUSH_BATCH_SIZE = 50;
const MAX_QUEUE_SIZE = 500;
const REQUEST_TIMEOUT_MS = 10_000;
const PERSIST_DEBOUNCE_MS = 1_000;
// Arka planda bu süreden uzun kalınırsa dönüşte yeni oturum başlar.
const SESSION_TIMEOUT_MS = 30 * 60_000;

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

type AnalyticsEvent = {
  event_id: string;
  name: string;
  ts: string;
  session_id: string;
  seq: number;
  screen: string | null;
  premium: PremiumAccessState;
  props: AnalyticsProps;
};

let queue: AnalyticsEvent[] = [];
let sessionId = createOpaqueId();
let sessionStartedAt = Date.now();
let seq = 0;
let currentScreen: string | null = null;
let screenEnteredAt = Date.now();
let backgroundedAt: number | null = null;
let started = false;
// Önceki çalıştırmadan kalan kuyruk okunana kadar diske yazma; yoksa
// gönderilmemiş eski olayların üzerine yazılır.
let restored = false;
let flushing = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function enqueue(event: AnalyticsEvent) {
  queue.push(event);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!restored) return;
  AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue)).catch(
    () => undefined,
  );
}

export function track(name: string, props: AnalyticsProps = {}): void {
  seq += 1;
  const event: AnalyticsEvent = {
    event_id: createOpaqueId(),
    name,
    ts: new Date().toISOString(),
    session_id: sessionId,
    seq,
    screen: currentScreen,
    premium: getPremiumAccessState(),
    props,
  };

  if (__DEV__) console.log("[analytics]", name, props);

  enqueue(event);
  schedulePersist();
  if (queue.length >= FLUSH_BATCH_SIZE) flush();
}

export function getCurrentScreen(): string | null {
  return currentScreen;
}

/** Navigasyon her ekran değiştirdiğinde çağrılır. */
export function setCurrentScreen(screen: string | undefined): void {
  if (!screen || screen === currentScreen) return;
  const now = Date.now();
  const previousScreen = currentScreen;
  const previousDurationMs = previousScreen ? now - screenEnteredAt : null;

  currentScreen = screen;
  screenEnteredAt = now;
  track("screen_view", {
    previous_screen: previousScreen,
    previous_duration_ms: previousDurationMs,
  });
}

export async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;

  const batch = queue.slice(0, FLUSH_BATCH_SIZE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installation_id: await getInstallationId(),
        platform: Platform.OS,
        os_version: String(Platform.Version),
        build: __DEV__ ? "debug" : "release",
        events: batch,
      }),
      signal: controller.signal,
    });

    // 2xx: gönderildi. 400/413/422: bu paket hiç kabul edilmeyecek, kuyruğu
    // tıkamasın diye at. Diğer hatalarda (404, 5xx, ağ) sonra tekrar dene.
    const rejected = [400, 413, 422].includes(response.status);
    if (response.ok || rejected) {
      const sentIds = new Set(batch.map((event) => event.event_id));
      queue = queue.filter((event) => !sentIds.has(event.event_id));
      persistNow();
    }
  } catch {
    // Ağ hatası / zaman aşımı: olaylar kuyrukta kalır.
  } finally {
    clearTimeout(timeout);
    flushing = false;
  }
}

function handleAppStateChange(state: AppStateStatus) {
  const now = Date.now();

  if (state === "background") {
    if (backgroundedAt !== null) return;
    backgroundedAt = now;
    track("app_background", {
      session_duration_ms: now - sessionStartedAt,
      screen_duration_ms: currentScreen ? now - screenEnteredAt : null,
    });
    persistNow();
    flush();
    return;
  }

  if (state === "active" && backgroundedAt !== null) {
    const backgroundMs = now - backgroundedAt;
    backgroundedAt = null;
    screenEnteredAt = now;

    if (backgroundMs > SESSION_TIMEOUT_MS) {
      sessionId = createOpaqueId();
      sessionStartedAt = now;
      seq = 0;
      track("session_start", { reason: "resume", background_ms: backgroundMs });
    } else {
      track("app_foreground", { background_ms: backgroundMs });
    }
  }
}

/** Uygulama açılışında bir kez çağrılır. */
export function startAnalytics(): void {
  if (started) return;
  started = true;

  track("session_start", { reason: "cold_start" });

  AsyncStorage.getItem(QUEUE_STORAGE_KEY)
    .then((stored) => {
      if (!stored) return;
      const persisted = JSON.parse(stored) as AnalyticsEvent[];
      if (!Array.isArray(persisted)) return;
      const inMemory = new Set(queue.map((event) => event.event_id));
      queue = [
        ...persisted.filter((event) => !inMemory.has(event.event_id)),
        ...queue,
      ].slice(-MAX_QUEUE_SIZE);
    })
    .catch(() => undefined)
    .finally(() => {
      restored = true;
      persistNow();
      flush();
    });

  setInterval(() => {
    if (backgroundedAt === null) flush();
  }, FLUSH_INTERVAL_MS);
  AppState.addEventListener("change", handleAppStateChange);
}

/** AdMob hata nesnesinden kısa bir kod çıkarır (örn. "no-fill"). */
export function adErrorCode(error: unknown): string {
  const raw = String(
    (error as { code?: unknown })?.code ??
      (error as { message?: unknown })?.message ??
      "unknown",
  );
  return raw.replace(/^googleMobileAds\//, "").slice(0, 80);
}

/** AdMob gösterim başına gelir (impression-level ad revenue). */
// Kütüphanenin tipleri tam reklamlarda PAID olayının içeriğini `undefined`
// olarak tanımlıyor; gerçekte { value, currency, precision } geliyor.
export function trackAdPaid(
  format: "banner" | "interstitial" | "rewarded",
  event: unknown,
): void {
  const paid = (event ?? {}) as {
    value?: unknown;
    currency?: unknown;
    precision?: unknown;
  };
  track("ad_paid", {
    format,
    value: typeof paid.value === "number" ? paid.value : null,
    currency: typeof paid.currency === "string" ? paid.currency : null,
    precision: paid.precision == null ? null : String(paid.precision),
  });
}
