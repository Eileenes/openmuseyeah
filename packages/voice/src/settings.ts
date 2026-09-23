import { z } from "zod";

/** Editable model configuration. Stored per owner; secrets are kept separately
 * and encrypted, and never returned to a client. */
export const llmProviderSchema = z.enum(["openai", "anthropic", "google"]);
export const speechProviderSchema = z.enum(["stub", "openai"]);
export const audioFormatSchema = z.enum(["mp3", "opus", "wav"]);
export type SpeechProvider = z.infer<typeof speechProviderSchema>;
export type AudioFormat = z.infer<typeof audioFormatSchema>;

const llmSchema = z.object({
  provider: llmProviderSchema,
  model: z.string().trim().max(200),
  baseUrl: z.string().trim().max(500).optional(),
});
const sttSchema = z.object({
  provider: speechProviderSchema,
  model: z.string().trim().min(1).max(200),
  /** BCP-47 hint; also steers recognition quality. Empty means auto-detect. */
  language: z.string().trim().max(35),
});
const ttsSchema = z.object({
  provider: speechProviderSchema,
  model: z.string().trim().min(1).max(200),
  voiceId: z.string().trim().min(1).max(100),
  speed: z.number().min(0.25).max(4),
  format: audioFormatSchema,
});
/** Interface preferences, kept with the other settings so they follow the person. */
const uiSchema = z.object({
  /** "auto" follows the device language until someone chooses explicitly. */
  language: z.enum(["en", "zh", "auto"]),
});
const voiceSchema = z.object({
  speakReplies: z.boolean(),
  autoSend: z.boolean(),
  handsFree: z.boolean(),
});

export const modelSettingsSchema = z.object({
  id: z.literal("config"),
  llm: llmSchema,
  stt: sttSchema,
  tts: ttsSchema,
  voice: voiceSchema,
  ui: uiSchema,
  updatedAt: z.string(),
});
export type ModelSettings = z.infer<typeof modelSettingsSchema>;

/** Partial update. `keys` carries plaintext provider secrets on the way in only. */
export const modelSettingsInputSchema = z.object({
  llm: llmSchema.partial().optional(),
  stt: sttSchema.partial().optional(),
  tts: ttsSchema.partial().optional(),
  voice: voiceSchema.partial().optional(),
  ui: uiSchema.partial().optional(),
  keys: z.record(z.string(), z.string().trim().min(8).max(500)).optional(),
});
export type ModelSettingsInput = z.infer<typeof modelSettingsInputSchema>;

/** Known provider models. Editable, so a newer id never needs a code change. */
export const PROVIDER_DEFAULTS: Record<
  SpeechProvider,
  { sttModel: string; ttsModel: string; voiceId: string }
> = {
  stub: { sttModel: "stub-stt", ttsModel: "stub-tts", voiceId: "stub-tone" },
  // whisper-1 is the widest-availability multilingual option; gpt-4o-transcribe
  // and gpt-4o-mini-transcribe are drop-in alternatives on newer accounts.
  openai: { sttModel: "whisper-1", ttsModel: "tts-1", voiceId: "alloy" },
};

export const OPENAI_VOICES = [
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;

export const STUB_VOICE_ID = "stub-tone";

export function defaultModelSettings(): ModelSettings {
  return {
    id: "config",
    llm: { provider: "openai", model: "" },
    stt: { provider: "stub", model: PROVIDER_DEFAULTS.stub.sttModel, language: "zh" },
    tts: {
      provider: "stub",
      model: PROVIDER_DEFAULTS.stub.ttsModel,
      voiceId: PROVIDER_DEFAULTS.stub.voiceId,
      speed: 1,
      format: "mp3",
    },
    voice: { speakReplies: true, autoSend: true, handsFree: false },
    ui: { language: "auto" },
    updatedAt: new Date(0).toISOString(),
  };
}

/** Never return a usable secret. Enough to recognise which key is stored. */
export function maskSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}
