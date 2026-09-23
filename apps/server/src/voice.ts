import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decryptSecret, encryptSecret } from "../../../packages/integrations/src/vault.ts";
import {
  defaultModelSettings,
  type ModelSettings,
  type ModelSettingsInput,
  maskSecret,
  modelSettingsInputSchema,
  OPENAI_VOICES,
  OpenAiSpeechToText,
  OpenAiTextToSpeech,
  PROVIDER_DEFAULTS,
  type SpeechProvider,
  type SpeechToText,
  StubSpeechToText,
  StubTextToSpeech,
  type SynthesizeResult,
  speakable,
  type TextToSpeech,
  type TranscribeResult,
} from "../../../packages/voice/src/index.ts";
import { bufferedStreaming, type StreamingSession } from "../../../packages/voice/src/streaming.ts";
import type { Config } from "./config.ts";
import type { Store } from "./db.ts";
import { AppError } from "./errors.ts";
import { MODEL_SETTINGS_ID, MODEL_SETTINGS_KIND } from "./model-settings.ts";

const CREDENTIAL_KIND = "model-credentials";
/** Replays of the same sentence must not be billed twice. */
const CACHE_LIMIT = 64;
/** Synthesized audio is handed to players through a short-lived signed URL. */
const AUDIO_TTL_MS = 15 * 60 * 1000;
const AUDIO_LIMIT = 32;
/** A listening session idles out if the client stops pushing audio. */
const STREAM_TTL_MS = 2 * 60 * 1000;
const STREAM_LIMIT = 8;
const STREAM_MAX_BYTES = 4 * 1024 * 1024;

interface CredentialRecord {
  id: string;
  encrypted: string;
}

export interface PublicModelSettings {
  settings: ModelSettings;
  credentials: Record<string, { stored: boolean; masked?: string; fromEnvironment: boolean }>;
  speechProviders: SpeechProvider[];
  voices: string[];
}

export class VoiceService {
  private readonly cache = new Map<string, SynthesizeResult>();
  private readonly audio = new Map<
    string,
    { bytes: Uint8Array; mimeType: string; expiresAt: number }
  >();
  /** Live recognition sessions, keyed by an unguessable id and scoped to an owner. */
  private readonly streams = new Map<
    string,
    { owner: string; session: StreamingSession; expiresAt: number }
  >();
  private encryptionKeyPromise?: Promise<string>;

  constructor(
    private readonly db: Store,
    private readonly config: Config,
    /** Injected in tests, mirroring the DockerRunner seam used by the computer. */
    private readonly options: { fetchImpl?: typeof fetch } = {},
  ) {}

  /**
   * Live deployments require TOKEN_ENCRYPTION_KEY. Sample mode is local-only and
   * may run without one, so mirror the session signing key: generate a private
   * key inside the data directory on first use.
   */
  private encryptionKey(): Promise<string> {
    if (this.config.encryptionKey) return Promise.resolve(this.config.encryptionKey);
    this.encryptionKeyPromise ??= (async () => {
      await mkdir(this.config.dataDir, { recursive: true, mode: 0o700 });
      const path = join(this.config.dataDir, "credential-key");
      try {
        return await readFile(path, "utf8");
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        const key = randomBytes(32).toString("base64");
        await writeFile(path, key, { mode: 0o600, flag: "wx" });
        return key;
      }
    })();
    return this.encryptionKeyPromise;
  }

  async settings(owner: string): Promise<ModelSettings> {
    const stored = await this.db.get<ModelSettings>(owner, MODEL_SETTINGS_KIND, MODEL_SETTINGS_ID);
    const defaults = defaultModelSettings();
    if (!stored) return defaults;
    // Merge over defaults so a config written by an older build stays readable.
    return {
      ...defaults,
      ...stored,
      llm: { ...defaults.llm, ...stored.llm },
      stt: { ...defaults.stt, ...stored.stt },
      tts: { ...defaults.tts, ...stored.tts },
      voice: { ...defaults.voice, ...stored.voice },
    };
  }

  async saveSettings(owner: string, input: unknown): Promise<ModelSettings> {
    const patch: ModelSettingsInput = modelSettingsInputSchema.parse(input);
    const current = await this.settings(owner);
    const next: ModelSettings = {
      ...current,
      llm: { ...current.llm, ...patch.llm },
      stt: { ...current.stt, ...patch.stt },
      tts: { ...current.tts, ...patch.tts },
      voice: { ...current.voice, ...patch.voice },
      id: MODEL_SETTINGS_ID,
      updatedAt: new Date().toISOString(),
    };
    // Switching provider without naming a model should adopt that provider's
    // default rather than silently keep the previous provider's model id.
    if (patch.stt?.provider && !patch.stt.model && patch.stt.provider !== current.stt.provider)
      next.stt.model = PROVIDER_DEFAULTS[patch.stt.provider].sttModel;
    if (patch.tts?.provider && patch.tts.provider !== current.tts.provider) {
      if (!patch.tts.model) next.tts.model = PROVIDER_DEFAULTS[patch.tts.provider].ttsModel;
      if (!patch.tts.voiceId) next.tts.voiceId = PROVIDER_DEFAULTS[patch.tts.provider].voiceId;
    }
    if (patch.keys) {
      const key = await this.encryptionKey();
      for (const [provider, secret] of Object.entries(patch.keys))
        await this.db.put<CredentialRecord>(owner, CREDENTIAL_KIND, {
          id: provider,
          encrypted: encryptSecret(secret, key),
        });
    }
    return this.db.put(owner, MODEL_SETTINGS_KIND, next);
  }

  private async credentials(owner: string): Promise<Record<string, string>> {
    const rows = await this.db.list<CredentialRecord>(owner, CREDENTIAL_KIND);
    const found: Record<string, string> = {};
    // Only touch the keystore when something is actually stored, so a workspace
    // that never saved a key performs no filesystem work at all.
    if (rows.length > 0) {
      const key = await this.encryptionKey();
      for (const row of rows) {
        try {
          found[row.id] = decryptSecret(row.encrypted, key);
        } catch {
          // A credential written under a different key is unusable; treat it as absent.
        }
      }
    }
    // A key stored through the app wins; the environment stays as a fallback.
    if (!found.openai && process.env.OPENAI_API_KEY) found.openai = process.env.OPENAI_API_KEY;
    return found;
  }

  async publicSettings(owner: string): Promise<PublicModelSettings> {
    const [settings, credentials] = await Promise.all([
      this.settings(owner),
      this.credentials(owner),
    ]);
    return {
      settings,
      credentials: {
        openai: {
          stored: Boolean(credentials.openai),
          masked: credentials.openai ? maskSecret(credentials.openai) : undefined,
          fromEnvironment: Boolean(!credentials.openai && process.env.OPENAI_API_KEY),
        },
      },
      speechProviders: ["stub", "openai"],
      voices:
        settings.tts.provider === "openai" ? [...OPENAI_VOICES] : [PROVIDER_DEFAULTS.stub.voiceId],
    };
  }

  private openAiOptions(settings: ModelSettings, credentials: Record<string, string>) {
    const apiKey = credentials.openai;
    if (!apiKey)
      throw new AppError(
        "Add an OpenAI API key in Assistant settings, or choose the offline provider.",
        400,
      );
    return {
      apiKey,
      baseUrl: settings.llm.baseUrl ?? process.env.OPENAI_BASE_URL,
      fetchImpl: this.options.fetchImpl,
    };
  }

  async speechToText(owner: string): Promise<SpeechToText> {
    const [settings, credentials] = await Promise.all([
      this.settings(owner),
      this.credentials(owner),
    ]);
    if (settings.stt.provider === "openai")
      return new OpenAiSpeechToText(settings.stt.model, this.openAiOptions(settings, credentials));
    return new StubSpeechToText(settings.stt.model);
  }

  async textToSpeech(owner: string): Promise<TextToSpeech> {
    const [settings, credentials] = await Promise.all([
      this.settings(owner),
      this.credentials(owner),
    ]);
    if (settings.tts.provider === "openai")
      return new OpenAiTextToSpeech(settings.tts.model, this.openAiOptions(settings, credentials));
    return new StubTextToSpeech(settings.tts.model);
  }

  private pruneStreams(now: number) {
    for (const [key, value] of this.streams) if (value.expiresAt <= now) this.streams.delete(key);
  }

  /**
   * Opens a recognition session so audio can be transcribed while the person is
   * still speaking. Sessions are owner-scoped: an id from one owner is not
   * usable by another.
   */
  async startStream(owner: string): Promise<string> {
    const now = Date.now();
    this.pruneStreams(now);
    while (this.streams.size >= STREAM_LIMIT) {
      const oldest = this.streams.keys().next().value;
      if (oldest === undefined) break;
      this.streams.delete(oldest);
    }
    const [settings, provider] = await Promise.all([
      this.settings(owner),
      this.speechToText(owner),
    ]);
    const id = randomUUID();
    this.streams.set(id, {
      owner,
      session: bufferedStreaming(provider, { maxBytes: STREAM_MAX_BYTES }).startSession({
        mimeType: "audio/wav",
        language: settings.stt.language || undefined,
      }),
      expiresAt: now + STREAM_TTL_MS,
    });
    return id;
  }

  private stream(owner: string, id: string) {
    const entry = this.streams.get(id);
    if (!entry || entry.owner !== owner || entry.expiresAt <= Date.now()) {
      this.streams.delete(id);
      throw new AppError("That listening session has ended. Hold the microphone again.", 404);
    }
    // Each push keeps the session alive while the person is still talking.
    entry.expiresAt = Date.now() + STREAM_TTL_MS;
    return entry.session;
  }

  async pushStream(owner: string, id: string, chunk: Uint8Array) {
    const [settings, heard] = await Promise.all([
      this.settings(owner),
      this.stream(owner, id).push(chunk),
    ]);
    return { ...heard, provider: settings.stt.provider, model: settings.stt.model };
  }

  async finishStream(owner: string, id: string) {
    const session = this.stream(owner, id);
    this.streams.delete(id);
    const [settings, heard] = await Promise.all([this.settings(owner), session.finish()]);
    return { ...heard, provider: settings.stt.provider, model: settings.stt.model };
  }

  /**
   * Parks synthesized audio so the client can play it from a URL. Native audio
   * players cannot attach an Authorization header, so a signed link is the only
   * playback path that works the same on web and on a device.
   */
  putAudio(result: { audio: Uint8Array; mimeType: string }): string {
    const now = Date.now();
    for (const [key, value] of this.audio) if (value.expiresAt <= now) this.audio.delete(key);
    while (this.audio.size >= AUDIO_LIMIT) {
      const oldest = this.audio.keys().next().value;
      if (oldest === undefined) break;
      this.audio.delete(oldest);
    }
    const id = randomUUID();
    this.audio.set(id, {
      bytes: result.audio,
      mimeType: result.mimeType,
      expiresAt: now + AUDIO_TTL_MS,
    });
    return id;
  }

  getAudio(id: string): { bytes: Uint8Array; mimeType: string } | null {
    const entry = this.audio.get(id);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.audio.delete(id);
      return null;
    }
    return { bytes: entry.bytes, mimeType: entry.mimeType };
  }

  async transcribe(
    owner: string,
    input: { audio: Uint8Array; mimeType: string; signal?: AbortSignal },
  ): Promise<TranscribeResult & { provider: string; model: string }> {
    const [settings, provider] = await Promise.all([
      this.settings(owner),
      this.speechToText(owner),
    ]);
    const result = await provider.transcribe({
      audio: input.audio,
      mimeType: input.mimeType,
      language: settings.stt.language || undefined,
      signal: input.signal,
    });
    return { ...result, provider: provider.provider, model: provider.model };
  }

  async synthesize(
    owner: string,
    input: { text: string; format?: ModelSettings["tts"]["format"]; signal?: AbortSignal },
  ): Promise<SynthesizeResult & { provider: string; voiceId: string; spoken: string }> {
    const [settings, provider] = await Promise.all([
      this.settings(owner),
      this.textToSpeech(owner),
    ]);
    // Replies carry Markdown, links and code that sound like noise out loud.
    const spoken = speakable(input.text);
    if (!spoken) throw new AppError("There is nothing to read aloud", 422);
    const format = input.format ?? settings.tts.format;
    const key = createHash("sha256")
      .update(
        [
          provider.provider,
          provider.model,
          settings.tts.voiceId,
          format,
          String(settings.tts.speed),
          spoken,
        ].join("\u0000"),
      )
      .digest("hex");
    const cached = this.cache.get(key);
    if (cached)
      return { ...cached, provider: provider.provider, voiceId: settings.tts.voiceId, spoken };
    const result = await provider.synthesize({
      text: spoken,
      voiceId: settings.tts.voiceId,
      format,
      speed: settings.tts.speed,
      signal: input.signal,
    });
    if (this.cache.size >= CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, result);
    return { ...result, provider: provider.provider, voiceId: settings.tts.voiceId, spoken };
  }
}
