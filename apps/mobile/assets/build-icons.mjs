/**
 * Builds Vesper's icon set from one vector definition.
 *
 * Geometry mirrors apps/mobile/src/vesper-mark.tsx — change both together.
 * Run from the repository root:  node apps/mobile/assets/build-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));

/** Four-point sparkle: quadratic curves pulled toward the centre. */
const spark = (cx, cy, r) =>
  `M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} ` +
  `Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`;

const INK = "#0B1626";

/** On the dark app icon the core runs brighter than it does inside the light app. */
const ICON = { from: "#7DD8FA", to: "#1E7FD0", ring: "#8FD3F5", glow: "#63CBF6" };
const APP = { from: "#63CBF6", to: "#125FAE", ring: "#6FB9E4", glow: "#BFE4F7" };

function defs({ from, to, glow }) {
  return [
    `<linearGradient id="core" x1="0" y1="0" x2="0.35" y2="1">`,
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`,
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">`,
    `<stop offset="0.35" stop-color="${glow}" stop-opacity="0.75"/>`,
    `<stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>`,
  ].join("");
}

function mark({ ring }) {
  return [
    `<circle cx="50" cy="50" r="46" fill="url(#glow)"/>`,
    `<circle cx="50" cy="50" r="42" fill="none" stroke="${ring}" stroke-width="2.4" ` +
      `stroke-linecap="round" stroke-opacity="0.55" stroke-dasharray="184 80" transform="rotate(-118 50 50)"/>`,
    `<circle cx="50" cy="50" r="30" fill="url(#core)"/>`,
    `<circle cx="42" cy="40" r="15" fill="#FFFFFF" fill-opacity="0.14"/>`,
    `<circle cx="50" cy="50" r="30" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1.4"/>`,
    `<path d="${spark(50, 50, 18)}" fill="#FFFFFF" fill-opacity="0.97"/>`,
    `<path d="${spark(75, 25, 5)}" fill="#FFFFFF" fill-opacity="0.72"/>`,
    `<circle cx="50" cy="8" r="3.4" fill="#FFFFFF" fill-opacity="0.9"/>`,
  ].join("");
}

/** scale = fraction of the canvas the 100-unit mark box occupies. */
const sources = {
  // Full-bleed opaque icon. iOS rejects transparency, so the plate is filled.
  icon: { size: 1024, scale: 0.62, palette: ICON, bg: INK },
  // Android adaptive foreground keeps the mark inside the 66% safe zone.
  adaptive: { size: 1024, scale: 0.5, palette: ICON, bg: null },
  splash: { size: 1024, scale: 0.4, palette: APP, bg: null },
};

function svgFor({ size, scale, palette, bg }) {
  const s = size * scale * 0.01;
  const offset = (size - size * scale) / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<defs>${defs(palette)}</defs>`,
    bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "",
    `<g transform="translate(${offset} ${offset}) scale(${s})">${mark(palette)}</g>`,
    "</svg>",
  ].join("");
}

const outputs = [
  { key: "icon", svg: "icon.svg", png: "icon.png", pngSize: 1024 },
  { key: "icon", png: "favicon.png", pngSize: 64 },
  { key: "adaptive", svg: "adaptive-icon.svg", png: "adaptive-icon.png", pngSize: 1024 },
  { key: "splash", svg: "splash.svg", png: "splash.png", pngSize: 1024 },
];

mkdirSync(here, { recursive: true });
const cache = new Map();
const source = (key) => {
  if (!cache.has(key)) cache.set(key, svgFor(sources[key]));
  return cache.get(key);
};

for (const out of outputs) {
  const svg = source(out.key);
  if (out.svg) writeFileSync(join(here, out.svg), svg);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: out.pngSize },
    background: sources[out.key].bg ?? undefined,
  });
  writeFileSync(join(here, out.png), resvg.render().asPng());
  console.log(`${out.png.padEnd(20)} ${out.pngSize}x${out.pngSize}`);
}
console.log("Icons written to", here);
