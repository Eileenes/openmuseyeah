import { Mic, Radio, Square } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createUtteranceDetector } from "../../../packages/voice/src/utterance";
import { colors, s } from "./ui";
import { useVoiceRecorder } from "./voice/recorder";
import type { Recording } from "./voice/types";
import { useWorkspace } from "./workspace";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Press and hold to talk. The start call is asynchronous (permission prompt plus
 * device setup), so a release that lands first waits for it before stopping —
 * otherwise a quick tap would leave the microphone recording with no way to end.
 */
export function VoiceInput({
  onTranscript,
  onPartial,
  onError,
  onRecordStart,
  disabled,
}: {
  onTranscript: (text: string) => void;
  /** Transcript so far, while the person is still speaking. */
  onPartial?: (text: string) => void;
  onError: (message: string) => void;
  /** Barge-in: reaching for the microphone means "stop talking". */
  onRecordStart?: () => void;
  disabled?: boolean;
}) {
  const { api } = useWorkspace();
  const { recording, start, stop } = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const sessionRef = useRef<Promise<void> | null>(null);
  const streamRef = useRef<string | null>(null);
  const streamBrokenRef = useRef(false);
  /** Bumped to abandon a listening loop when hands-free is turned off. */
  const cycleRef = useRef(0);

  /*
   * Hands-free: keep the microphone open and let the detector decide where each
   * utterance starts and ends, transcribing and starting again after each one.
   * Where loudness is unavailable the loop records and simply never cuts, which
   * is a worse experience than pressing but not a broken one.
   */
  useEffect(() => {
    if (!handsFree) return;
    cycleRef.current += 1;
    const generation = cycleRef.current;
    void (async () => {
      while (generation === cycleRef.current) {
        const detector = createUtteranceDetector();
        const clip = await new Promise<Recording | null>((resolve) => {
          let settled = false;
          const settle = (value: Recording | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          void start({
            onLevel: (level) => {
              const event = detector.push(level);
              if (event === "ended" || event === "too-long")
                void stop().then(settle, () => settle(null));
            },
          }).catch((error) => {
            onError(message(error));
            settle(null);
          });
        });
        if (generation !== cycleRef.current || !clip) break;
        try {
          const heard = await api.transcribe(clip);
          const text = heard.text.trim();
          if (text) onTranscript(text);
        } catch (error) {
          onError(message(error));
          break;
        }
      }
    })();
    return () => {
      cycleRef.current += 1;
      void stop();
    };
  }, [handsFree, start, stop, api, onTranscript, onError]);

  const begin = useCallback(async () => {
    if (disabled || busy || sessionRef.current) return;
    onRecordStart?.();
    /*
     * Recognition is fed while recording, so the session has to exist first —
     * opening it late would drop the opening words, since the server
     * transcribes what it has been given. It is only an optimisation: an
     * unreachable server leaves the clip to be uploaded on release instead.
     */
    let streamId: string | null = null;
    try {
      streamId = (await api.openStream()).id;
    } catch {
      streamId = null;
    }
    streamRef.current = streamId;
    streamBrokenRef.current = false;
    const started = start({
      onChunk: streamId
        ? (chunk) => {
            if (streamBrokenRef.current) return;
            void chunk
              .arrayBuffer()
              .then((buffer) =>
                api.pushStreamChunk(streamId, new Uint8Array(buffer), chunk.type || "audio/webm"),
              )
              .then((heard) => {
                if (heard.text.trim()) onPartial?.(heard.text.trim());
              })
              .catch(() => {
                // The clip still gets uploaded on release; a failure to
                // recognise early must not surface as an error.
                streamBrokenRef.current = true;
              });
          }
        : undefined,
    });
    sessionRef.current = started;
    try {
      await started;
    } catch (error) {
      sessionRef.current = null;
      onError(message(error));
    }
  }, [disabled, busy, start, onError, onRecordStart, api, onPartial]);

  const finish = useCallback(async () => {
    const started = sessionRef.current;
    if (!started) return;
    sessionRef.current = null;
    setBusy(true);
    try {
      // Wait for recording to actually begin before asking it to stop.
      await started.catch(() => undefined);
      const clip = await stop();
      const streamId = streamRef.current;
      streamRef.current = null;
      if (streamId && !streamBrokenRef.current) {
        try {
          const heard = await api.finishStream(streamId);
          const text = heard.text.trim();
          if (text) {
            onTranscript(text);
            return;
          }
        } catch {
          // Fall through to the clip below.
        }
      }
      if (!clip) return;
      const heard = await api.transcribe(clip);
      const text = heard.text.trim();
      if (text) onTranscript(text);
    } catch (error) {
      onError(message(error));
    } finally {
      setBusy(false);
    }
  }, [stop, api, onTranscript, onError]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={handsFree ? "Stop listening hands-free" : "Listen hands-free"}
        accessibilityState={{ checked: handsFree }}
        onPress={() => setHandsFree(!handsFree)}
        style={({ pressed }) => ({
          width: 32,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          backgroundColor: handsFree || pressed ? colors.sky : "transparent",
        })}
      >
        <Radio size={17} strokeWidth={1.8} color={handsFree ? colors.danger : colors.muted} />
      </Pressable>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? "Release to send your voice message" : "Hold to talk"}
          accessibilityState={{ busy, disabled: Boolean(disabled) }}
          disabled={Boolean(disabled) || busy}
          onPressIn={begin}
          onPressOut={finish}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: recording ? "#F6DEDA" : pressed ? colors.sky : "transparent",
          })}
        >
          {busy ? (
            <ActivityIndicator color={colors.muted} />
          ) : recording ? (
            <Square size={16} fill={colors.danger} strokeWidth={0} />
          ) : (
            <Mic size={21} strokeWidth={1.8} color={disabled ? "#B9C2C7" : colors.text} />
          )}
        </Pressable>
        {recording && (
          <Text
            style={[s.small, { position: "absolute", bottom: -14, width: 90, textAlign: "center" }]}
          >
            Listening…
          </Text>
        )}
      </View>
    </View>
  );
}
