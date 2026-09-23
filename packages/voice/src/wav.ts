/** Minimal 16-bit PCM WAV encoding, used by the offline stub voice and by the
 * provider connectivity check. Pure and dependency-free. */
const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

export function encodeWav(samples: Float32Array, sampleRate = 22050): Uint8Array {
  const dataSize = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true);
  view.setUint16(32, BYTES_PER_SAMPLE, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(HEADER_BYTES + index * BYTES_PER_SAMPLE, Math.round(clamped * 32767), true);
  }
  return new Uint8Array(buffer);
}

/** A short soft tone whose length tracks the text, so playback is verifiable offline. */
export function toneWav(text: string, speed = 1, sampleRate = 22050): Uint8Array {
  const rate = Math.max(0.25, Math.min(4, speed));
  const seconds = Math.min(4, Math.max(0.6, text.trim().length * 0.045)) / rate;
  const total = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(total);
  const fade = Math.min(Math.floor(sampleRate * 0.06), Math.floor(total / 4));
  for (let index = 0; index < total; index += 1) {
    const t = index / sampleRate;
    const envelope = Math.min(1, index / fade, (total - index) / fade);
    samples[index] = 0.22 * envelope * Math.sin(2 * Math.PI * 440 * t);
  }
  return encodeWav(samples, sampleRate);
}

/** Silence used to prove a real speech-to-text provider accepts our request shape. */
export function silenceWav(seconds = 0.4, sampleRate = 16000): Uint8Array {
  return encodeWav(new Float32Array(Math.floor(sampleRate * seconds)), sampleRate);
}
