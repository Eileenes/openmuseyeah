import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useCallback, useState } from "react";
import type { Recording, VoiceRecorderHandle } from "./types";

/**
 * Device recorder. Recording needs an Expo development build: expo-audio is a
 * native module and is not part of Expo Go. The recording is uploaded by URI.
 */
export function useVoiceRecorder(): VoiceRecorderHandle {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);

  // expo-audio records to a file and exposes neither slices nor loudness, so
  // `onChunk` and `onLevel` are accepted and ignored. The transcript comes from
  // the finished clip, and hands-free simply leaves the microphone open until
  // the person stops it rather than cutting at an utterance boundary.
  const start = useCallback(async () => {
    if (recording) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted)
      throw new Error("Microphone access is needed before Vesper can listen.");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }, [recorder, recording]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    if (!recording) return null;
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (!uri) return null;
    return { uri, name: "recording.m4a", type: "audio/m4a" };
  }, [recorder, recording]);

  const cancel = useCallback(async () => {
    if (!recording) return;
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [recorder, recording]);

  return { recording, start, stop, cancel };
}
