import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";

const INSTALLATION_ID_KEY = "@countvision/installation-id-v1";

export const API_BASE_URL = __DEV__
  ? "http://localhost:8000"
  : "https://countvision-backend-production.up.railway.app";

export type UsageStatus = {
  installation_id: string;
  premium: boolean;
  daily_allowance: number;
  daily_remaining: number;
  bonus_remaining: number;
  remaining: number;
  reset_at: string;
};

export const createOpaqueId = () => {
  const bytes = new Uint8Array(16);
  global.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] % 16) + 64;
  bytes[8] = (bytes[8] % 64) + 128;
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

export async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const created = createOpaqueId();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

export async function grantRewardCredits(): Promise<UsageStatus | null> {
  try {
    const body = new FormData();
    body.append("installation_id", await getInstallationId());
    body.append("event_id", createOpaqueId());
    const response = await fetch(`${API_BASE_URL}/usage/reward`, {
      method: "POST",
      body,
    });
    if (!response.ok) return null;
    return (await response.json()) as UsageStatus;
  } catch {
    return null;
  }
}

export async function exhaustUsageForDebug(): Promise<UsageStatus | null> {
  if (!__DEV__) return null;
  try {
    const body = new FormData();
    body.append("installation_id", await getInstallationId());
    const response = await fetch(`${API_BASE_URL}/usage/debug/exhaust`, {
      method: "POST",
      body,
    });
    if (!response.ok) return null;
    return (await response.json()) as UsageStatus;
  } catch {
    return null;
  }
}

export async function fetchUsageStatus(): Promise<UsageStatus | null> {
  try {
    const installationId = await getInstallationId();
    const response = await fetch(
      `${API_BASE_URL}/usage?installation_id=${encodeURIComponent(installationId)}`,
    );
    if (!response.ok) return null;
    return (await response.json()) as UsageStatus;
  } catch {
    // Sayaç servisi geçici olarak ulaşılamazsa temel analiz akışını bozma.
    return null;
  }
}

export async function syncPremiumWithBackend(): Promise<UsageStatus | null> {
  try {
    const body = new FormData();
    body.append("installation_id", await getInstallationId());
    const response = await fetch(`${API_BASE_URL}/usage/sync-premium`, {
      method: "POST",
      body,
    });
    if (!response.ok) return null;
    return (await response.json()) as UsageStatus;
  } catch {
    return null;
  }
}
