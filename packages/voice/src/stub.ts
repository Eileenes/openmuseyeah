import type {
  SpeechToText,
  SynthesizeInput,
  SynthesizeResult,
  TextToSpeech,
  TranscribeInput,
  TranscribeResult,
} from "./types.ts";
import { toneWav } from "./wav.ts";

/**
 * Offline providers. They recognise nothing and speak nothing, but they let the
 * whole voice path (record, upload, transcript, agent, playback) run with no
 * account, no key and no network — which is what the sample workspace and the
 * test suite need. The transcript is deliberately explicit so a person can see
 * at a glance that no real recogniser ran.
 */
export class StubSpeechToText implements SpeechToText {
  readonly provider = "stub";
  readonly model: string;

  constructor(model = "stub-stt") {
    this.model = model;
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    return {
      text: `[stub] No speech provider is configured. Received ${input.audio.byteLength} bytes of ${input.mimeType}.`,
      language: input.language,
    };
  }
}

export class StubTextToSpeech implements TextToSpeech {
  readonly provider = "stub";
  readonly model: string;

  constructor(model = "stub-tts") {
    this.model = model;
  }

  /**
   * Always returns WAV regardless of the requested format: this is a locally
   * generated tone, not an encoding of the caller's chosen codec.
   */
  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    return { audio: toneWav(input.text, input.speed ?? 1), mimeType: "audio/wav" };
  }
}
