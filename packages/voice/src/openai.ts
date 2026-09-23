import type {
  AudioFormat,
  SpeechToText,
  SynthesizeInput,
  SynthesizeResult,
  TextToSpeech,
  TranscribeInput,
  TranscribeResult,
} from "./types.ts";

export interface OpenAiVoiceOptions {
  apiKey: string;
  /** Override for OpenAI-compatible gateways. */
  baseUrl?: string;
  /** Injected in tests so no request leaves the process. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const ERROR_LIMIT = 400;

/** Provider errors are surfaced as text, never as a stack trace or a token. */
async function failure(response: Response, provider: string): Promise<Error> {
  let detail = "";
  try {
    detail = (await response.text()).slice(0, ERROR_LIMIT);
  } catch {
    detail = "";
  }
  return new Error(`${provider} request failed (${response.status})${detail ? `: ${detail}` : ""}`);
}

const FORMAT_TO_MIME: Record<AudioFormat, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  wav: "audio/wav",
};

/**
 * Providers pick a decoder from the uploaded file name, so the extension has
 * to agree with the bytes we were handed.
 */
function extensionFor(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("webm")) return "webm";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("ogg") || type.includes("opus")) return "ogg";
  return "wav";
}

export class OpenAiSpeechToText implements SpeechToText {
  readonly provider = "openai";
  readonly model: string;
  private readonly options: OpenAiVoiceOptions;

  constructor(model: string, options: OpenAiVoiceOptions) {
    this.model = model;
    this.options = options;
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const doFetch = this.options.fetchImpl ?? fetch;
    const form = new FormData();
    form.set("model", this.model);
    // The response_format field is intentionally omitted: some compatible
    // gateways reject it, and the JSON default already returns { text }.
    if (input.language) form.set("language", input.language);
    form.set(
      "file",
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
      `audio.${extensionFor(input.mimeType)}`,
    );
    const response = await doFetch(`${this.baseUrl()}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
      body: form,
      signal: input.signal,
    });
    if (!response.ok) throw await failure(response, "OpenAI transcription");
    const payload = (await response.json()) as { text?: unknown; language?: unknown };
    if (typeof payload.text !== "string") throw new Error("OpenAI transcription returned no text");
    return {
      text: payload.text,
      language: typeof payload.language === "string" ? payload.language : input.language,
    };
  }

  private baseUrl() {
    return (this.options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }
}

export class OpenAiTextToSpeech implements TextToSpeech {
  readonly provider = "openai";
  readonly model: string;
  private readonly options: OpenAiVoiceOptions;

  constructor(model: string, options: OpenAiVoiceOptions) {
    this.model = model;
    this.options = options;
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const doFetch = this.options.fetchImpl ?? fetch;
    const response = await doFetch(`${this.baseUrl()}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        voice: input.voiceId,
        input: input.text,
        response_format: input.format,
        speed: input.speed ?? 1,
      }),
      signal: input.signal,
    });
    if (!response.ok) throw await failure(response, "OpenAI speech");
    return {
      audio: new Uint8Array(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") ?? FORMAT_TO_MIME[input.format],
    };
  }

  private baseUrl() {
    return (this.options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }
}
