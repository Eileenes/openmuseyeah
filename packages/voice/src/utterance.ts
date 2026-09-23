/**
 * Hands-free utterance detection.
 *
 * Decides where a spoken turn begins and ends from a stream of loudness levels,
 * so the person does not have to hold a button. The rules are pure and the clock
 * is injectable: everything except reading levels off a microphone is testable
 * without one, which matters because a real microphone is exactly what is hard
 * to have in CI.
 */

export interface UtteranceOptions {
  /** Level at or above which a frame counts as speech. */
  speechThreshold?: number;
  /** How long speech must persist before a turn is considered started. */
  minSpeechMs?: number;
  /** Silence this long closes the turn. */
  silenceMs?: number;
  /** A turn longer than this is cut off so a stuck microphone cannot run forever. */
  maxUtteranceMs?: number;
}

export type UtteranceEvent = "started" | "ended" | "too-long";

export interface UtteranceDetector {
  /** Feed one frame's level. Returns a boundary event when one is crossed. */
  push(level: number, now?: number): UtteranceEvent | null;
  speaking(): boolean;
  reset(): void;
}

export function createUtteranceDetector(options: UtteranceOptions = {}): UtteranceDetector {
  const speechThreshold = options.speechThreshold ?? 0.02;
  const minSpeechMs = options.minSpeechMs ?? 250;
  const silenceMs = options.silenceMs ?? 900;
  const maxUtteranceMs = options.maxUtteranceMs ?? 60000;

  let speaking = false;
  let speechRun = 0;
  let silenceRun = 0;
  let elapsed = 0;
  let last: number | null = null;
  /*
   * Set after a forced cut-off. Without it the next loud frame immediately opens
   * a new turn, so a microphone stuck open would cycle "record, cut, record"
   * forever. Waiting for real silence means a stuck input goes quiet instead.
   */
  let awaitingSilence = false;

  return {
    push(level, now = Date.now()) {
      // The first frame has no previous timestamp; treat it as instantaneous.
      const delta = last === null ? 0 : Math.max(0, now - last);
      last = now;
      const loud = level >= speechThreshold;

      if (!speaking) {
        if (awaitingSilence) {
          if (loud) return null;
          awaitingSilence = false;
          speechRun = 0;
          return null;
        }
        if (!loud) {
          speechRun = 0;
          return null;
        }
        speechRun += delta;
        if (speechRun < minSpeechMs) return null;
        speaking = true;
        silenceRun = 0;
        elapsed = speechRun;
        return "started";
      }

      elapsed += delta;
      if (elapsed >= maxUtteranceMs) {
        speaking = false;
        speechRun = 0;
        awaitingSilence = true;
        return "too-long";
      }
      if (loud) {
        silenceRun = 0;
        return null;
      }
      silenceRun += delta;
      if (silenceRun < silenceMs) return null;
      speaking = false;
      speechRun = 0;
      return "ended";
    },
    speaking: () => speaking,
    reset() {
      speaking = false;
      speechRun = 0;
      silenceRun = 0;
      elapsed = 0;
      last = null;
      awaitingSilence = false;
    },
  };
}
