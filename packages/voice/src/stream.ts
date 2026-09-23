/**
 * Splits a streaming reply into speakable sentences.
 *
 * Waiting for the whole reply before synthesizing is what makes a voice
 * assistant feel slow: a long answer can take many seconds to produce. Cutting
 * at sentence boundaries lets the first sentence start playing while the rest is
 * still being written.
 *
 * Pure on purpose — no timers, no providers — so the boundary rules stay
 * testable without a network or a device.
 */

/** Sentence enders across the languages this assistant is used in. */
const TERMINATORS = new Set(["。", "！", "？", "…", "!", "?", ";", "；", "\n"]);
const PERIOD = ".";

/**
 * A terminator only ends a sentence when it is followed by whitespace or the end
 * of the buffer, which keeps "3.5" and "example.com" in one piece.
 */
function isBoundary(text: string, index: number): boolean {
  const character = text[index];
  if (character === undefined) return false;
  if (character === PERIOD) {
    const before = text[index - 1];
    const after = text[index + 1];
    if (before !== undefined && /\d/.test(before)) return false;
    if (after !== undefined && /\w/.test(after)) return false;
    if (after === undefined) return true;
    return /\s/.test(after);
  }
  return TERMINATORS.has(character);
}

export interface SentenceChunk {
  /** Complete sentences ready to be spoken, in order. */
  sentences: string[];
  /** Text held back because it has no terminator yet. */
  rest: string;
}

/**
 * `minChars` stops the splitter from speaking fragments such as "好的" or an
 * abbreviation on its own; short leading pieces are merged into the next
 * sentence instead of becoming their own clip.
 */
export function takeSentences(text: string, minChars = 8): SentenceChunk {
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!isBoundary(text, index)) continue;
    const candidate = text.slice(start, index + 1).trim();
    if (!candidate) {
      start = index + 1;
      continue;
    }
    if (candidate.length < minChars && index + 1 < text.length) continue;
    sentences.push(candidate);
    start = index + 1;
  }
  return { sentences, rest: text.slice(start) };
}

/** Everything still unsaid, used to flush the tail when a run ends. */
export function flushSentence(text: string): string {
  return text.trim();
}

/**
 * Guards against speaking the same sentence twice.
 *
 * One reply can reach the client under two different message ids — the streamed
 * copy and the version the runtime later reports as the finished message — which
 * made a whole answer play twice. Repetition *within* a single message is still
 * allowed, because that can be intentional.
 *
 * `now` is injectable so the window is testable without waiting.
 */
export function createRepeatGuard(windowMs = 30000) {
  const recent = new Map<string, { id: string; at: number }>();
  return function isRepeat(id: string, sentence: string, now = Date.now()): boolean {
    for (const [text, entry] of recent) if (now - entry.at > windowMs) recent.delete(text);
    const seen = recent.get(sentence);
    recent.set(sentence, { id, at: now });
    return seen !== undefined && seen.id !== id && now - seen.at < windowMs;
  };
}
