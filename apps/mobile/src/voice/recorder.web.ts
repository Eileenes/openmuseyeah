import { useCallback, useRef, useState } from "react";
import type { Recording, VoiceRecorderHandle } from "./types";

/** Chrome and Firefox prefer Opus; Safari only records MP4/AAC. */
const CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/** How much audio to hand over at a time while recognising. */
const CHUNK_MS = 1200;

function extensionFor(type: string): string {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

export function useVoiceRecorder(): VoiceRecorderHandle {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
  }, []);

  const start = useCallback(async (options?: { onChunk?: (chunk: Blob) => void }) => {
    if (recorderRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia)
      throw new Error("This browser cannot record audio.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      chunksRef.current.push(event.data);
      // The server accumulates these, so partial slices are still decodable as
      // a whole once they are re-joined there.
      options?.onChunk?.(event.data);
    };
    // A timeslice is what makes `dataavailable` fire before the recording ends.
    recorder.start(options?.onChunk ? CHUNK_MS : undefined);
    recorderRef.current = recorder;
    setRecording(true);
  }, []);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await finished;
    recorderRef.current = null;
    release();
    setRecording(false);
    const type = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    if (blob.size === 0) return null;
    return {
      uri: URL.createObjectURL(blob),
      name: `recording.${extensionFor(type)}`,
      type,
      blob,
    };
  }, [release]);

  const cancel = useCallback(async () => {
    await stop();
  }, [stop]);

  return { recording, start, stop, cancel };
}
