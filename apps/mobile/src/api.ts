import type { ModelSettings, ModelSettingsInput } from "../../../packages/voice/src/settings";
import { apiBaseUrl, shellToken } from "./server-address";
import type { Recording } from "./voice/types";

export { apiBaseUrl, DEFAULT_API_URL, setApiBaseUrl } from "./server-address";

export interface ModelSettingsView {
  settings: ModelSettings;
  credentials: Record<string, { stored: boolean; masked?: string; fromEnvironment: boolean }>;
  speechProviders: string[];
  voices: string[];
}

export interface ModelTestResult {
  speechToText: { ok: boolean; provider?: string; model?: string; text?: string; error?: string };
  textToSpeech: { ok: boolean; provider?: string; bytes?: number; error?: string };
}

export class MuseApi {
  constructor(readonly token: string) {}
  async request<T>(
    path: string,
    body?: unknown,
    method?: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        Authorization: `Bearer ${this.token}`,
        // Present only inside the desktop shell, which sends an opaque origin.
        ...(shellToken() ? { "X-Vesper-Shell": shellToken() as string } : {}),
        ...(body === undefined || body instanceof FormData || headers
          ? {}
          : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(
        typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`,
      );
    return payload;
  }
  url(path: string) {
    return path.startsWith("http") ? path : `${apiBaseUrl()}${path}`;
  }
  /**
   * Web uploads the recorded Blob; a device has no reliable raw-byte body, so
   * it hands React Native the file URI and lets FormData stream it.
   */
  transcribe(recording: Recording) {
    const form = new FormData();
    if (recording.blob) form.append("audio", recording.blob, recording.name);
    else
      form.append("audio", {
        uri: recording.uri,
        name: recording.name,
        type: recording.type,
      } as unknown as Blob);
    return this.request<{ text: string; language?: string; provider: string; model: string }>(
      "/api/voice/transcribe",
      form,
    );
  }
  /**
   * Streaming recognition. Chunks are pushed while the person is still talking
   * so partial text can appear; `finish` returns the settled transcript.
   */
  openStream() {
    return this.request<{ id: string }>("/api/voice/streams", {});
  }
  pushStreamChunk(id: string, chunk: Uint8Array, mimeType: string) {
    return this.request<{ text: string; final: boolean; provider: string; model: string }>(
      `/api/voice/streams/${id}/chunks`,
      chunk as unknown as BodyInit,
      "POST",
      { "Content-Type": mimeType },
    );
  }
  finishStream(id: string) {
    return this.request<{ text: string; final: boolean; provider: string; model: string }>(
      `/api/voice/streams/${id}/finish`,
      {},
    );
  }
  speak(text: string) {
    return this.request<{ url: string; mimeType: string; spoken: string; provider: string }>(
      "/api/voice/speak",
      { text },
    );
  }
  modelSettings() {
    return this.request<ModelSettingsView>("/api/settings/models");
  }
  saveModelSettings(input: ModelSettingsInput) {
    return this.request<ModelSettingsView>("/api/settings/models", input, "PUT");
  }
  testModelSettings() {
    return this.request<ModelTestResult>("/api/settings/models/test", {});
  }
}

export async function createSession(
  accessKey?: string,
): Promise<{ token: string; mode: "sample" | "live" }> {
  const response = await fetch(`${apiBaseUrl()}/api/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // This runs before any session exists, so it cannot go through MuseApi —
      // but it still has to carry the shell's token, because the packaged
      // window's origin is opaque and is only accepted together with it.
      ...(shellToken() ? { "X-Vesper-Shell": shellToken() as string } : {}),
    },
    body: JSON.stringify({ accessKey }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not open your workspace.");
  return payload;
}
