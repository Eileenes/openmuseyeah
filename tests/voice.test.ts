import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Config } from "../apps/server/src/config.ts";
import { createStore } from "../apps/server/src/db.ts";
import { VoiceService } from "../apps/server/src/voice.ts";
import {
  encodeWav,
  OpenAiSpeechToText,
  OpenAiTextToSpeech,
  StubSpeechToText,
  StubTextToSpeech,
  silenceWav,
  speakable,
  toneWav,
} from "../packages/voice/src/index.ts";

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: "/unused",
    agentBackend: "sample",
    googleRedirectUri: "http://localhost/callback",
    allowedOrigins: [],
    ...overrides,
  };
}

/** Records every request so the provider contract can be asserted without a network. */
function recordingFetch(reply: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: unknown, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return reply();
  }) as unknown as typeof fetch;
  return { calls, impl };
}

function headerAt(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

test("speakable strips markup that would sound like noise through a speaker", () => {
  const reply = [
    "# Findings",
    "",
    "Here is **bold** text and a [source link](https://example.com/very/long/path).",
    "",
    "```js",
    "const hidden = 1;",
    "```",
    "",
    "- first item",
    "1. second item",
  ].join("\n");
  const spoken = speakable(reply);
  assert.ok(spoken.includes("bold"), spoken);
  assert.ok(spoken.includes("source link"), spoken);
  assert.ok(!spoken.includes("https://"), spoken);
  assert.ok(!spoken.includes("const hidden"), spoken);
  assert.ok(!spoken.includes("#"), spoken);
  assert.ok(!spoken.includes("**"), spoken);
  assert.ok(!spoken.includes("- first"), spoken);
  assert.ok(spoken.includes("first item"), spoken);
});

test("speakable cuts at a sentence boundary instead of mid-word", () => {
  const sentence = "这是一个很长的回答，需要被截断。";
  const spoken = speakable(sentence.repeat(20), { maxChars: 60 });
  assert.ok(spoken.length <= 62, `length ${spoken.length}`);
  assert.ok(spoken.endsWith("…"), spoken.slice(-8));
  assert.ok(spoken.startsWith("这是一个很长的回答"), spoken.slice(0, 12));
});

test("speakable leaves ordinary prose untouched", () => {
  assert.equal(speakable("明天上午十点出发。"), "明天上午十点出发。");
});

test("WAV encoding writes a readable 16-bit PCM header", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const bytes = encodeWav(samples, 16000);
  assert.equal(headerAt(bytes, 0, 4), "RIFF");
  assert.equal(headerAt(bytes, 8, 4), "WAVE");
  assert.equal(headerAt(bytes, 36, 4), "data");
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), samples.length * 2);
  assert.equal(bytes.byteLength, 44 + samples.length * 2);
  assert.equal(view.getInt16(44, true), 0);
  // 0.5 * 32767 = 16383.5, and Math.round breaks the tie upward.
  assert.equal(view.getInt16(46, true), 16384);
});

test("stub voice works with no key, no network and no account", async () => {
  const speech = new StubSpeechToText();
  const heard = await speech.transcribe({ audio: silenceWav(0.2), mimeType: "audio/wav" });
  assert.ok(heard.text.includes("[stub]"), heard.text);
  assert.ok(heard.text.includes("audio/wav"), heard.text);

  const voice = new StubTextToSpeech();
  const said = await voice.synthesize({
    text: "hello",
    voiceId: "stub-tone",
    format: "mp3",
    speed: 1,
  });
  assert.equal(said.mimeType, "audio/wav");
  assert.ok(said.audio.byteLength > 44);
  assert.equal(headerAt(said.audio, 0, 4), "RIFF");
});

test("the stub tone stays bounded in length", () => {
  const short = toneWav("hi");
  const long = toneWav("x".repeat(5000));
  assert.ok(long.byteLength > short.byteLength);
  // capped at 4 s of 22050 Hz 16-bit mono
  assert.ok(long.byteLength <= 44 + 22050 * 4 * 2);
});

test("OpenAI transcription sends the documented multipart shape", async () => {
  const { calls, impl } = recordingFetch(
    () =>
      new Response(JSON.stringify({ text: "你好世界" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const speech = new OpenAiSpeechToText("whisper-1", { apiKey: "sk-secret", fetchImpl: impl });
  const heard = await speech.transcribe({
    audio: silenceWav(0.1),
    mimeType: "audio/wav",
    language: "zh",
  });
  assert.equal(heard.text, "你好世界");
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call, "expected one transcription request");
  assert.equal(call.url, "https://api.openai.com/v1/audio/transcriptions");
  assert.equal((call.init.headers as Record<string, string>).Authorization, "Bearer sk-secret");
  const form = call.init.body as FormData;
  assert.equal(form.get("model"), "whisper-1");
  assert.equal(form.get("language"), "zh");
  assert.equal((form.get("file") as File).name, "audio.wav");
});

test("the uploaded file name follows the recorded mime type", async () => {
  for (const [mimeType, expected] of [
    ["audio/mp4", "audio.m4a"],
    ["audio/webm;codecs=opus", "audio.webm"],
    ["audio/mpeg", "audio.mp3"],
  ] as const) {
    const { calls, impl } = recordingFetch(
      () => new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
    );
    const speech = new OpenAiSpeechToText("whisper-1", { apiKey: "k", fetchImpl: impl });
    await speech.transcribe({ audio: silenceWav(0.05), mimeType });
    const call = calls[0];
    assert.ok(call, "expected one transcription request");
    assert.equal(((call.init.body as FormData).get("file") as File).name, expected, mimeType);
  }
});

test("OpenAI speech sends the requested voice, format and speed", async () => {
  const { calls, impl } = recordingFetch(
    () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }),
  );
  const voice = new OpenAiTextToSpeech("tts-1", { apiKey: "sk-secret", fetchImpl: impl });
  const said = await voice.synthesize({
    text: "Read this",
    voiceId: "nova",
    format: "mp3",
    speed: 1.25,
  });
  assert.equal(said.mimeType, "audio/mpeg");
  assert.deepEqual([...said.audio], [1, 2, 3, 4]);
  const body = JSON.parse(String(calls[0]?.init.body));
  assert.deepEqual(body, {
    model: "tts-1",
    voice: "nova",
    input: "Read this",
    response_format: "mp3",
    speed: 1.25,
  });
});

test("provider failures surface a readable message and never the key", async () => {
  const { impl } = recordingFetch(() => new Response("invalid api key", { status: 401 }));
  const voice = new OpenAiTextToSpeech("tts-1", { apiKey: "sk-secret-value", fetchImpl: impl });
  await assert.rejects(
    () => voice.synthesize({ text: "hi", voiceId: "alloy", format: "mp3" }),
    (error: Error) => {
      assert.ok(error.message.includes("401"), error.message);
      assert.ok(error.message.includes("invalid api key"), error.message);
      assert.ok(!error.message.includes("sk-secret-value"), error.message);
      return true;
    },
  );
});

test("voice settings default to the offline provider and merge partial updates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const voice = new VoiceService(db, testConfig({ dataDir: directory }));
    const initial = await voice.settings("owner");
    assert.equal(initial.stt.provider, "stub");
    assert.equal(initial.tts.provider, "stub");
    assert.equal(initial.voice.speakReplies, true);

    const saved = await voice.saveSettings("owner", { voice: { handsFree: true } });
    assert.equal(saved.voice.handsFree, true);
    assert.equal(saved.stt.provider, "stub");
    assert.ok(saved.updatedAt > initial.updatedAt);
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("switching provider adopts that provider's default model", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const voice = new VoiceService(db, testConfig({ dataDir: directory }));
    const saved = await voice.saveSettings("owner", {
      stt: { provider: "openai" },
      tts: { provider: "openai" },
    });
    assert.equal(saved.stt.model, "whisper-1");
    assert.equal(saved.tts.voiceId, "alloy");
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a stored key is encrypted at rest and only ever returned masked", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const voice = new VoiceService(db, testConfig({ dataDir: directory }));
    await voice.saveSettings("owner", { keys: { openai: "sk-abcdefghijklmnop" } });

    const record = await db.get<{ encrypted: string }>("owner", "model-credentials", "openai");
    assert.ok(record, "credential should be stored");
    assert.ok(!record.encrypted.includes("sk-abcdefghijklmnop"), "must not be plaintext");

    const view = await voice.publicSettings("owner");
    assert.equal(view.credentials.openai?.stored, true);
    assert.equal(view.credentials.openai?.masked, "••••mnop");
    assert.ok(!JSON.stringify(view).includes("sk-abcdefghijklmnop"));
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("identical speech is synthesized once and then served from cache", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const { calls, impl } = recordingFetch(
      () => new Response(new Uint8Array([9, 9, 9]), { status: 200 }),
    );
    const voice = new VoiceService(db, testConfig({ dataDir: directory }), { fetchImpl: impl });
    await voice.saveSettings("owner", {
      tts: { provider: "openai" },
      keys: { openai: "sk-test-key-value" },
    });

    const first = await voice.synthesize("owner", { text: "Good evening." });
    const second = await voice.synthesize("owner", { text: "Good evening." });
    assert.deepEqual([...first.audio], [...second.audio]);
    assert.equal(calls.length, 1, "the provider must not be billed twice");

    await voice.synthesize("owner", { text: "Something else entirely." });
    assert.equal(calls.length, 2);
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("speech synthesis speaks the cleaned text, not the raw markdown", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const { calls, impl } = recordingFetch(
      () => new Response(new Uint8Array([1]), { status: 200 }),
    );
    const voice = new VoiceService(db, testConfig({ dataDir: directory }), { fetchImpl: impl });
    await voice.saveSettings("owner", {
      tts: { provider: "openai" },
      keys: { openai: "sk-test-key-value" },
    });
    const result = await voice.synthesize("owner", {
      text: "Check **this** out:\n\n```js\nconst x = 1;\n```\n",
    });
    const sent = JSON.parse(String(calls[0]?.init.body)).input as string;
    assert.equal(sent, result.spoken);
    assert.ok(!sent.includes("**"), sent);
    assert.ok(!sent.includes("const x"), sent);
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("choosing a real provider without a key explains what to do", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const voice = new VoiceService(db, testConfig({ dataDir: directory }));
    await voice.saveSettings("owner", { stt: { provider: "openai" } });
    await assert.rejects(
      () => voice.transcribe("owner", { audio: silenceWav(0.05), mimeType: "audio/wav" }),
      /API key/i,
    );
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("synthesized audio is parked behind a short-lived id, never a public path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const voice = new VoiceService(db, testConfig({ dataDir: directory }));
    const id = voice.putAudio({ audio: new Uint8Array([7, 7]), mimeType: "audio/wav" });
    assert.ok(id.length >= 16, "the id must not be guessable");
    const parked = voice.getAudio(id);
    assert.ok(parked, "the parked audio should resolve");
    assert.deepEqual([...parked.bytes], [7, 7]);
    assert.equal(voice.getAudio("not-an-id"), null, "unknown ids resolve to nothing");
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the parked audio store stays bounded", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-voice-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const voice = new VoiceService(db, testConfig({ dataDir: directory }));
    const first = voice.putAudio({ audio: new Uint8Array([1]), mimeType: "audio/wav" });
    for (let index = 0; index < 40; index += 1)
      voice.putAudio({ audio: new Uint8Array([1]), mimeType: "audio/wav" });
    assert.equal(voice.getAudio(first), null, "the oldest entry is evicted");
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
