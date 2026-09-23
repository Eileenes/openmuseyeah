import assert from "node:assert/strict";
import { test } from "node:test";
import { createUtteranceDetector } from "../packages/voice/src/utterance.ts";

const LOUD = 0.2;
const QUIET = 0.001;

/** Feeds `ms` of a constant level in 100 ms frames starting at \`at\`. */
function feed(
  detector: ReturnType<typeof createUtteranceDetector>,
  level: number,
  ms: number,
  at: number,
) {
  const events: string[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    const event = detector.push(level, at + elapsed);
    if (event) events.push(event);
  }
  return { events, next: at + ms };
}

test("a brief noise does not open a turn", () => {
  const detector = createUtteranceDetector({ minSpeechMs: 250 });
  const { events } = feed(detector, LOUD, 100, 0);
  assert.deepEqual(events, []);
  assert.equal(detector.speaking(), false);
});

test("sustained speech opens a turn once", () => {
  const detector = createUtteranceDetector({ minSpeechMs: 250 });
  const first = feed(detector, LOUD, 400, 0);
  assert.deepEqual(first.events, ["started"]);
  assert.equal(detector.speaking(), true);
  const more = feed(detector, LOUD, 500, first.next);
  assert.deepEqual(more.events, [], "an open turn does not restart");
});

test("silence closes the turn after the configured gap", () => {
  const detector = createUtteranceDetector({ minSpeechMs: 200, silenceMs: 500 });
  const speech = feed(detector, LOUD, 400, 0);
  const pause = feed(detector, QUIET, 400, speech.next);
  assert.deepEqual(pause.events, [], "a short pause is not the end of a turn");
  const rest = feed(detector, QUIET, 300, pause.next);
  assert.deepEqual(rest.events, ["ended"]);
  assert.equal(detector.speaking(), false);
});

test("a pause mid-sentence does not split the turn when it is short", () => {
  const detector = createUtteranceDetector({ minSpeechMs: 200, silenceMs: 800 });
  const first = feed(detector, LOUD, 300, 0);
  const gap = feed(detector, QUIET, 300, first.next);
  const more = feed(detector, LOUD, 300, gap.next);
  assert.deepEqual([...first.events, ...gap.events, ...more.events], ["started"]);
  assert.equal(detector.speaking(), true);
});

test("a stuck microphone is cut off rather than recording forever", () => {
  const detector = createUtteranceDetector({ minSpeechMs: 100, maxUtteranceMs: 1000 });
  const { events } = feed(detector, LOUD, 2000, 0);
  assert.deepEqual(events, ["started", "too-long"], "a stuck input must not keep re-opening turns");
  assert.equal(detector.speaking(), false);
});

test("listening resumes only after the stuck input actually goes quiet", () => {
  const detector = createUtteranceDetector({
    minSpeechMs: 100,
    maxUtteranceMs: 500,
    silenceMs: 200,
  });
  const stuck = feed(detector, LOUD, 1000, 0);
  assert.deepEqual(stuck.events, ["started", "too-long"]);
  const recovered = feed(detector, LOUD, 500, stuck.next);
  assert.deepEqual(recovered.events, [], "still loud, so nothing new starts");
  const quiet = feed(detector, QUIET, 300, recovered.next);
  const again = feed(detector, LOUD, 300, quiet.next);
  assert.deepEqual(again.events, ["started"], "once quiet, a new turn can begin");
});

test("after a turn ends a new one can start", () => {
  const detector = createUtteranceDetector({ minSpeechMs: 100, silenceMs: 200 });
  const first = feed(detector, LOUD, 300, 0);
  const gap = feed(detector, QUIET, 300, first.next);
  const second = feed(detector, LOUD, 300, gap.next);
  assert.deepEqual(
    [...first.events, ...gap.events, ...second.events],
    ["started", "ended", "started"],
  );
});

test("reset abandons an open turn", () => {
  const detector = createUtteranceDetector({ minSpeechMs: 100 });
  feed(detector, LOUD, 300, 0);
  assert.equal(detector.speaking(), true);
  detector.reset();
  assert.equal(detector.speaking(), false);
  const again = feed(detector, LOUD, 300, 10_000);
  assert.deepEqual(again.events, ["started"]);
});
