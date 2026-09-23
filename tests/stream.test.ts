import assert from "node:assert/strict";
import { test } from "node:test";
import { createRepeatGuard, flushSentence, takeSentences } from "../packages/voice/src/stream.ts";

test("a finished sentence is released while the rest is still streaming", () => {
  const { sentences, rest } = takeSentences("第一句话已经写完了。第二句还在");
  assert.deepEqual(sentences, ["第一句话已经写完了。"]);
  assert.equal(rest, "第二句还在");
});

test("an unterminated buffer releases nothing yet", () => {
  const { sentences, rest } = takeSentences("这句话还没有结束");
  assert.deepEqual(sentences, []);
  assert.equal(rest, "这句话还没有结束");
});

test("English sentences split on their own terminators", () => {
  const { sentences, rest } = takeSentences("The browser is open. Now reading the page");
  assert.deepEqual(sentences, ["The browser is open."]);
  assert.equal(rest, " Now reading the page");
});

test("decimals and domains are not treated as sentence ends", () => {
  const { sentences } = takeSentences(
    "The price is 3.5 dollars and the host is example.com today. ",
  );
  assert.deepEqual(sentences, ["The price is 3.5 dollars and the host is example.com today."]);
});

test("a short fragment waits instead of becoming its own clip", () => {
  const { sentences } = takeSentences("好的。请把那份表格填好然后发回给我。");
  assert.deepEqual(sentences, ["好的。请把那份表格填好然后发回给我。"]);
});

test("a short buffer that is genuinely all there is still gets spoken", () => {
  const { sentences, rest } = takeSentences("好的。");
  assert.deepEqual(sentences, ["好的。"]);
  assert.equal(rest, "");
});

test("multiple finished sentences are released in order", () => {
  const { sentences, rest } = takeSentences(
    "第一句话已经写完了。第二句话也已经写完了。第三句还在写",
  );
  assert.deepEqual(sentences, ["第一句话已经写完了。", "第二句话也已经写完了。"]);
  assert.equal(rest, "第三句还在写");
});

test("short leading sentences merge forward rather than becoming tiny clips", () => {
  const { sentences, rest } = takeSentences("第一句完成了。第二句也完成了。第三句还在写");
  assert.deepEqual(sentences, ["第一句完成了。第二句也完成了。"]);
  assert.equal(rest, "第三句还在写");
});

test("newlines end a sentence so lists are spoken line by line", () => {
  const { sentences, rest } = takeSentences("First item is done\nSecond item is done\nThird");
  assert.deepEqual(sentences, ["First item is done", "Second item is done"]);
  assert.equal(rest, "Third");
});

test("flushing trims whatever tail remains", () => {
  assert.equal(flushSentence("  最后一句没写完  "), "最后一句没写完");
});

test("the same sentence under a second message id is not spoken again", () => {
  // The streamed copy and the finished copy arrive with different ids.
  const isRepeat = createRepeatGuard(30000);
  const at = 1_000;
  assert.equal(isRepeat("streamed-id", "The page is open.", at), false);
  assert.equal(isRepeat("finished-id", "The page is open.", at + 200), true);
});

test("repeating a sentence inside one message is still allowed", () => {
  const isRepeat = createRepeatGuard(30000);
  assert.equal(isRepeat("one-id", "Done.", 1_000), false);
  assert.equal(isRepeat("one-id", "Done.", 1_500), false);
});

test("the repeat window expires so a later identical reply is spoken", () => {
  const isRepeat = createRepeatGuard(30_000);
  assert.equal(isRepeat("first", "All set.", 1_000), false);
  assert.equal(isRepeat("second", "All set.", 40_000), false);
});

test("the guard does not grow without bound", () => {
  const isRepeat = createRepeatGuard(1_000);
  for (let index = 0; index < 50; index += 1) isRepeat("id", `sentence ${index}`, index * 10);
  // Everything older than the window is pruned on the next call.
  isRepeat("id", "fresh", 100_000);
  assert.equal(isRepeat("other", "sentence 49", 100_001), false);
});
