import { useCallback, useRef } from "react";
import type { VoicePlayerHandle } from "./types";

/**
 * Replies are spoken from a signed URL, so nothing has to be written to disk.
 * Browsers may refuse playback the person did not directly trigger; that is
 * reported rather than thrown as an unhandled rejection.
 */
export function useVoicePlayer(): VoicePlayerHandle {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = "";
    audioRef.current = null;
  }, []);

  const play = useCallback(
    async (url: string, onEnded?: () => void) => {
      stop();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        onEnded?.();
      };
      try {
        await audio.play();
      } catch (error) {
        audioRef.current = null;
        throw new Error(
          error instanceof Error && error.name === "NotAllowedError"
            ? "The browser blocked playback until you interact with the page."
            : "This browser could not play the reply.",
        );
      }
    },
    [stop],
  );

  return { play, stop };
}
