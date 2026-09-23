import {
  type AudioPlayer,
  type AudioStatus,
  createAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";
import { useCallback, useRef } from "react";
import type { VoicePlayerHandle } from "./types";

/** Structural stand-in for the subscription expo-modules-core returns. */
type Subscription = { remove: () => void };

/** Device playback of the signed reply URL. Needs an Expo development build. */
export function useVoicePlayer(): VoicePlayerHandle {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    const player = playerRef.current;
    if (!player) return;
    try {
      player.pause();
      player.remove();
    } catch {
      // Already released; nothing to do.
    }
    playerRef.current = null;
  }, []);

  const play = useCallback(
    async (url: string, onEnded?: () => void) => {
      stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri: url });
      playerRef.current = player;
      subscriptionRef.current = player.addListener(
        "playbackStatusUpdate",
        (status: AudioStatus) => {
          if (status.didJustFinish) onEnded?.();
        },
      );
      player.play();
    },
    [stop],
  );

  return { play, stop };
}
