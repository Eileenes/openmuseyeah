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

const INK = "#171B20";
const INNER_EAR = "#3B4148";
const FUR = "#FFFFFF";
const BLUSH = "#FFAEA1";

/** The assistant, drawn as a chibi panda in a 100-unit box. */
function panda() {
  return [
    // Ears sit behind the head so the head trims their lower half.
    `<circle cx="26" cy="26" r="14.5" fill="${INK}"/>`,
    `<circle cx="74" cy="26" r="14.5" fill="${INK}"/>`,
    `<circle cx="26" cy="26.5" r="7" fill="${INNER_EAR}"/>`,
    `<circle cx="74" cy="26.5" r="7" fill="${INNER_EAR}"/>`,
    `<circle cx="50" cy="55" r="35" fill="${FUR}"/>`,
    // Patches, tilted outward, with a clear gap down the middle of the face.
    `<ellipse cx="35.5" cy="50" rx="11" ry="13.5" fill="${INK}" transform="rotate(-14 35.5 50)"/>`,
    `<ellipse cx="64.5" cy="50" rx="11" ry="13.5" fill="${INK}" transform="rotate(14 64.5 50)"/>`,
    // Large pupils filling most of the eye, with two highlights: the classic
    // sparkle that makes a face read as friendly at small sizes.
    `<circle cx="36.5" cy="50.5" r="6.6" fill="#FFFFFF"/>`,
    `<circle cx="63.5" cy="50.5" r="6.6" fill="#FFFFFF"/>`,
    `<circle cx="36.8" cy="51" r="4.9" fill="#0E1216"/>`,
    `<circle cx="63.8" cy="51" r="4.9" fill="#0E1216"/>`,
    `<circle cx="35" cy="49" r="1.9" fill="#FFFFFF"/>`,
    `<circle cx="62" cy="49" r="1.9" fill="#FFFFFF"/>`,
    `<circle cx="38.4" cy="53" r="1" fill="#FFFFFF" fill-opacity="0.85"/>`,
    `<circle cx="65.4" cy="53" r="1" fill="#FFFFFF" fill-opacity="0.85"/>`,
    // A small nose over one soft smile reads better than a "w" mouth here.
    `<ellipse cx="50" cy="64.5" rx="4" ry="3" fill="#0E1216"/>`,
    `<path d="M42.5 68.6 q 7.5 6 15 0" stroke="#0E1216" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="22.5" cy="62.5" rx="6.2" ry="4.2" fill="${BLUSH}" fill-opacity="0.75"/>`,
    `<ellipse cx="77.5" cy="62.5" rx="6.2" ry="4.2" fill="${BLUSH}" fill-opacity="0.75"/>`,
  ].join("");
}

/** scale = fraction of the canvas the 100-unit box occupies. */
const sources = {
  icon: {
    size: 1024,
    scale: 0.78,
    bg: "plate",
    svg: "icon.svg",
    pngs: [
      ["icon.png", 1024],
      ["favicon.png", 64],
    ],
  },
  adaptive: {
    size: 1024,
    scale: 0.6,
    bg: null,
    svg: "adaptive-icon.svg",
    pngs: [["adaptive-icon.png", 1024]],
  },
  splash: { size: 1024, scale: 0.42, bg: null, svg: "splash.svg", pngs: [["splash.png", 1024]] },
};

function plate(size) {
  return [
    `<defs><linearGradient id="plate" x1="0" y1="0" x2="0.4" y2="1">`,
    `<stop offset="0" stop-color="#2E8C6E"/><stop offset="1" stop-color="#13514A"/>`,
    `</linearGradient></defs>`,
    `<rect width="${size}" height="${size}" fill="url(#plate)"/>`,
  ].join("");
}

function svgFor({ size, scale, bg }) {
  const s = size * scale * 0.01;
  const offset = (size - size * scale) / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    bg === "plate" ? plate(size) : "",
    `<g transform="translate(${offset} ${offset}) scale(${s})">${panda()}</g>`,
    "</svg>",
  ].join("");
}

mkdirSync(here, { recursive: true });
for (const source of Object.values(sources)) {
  const svg = svgFor(source);
  writeFileSync(join(here, source.svg), svg);
  for (const [name, width] of source.pngs) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      background: source.bg === "plate" ? undefined : undefined,
    });
    writeFileSync(join(here, name), resvg.render().asPng());
    console.log(`${name.padEnd(20)} ${width}x${width}`);
  }
}
console.log("Icons written to", here);
