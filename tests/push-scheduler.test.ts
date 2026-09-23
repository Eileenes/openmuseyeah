import assert from "node:assert/strict";
import { test } from "node:test";
import { createPushScheduler } from "../packages/voice/src/push-scheduler.ts";

test("the first push is not throttled", () => {
  const scheduler = createPushScheduler({ minIntervalMs: 1200, minBytes: 100 });
  assert.equal(scheduler.offer(100, 0), true, "the person is waiting for text");
});

test("small amounts of audio wait instead of costing a request", () => {
  const scheduler = createPushScheduler({ minBytes: 1000 });
  assert.equal(scheduler.offer(400, 0), false);
  assert.equal(scheduler.offer(400, 10), false);
  assert.equal(scheduler.pending(), 800);
  assert.equal(scheduler.offer(400, 20), true);
  assert.equal(scheduler.pending(), 0);
});

test("pushes are spaced out even when audio keeps arriving", () => {
  const scheduler = createPushScheduler({ minIntervalMs: 1000, minBytes: 10 });
  assert.equal(scheduler.offer(500, 0), true);
  assert.equal(scheduler.offer(500, 300), false, "too soon");
  assert.equal(scheduler.offer(500, 900), false, "still too soon");
  assert.equal(scheduler.offer(500, 1000), true);
});

test("audio that arrives during a throttle window is not lost", () => {
  const scheduler = createPushScheduler({ minIntervalMs: 1000, minBytes: 10 });
  scheduler.offer(100, 0);
  scheduler.offer(250, 200);
  assert.equal(scheduler.pending(), 250);
  assert.equal(scheduler.offer(0, 1000), true, "the held audio is pushed on the next window");
});

test("a silent interval does not trigger an empty push", () => {
  const scheduler = createPushScheduler({ minIntervalMs: 100, minBytes: 10 });
  scheduler.offer(50, 0);
  assert.equal(scheduler.offer(0, 5000), false);
  assert.equal(scheduler.hasPending(), false);
});

test("flush reports whether anything is waiting", () => {
  const scheduler = createPushScheduler({ minIntervalMs: 10000, minBytes: 1 });
  assert.equal(scheduler.hasPending(), false);
  scheduler.offer(10, 0);
  scheduler.offer(10, 10);
  assert.equal(scheduler.hasPending(), true);
  scheduler.reset();
  assert.equal(scheduler.hasPending(), false);
});

test("cancelling clears the buffer without pushing", () => {
  // Below the byte floor, so the audio is still buffered rather than sent.
  const scheduler = createPushScheduler({ minBytes: 1000 });
  assert.equal(scheduler.offer(500, 0), false);
  assert.equal(scheduler.pending(), 500);
  scheduler.reset();
  assert.equal(scheduler.pending(), 0);
});
