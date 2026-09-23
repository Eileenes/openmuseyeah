/** Shared shapes for the platform-split recorder and player modules. */

export interface Recording {
  /** Object URL on web, file:// URI on a device. */
  uri: string;
  name: string;
  type: string;
  /** Present on web, where FormData accepts a Blob directly. Native uploads by URI. */
  blob?: Blob;
}

export interface VoiceRecorderHandle {
  recording: boolean;
  /**
   * `onChunk` asks for audio as it is captured rather than only at the end, so
   * recognition can begin while the person is still speaking. Platforms that
   * cannot slice a recording accept the option and ignore it; the clip is still
   * returned from `stop` either way.
   */
  start: (options?: { onChunk?: (chunk: Blob) => void }) => Promise<void>;
  stop: () => Promise<Recording | null>;
  cancel: () => Promise<void>;
}

export interface VoicePlayerHandle {
  /**
   * Resolves once playback has *started*, not when it ends — so callers that
   * need to know when the audio finished pass `onEnded`.
   */
  play: (url: string, onEnded?: () => void) => Promise<void>;
  stop: () => void;
}
