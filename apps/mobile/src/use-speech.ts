import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRepeatGuard,
  flushSentence,
  takeSentences,
} from "../../../packages/voice/src/stream";
import { useVoicePlayer } from "./voice/player";
import { useWorkspace } from "./workspace";

/**
 * How much of each message has already been handed to the speech queue.
 *
 * Module-level on purpose. A chat screen can be unmounted and remounted while a
 * reply is still arriving — provisioning a rich thread switches the render
 * branch — and per-instance state would forget what it already spoke and say the
 * whole reply again. It also stops two mounted chats from speaking over each
 * other. Entries are evicted oldest-first once the conversation moves on.
 */
const spokenByMessage = new Map<string, string>();
const SPOKEN_LIMIT = 40;

/**
 * Sentences spoken recently, keyed to the message that spoke them.
 *
 * The same reply can reach this hook under two different message ids — the
 * streamed copy and the version the runtime later reports as the finished
 * message — which made the whole answer play twice. Repeating a sentence inside
 * one message is still allowed, because that can be intentional.
 */
const isRepeat = createRepeatGuard();

function rememberSpoken(id: string, spokenPrefix: string) {
  spokenByMessage.delete(id);
  spokenByMessage.set(id, spokenPrefix);
  while (spokenByMessage.size > SPOKEN_LIMIT) {
    const oldest = spokenByMessage.keys().next().value;
    if (oldest === undefined) break;
    spokenByMessage.delete(oldest);
  }
}

/**
 * Speaks assistant replies.
 *
 * A reply is spoken sentence by sentence as it streams, not after it is
 * complete: waiting for the whole text is what makes a voice assistant feel
 * slow. Clips go through a single promise chain so they never overlap, and a
 * generation counter cancels everything still queued when the person stops
 * playback or starts talking.
 *
 * The preference lives on the server so it follows the person across devices.
 */
export function useSpeech() {
  const { api } = useWorkspace();
  const { play, stop: stopPlayer } = useVoicePlayer();
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const generationRef = useRef(0);

  useEffect(() => {
    let current = true;
    void api
      .modelSettings()
      .then((view) => {
        if (current) setEnabled(view.settings.voice.speakReplies);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [api]);

  const stop = useCallback(() => {
    // Bumping the generation drops every clip that has not started yet.
    generationRef.current += 1;
    pendingRef.current = 0;
    // The record of what was already said is deliberately kept: if the reply
    // keeps streaming after an interruption it should continue, not restart.
    stopPlayer();
    setSpeaking(null);
  }, [stopPlayer]);

  const schedule = useCallback(
    (id: string, text: string) => {
      const generation = generationRef.current;
      pendingRef.current += 1;
      setSpeaking(id);
      queueRef.current = queueRef.current
        .then(async () => {
          if (generation !== generationRef.current) return;
          const { url } = await api.speak(text);
          if (generation !== generationRef.current) return;
          await play(url);
        })
        .catch((caught) => {
          setError(caught instanceof Error ? caught.message : String(caught));
        })
        .finally(() => {
          pendingRef.current -= 1;
          if (pendingRef.current <= 0) setSpeaking(null);
        });
    },
    [api, play],
  );

  /** Call while a reply is streaming: queues any newly completed sentences. */
  const push = useCallback(
    (id: string, fullText: string) => {
      const already = spokenByMessage.get(id) ?? "";
      const remaining = fullText.slice(already.length);
      const { sentences, rest } = takeSentences(remaining);
      if (!sentences.length) return;
      rememberSpoken(id, fullText.slice(0, already.length + (remaining.length - rest.length)));
      for (const sentence of sentences) if (!isRepeat(id, sentence)) schedule(id, sentence);
    },
    [schedule],
  );

  /** Call when the run ends: speaks whatever tail has no terminator. */
  const finishStream = useCallback(
    (id: string, fullText: string) => {
      // A reply too short to stream never registered; the empty record makes
      // the remainder the whole message, so it is still spoken once.
      const already = spokenByMessage.get(id) ?? "";
      const remaining = fullText.slice(already.length);
      /*
       * Record the message as fully spoken rather than clearing the record. A run
       * can report itself finished and then running again (a tool result
       * arriving), and a cleared record would restart from the first sentence.
       */
      rememberSpoken(id, fullText);
      const tail = flushSentence(remaining);
      if (tail && !isRepeat(id, tail)) schedule(id, tail);
    },
    [schedule],
  );

  /** Speaks one message in full, for the per-message replay control. */
  const speak = useCallback(
    async (id: string, text: string) => {
      if (!text.trim()) return;
      setError("");
      stopPlayer();
      generationRef.current += 1;
      pendingRef.current = 0;
      rememberSpoken(id, text);
      schedule(id, text);
    },
    [schedule, stopPlayer],
  );

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) stop();
    try {
      await api.saveModelSettings({ voice: { speakReplies: next } });
    } catch (caught) {
      setEnabled(!next);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [api, enabled, stop]);

  return { enabled, speaking, error, speak, push, finishStream, stop, toggle };
}
