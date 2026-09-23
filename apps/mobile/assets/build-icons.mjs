/**
 * Builds Vesper's icon set from one vector definition.
 *
 * Geometry mirrors apps/mobile/src/vesper-mark.tsx — change both together.
 * Run from the repository root:  node apps/mobile/assets/build-icons.mjs
 *
 * The assistant is a minimal 2D bot panda:
 *   - large round cream face, faint oval blush
 *   - eyes are two identical black vertical capsules, 3:1, sitting parallel
 *   - no iris, sclera, highlight, lash, brow, mouth or nose
 *   - flat pastel fills, minimal shading
 *   - ears are the one retained decoration that says "panda"
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));

const PLATE = "#2C2C31";
const FACE = "#F7F1E6";
const INK = "#17171A";
const BLUSH = "#E8B9AC";

/**
 * The face in its own frame, centred on the origin and scaleable by `r`.
 * Callers place and tilt it.
 */
function face(r) {
  const earR = r * 0.37;
  const earY = -r * 0.74;
  const earX = r * 0.68;
  const eyeW = r * 0.21;
  const eyeH = eyeW * 3; // the 3:1 capsule
  const eyeX = r * 0.37;
  const eyeY = -r * 0.1;
  const capsule = (cx) =>
    `<rect x="${cx - eyeW / 2}" y="${eyeY - eyeH / 2}" width="${eyeW}" height="${eyeH}" rx="${eyeW / 2}" fill="${INK}"/>`;
  return [
    `<circle cx="${-earX}" cy="${earY}" r="${earR}" fill="${INK}"/>`,
    `<circle cx="${earX}" cy="${earY}" r="${earR}" fill="${INK}"/>`,
    `<circle cx="0" cy="0" r="${r}" fill="${FACE}"/>`,
    `<ellipse cx="${-r * 0.72}" cy="${r * 0.04}" rx="${r * 0.19}" ry="${r * 0.12}" fill="${BLUSH}" fill-opacity="0.55"/>`,
    `<ellipse cx="${r * 0.72}" cy="${r * 0.04}" rx="${r * 0.19}" ry="${r * 0.12}" fill="${BLUSH}" fill-opacity="0.55"/>`,
    capsule(-eyeX),
    capsule(eyeX),
  ].join("");
}

/** Close-up: tilted clockwise, cropped by the left and bottom edges. */
function closeUp(size) {
  const r = size * 0.62;
  const placed = `translate(${size * 0.3} ${size * 0.82}) rotate(15) scale(1)`;
  return [
    `<rect width="${size}" height="${size}" fill="${PLATE}"/>`,
    `<g transform="${placed}">${face(r)}</g>`,
  ].join("");
}

/** Centred: for round masks, a splash and the in-app avatar, which cannot crop. */
function centred(size, scale) {
  const r = size * scale;
  return `<g transform="translate(${size / 2} ${size / 2})">${face(r)}</g>`;
}

const sources = {
  icon: {
    size: 1024,
    svg: "icon.svg",
    body: (size) => closeUp(size),
    pngs: [
      ["icon.png", 1024],
      ["favicon.png", 64],
    ],
  },
  adaptive: {
    size: 1024,
    svg: "adaptive-icon.svg",
    body: (size) => centred(size, 0.3),
    pngs: [["adaptive-icon.png", 1024]],
  },
  splash: {
    size: 1024,
    svg: "splash.svg",
    body: (size) => centred(size, 0.22),
    pngs: [["splash.png", 1024]],
  },
};

function svgFor({ size, body }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    body(size),
    "</svg>",
  ].join("");
}

mkdirSync(here, { recursive: true });
for (const source of Object.values(sources)) {
  const svg = svgFor(source);
  writeFileSync(join(here, source.svg), svg);
  for (const [name, width] of source.pngs) {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
    writeFileSync(join(here, name), resvg.render().asPng());
    console.log(`${name.padEnd(20)} ${width}x${width}`);
  }
}
console.log("Icons written to", here);
