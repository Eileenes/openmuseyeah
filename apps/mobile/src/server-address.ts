import { Platform } from "react-native";

const STORAGE_KEY = "vesper.api.baseUrl";

/** Build-time fallback, used when nothing else says where the API is. */
export const DEFAULT_API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787")
).replace(/\/$/, "");

let override: string | null = null;

const trim = (value: string) => value.replace(/\/+$/, "");

function stored(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Where the API lives, resolved when a request is made rather than when this
 * module loads.
 *
 * A packaged desktop app has to be told at runtime which server to use, and a
 * build-time constant cannot do that — it is why the shell can inject
 * `__VESPER_API_URL__` before the bundle runs. Order: injected, then saved, then
 * the build-time default.
 */
export function apiBaseUrl(): string {
  const injected = (globalThis as Record<string, unknown>).__VESPER_API_URL__;
  if (typeof injected === "string" && injected.trim()) return trim(injected.trim());
  const saved = override ?? stored();
  if (saved?.trim()) return trim(saved.trim());
  return DEFAULT_API_URL;
}

/**
 * The desktop shell's per-launch secret, when the app runs inside it. The
 * packaged window sends an opaque origin, so the API accepts it only with this.
 */
export function shellToken(): string | null {
  const value = (globalThis as Record<string, unknown>).__VESPER_SHELL_TOKEN__;
  return typeof value === "string" && value ? value : null;
}

/** Saves an override, or clears it with null to fall back to the default. */
export function setApiBaseUrl(url: string | null) {
  override = url?.trim() ? trim(url.trim()) : null;
  try {
    if (typeof localStorage === "undefined") return;
    if (override) localStorage.setItem(STORAGE_KEY, override);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the in-memory value still applies.
  }
}
