import assert from "node:assert/strict";
import { test } from "node:test";
import { bufferedStreaming } from "../packages/voice/src/streaming.ts";
import type {
  SpeechToText,
  TranscribeInput,
  TranscribeResult,
} from "../packages/voice/src/types.ts";

/** Records every request so accumulation can be asserted without a network. */
function recorder() {
  const seen: number[] = [];
  const provider: SpeechToText = {
    provider: "test",
    model: "test-model",
    async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
      seen.push(input.audio.byteLength);
      return { text: `heard ${input.audio.byteLength} bytes`, language: input.language };
    },
  };
  return { seen, provider };
}

test("each push re-reads everything heard so far", async () => {
  const { seen, provider } = recorder();
  const session = bufferedStreaming(provider).startSession({ language: "zh" });
  const first = await session.push(new Uint8Array(100));
  assert.equal(first.text, "heard 100 bytes");
  assert.equal(first.language, "zh");
  const second = await session.push(new Uint8Array(50));
  assert.equal(second.text, "heard 150 bytes");
  assert.deepEqual(seen, [100, 150]);
});

test("an empty chunk is ignored instead of costing a request", async () => {
  const { seen, provider } = recorder();
  const session = bufferedStreaming(provider).startSession();
  const result = await session.push(new Uint8Array(0));
  assert.equal(result.text, "");
  assert.deepEqual(seen, [], "no provider call for silence");
});

test("finishing transcribes the complete utterance", async () => {
  const { seen, provider } = recorder();
  const session = bufferedStreaming(provider).startSession();
  await session.push(new Uint8Array(20));
  await session.push(new Uint8Array(30));
  const final = await session.finish();
  assert.equal(final.text, "heard 50 bytes");
  assert.deepEqual(seen, [20, 50, 50]);
});

test("finishing an empty session makes no provider call", async () => {
  const { seen, provider } = recorder();
  const session = bufferedStreaming(provider).startSession();
  const final = await session.finish();
  assert.equal(final.text, "");
  assert.deepEqual(seen, []);
});

test("a session refuses to grow past its byte budget", async () => {
  const { provider } = recorder();
  const session = bufferedStreaming(provider, { maxBytes: 120 }).startSession();
  await session.push(new Uint8Array(100));
  await assert.rejects(() => session.push(new Uint8Array(50)), /too long/i);
});

test("the streaming wrapper still exposes the batch contract", async () => {
  const { provider } = recorder();
  const streaming = bufferedStreaming(provider);
  assert.equal(streaming.provider, "test");
  assert.equal(streaming.model, "test-model");
  const result = await streaming.transcribe({ audio: new Uint8Array(7), mimeType: "audio/wav" });
  assert.equal(result.text, "heard 7 bytes");
});
