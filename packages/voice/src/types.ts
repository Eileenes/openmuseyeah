/** Provider-independent speech boundary. Mirrors the OpenBot-style adapter shape
 * used elsewhere in this repository: the server owns credentials and policy,
 * adapters only translate a request. */

export type AudioFormat = "mp3" | "opus" | "wav";

export interface TranscribeInput {
  audio: Uint8Array;
  mimeType: string;
  language?: string;
  signal?: AbortSignal;
}

export interface TranscribeResult {
  text: string;
  language?: string;
}

export interface SpeechToText {
  readonly provider: string;
  readonly model: string;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

export interface SynthesizeInput {
  text: string;
  voiceId: string;
  format: AudioFormat;
  speed?: number;
  signal?: AbortSignal;
}

export interface SynthesizeResult {
  audio: Uint8Array;
  mimeType: string;
}

export interface TextToSpeech {
  readonly provider: string;
  readonly model: string;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}
