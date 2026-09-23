import type { SpeechToText, TranscribeInput, TranscribeResult } from "./types.ts";

export interface StreamingSession {
  /** Appends audio and returns the transcript of everything heard so far. */
  push(chunk: Uint8Array): Promise<TranscribeResult>;
  /** Ends the session and returns the final transcript. */
  finish(): Promise<TranscribeResult>;
}

export interface StreamingSpeechToText extends SpeechToText {
  startSession(options?: {
    mimeType?: string;
    language?: string;
    signal?: AbortSignal;
  }): StreamingSession;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export interface BufferedStreamingOptions {
  /** Refuses further audio once the utterance would exceed this. */
  maxBytes?: number;
}

/**
 * Progressive recognition for providers that only expose a batch endpoint.
 *
 * Audio accumulates and each update re-reads the whole utterance, so the chunk
 * cadence is a straight cost/latency trade-off the caller controls: more
 * frequent pushes feel snappier and bill more. A provider with a real streaming
 * API should implement `StreamingSpeechToText` directly instead of using this.
 */
export function bufferedStreaming(
  provider: SpeechToText,
  options: BufferedStreamingOptions = {},
): StreamingSpeechToText {
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  return {
    provider: provider.provider,
    model: provider.model,
    transcribe: (input: TranscribeInput) => provider.transcribe(input),
    startSession(session = {}) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      let last: TranscribeResult = { text: "", language: session.language };
      const read = async () => {
        last = await provider.transcribe({
          audio: concat(chunks, total),
          mimeType: session.mimeType ?? "audio/wav",
          language: session.language,
          signal: session.signal,
        });
        return last;
      };
      return {
        async push(chunk: Uint8Array) {
          if (chunk.byteLength === 0) return last;
          if (total + chunk.byteLength > maxBytes)
            throw new Error("That recording is too long; finish or cancel it and start again.");
          chunks.push(chunk);
          total += chunk.byteLength;
          return read();
        },
        async finish() {
          if (total === 0) return last;
          return read();
        },
      };
    },
  };
}
