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
  start: () => Promise<void>;
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
