/**
 * Turns an assistant reply into text that is worth reading aloud.
 *
 * Replies carry Markdown, code fences, links and card references that sound
 * like noise through a speaker. This is a pure function so it stays testable
 * without any provider.
 */
const CODE_FENCE = /```[\s\S]*?```/g;
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]+)\]\([^)]*\)/g;
const BARE_URL = /https?:\/\/\S+/g;
const HEADING = /^\s{0,3}#{1,6}\s+/gm;
const BULLET = /^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+/gm;
const EMPHASIS = /(\*\*|__|\*|_|~~)/g;
const TABLE_RULE = /^\s*\|?[\s:|-]{4,}\|?\s*$/gm;
const TABLE_PIPE = /\s*\|\s*/g;
const BLANK_RUN = /\n{2,}/g;
const SPACE_RUN = /[ \t]{2,}/g;

/** Cut at a sentence boundary so a spoken reply never stops mid-word. */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const window = text.slice(0, maxChars);
  const boundary = Math.max(
    window.lastIndexOf("。"),
    window.lastIndexOf("！"),
    window.lastIndexOf("？"),
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  const cut = boundary > maxChars * 0.5 ? window.slice(0, boundary + 1) : window;
  return `${cut.trim()} …`;
}

export function speakable(text: string, options: { maxChars?: number } = {}): string {
  const maxChars = options.maxChars ?? 600;
  let out = text
    .replace(CODE_FENCE, " ")
    .replace(IMAGE, "$1")
    .replace(LINK, "$1")
    .replace(BARE_URL, "")
    .replace(TABLE_RULE, "")
    .replace(HEADING, "")
    .replace(BULLET, "")
    .replace(EMPHASIS, "")
    .replace(TABLE_PIPE, ", ")
    .replace(/`/g, "")
    .replace(SPACE_RUN, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(BLANK_RUN, "\n")
    .trim();
  out = truncate(out, maxChars);
  return out;
}
