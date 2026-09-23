import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

/**
 * Vesper's assistant, drawn as a chibi panda.
 *
 * Vector so one definition serves every surface and size. Geometry mirrors
 * apps/mobile/assets/build-icons.mjs — change both together.
 *
 * The face is deliberately built from a few large shapes: at the 42 px default
 * the eyes are only a couple of pixels across, so the highlights and the
 * silhouette carry the character rather than fine detail.
 */
export type MarkVariant = "sky" | "sand" | "lilac";

const INK = "#171B20";
const INNER_EAR = "#3B4148";
const FUR = "#FFFFFF";
const BLUSH = "#FFAEA1";

/** Tints sit behind the head; they only need to frame it, not carry colour. */
const palettes: Record<MarkVariant, string> = {
  sky: "#DCEBF6",
  sand: "#F6E7CF",
  lilac: "#E7E1F6",
};

export function markTint(variant: MarkVariant = "sky") {
  return palettes[variant];
}

/** The panda itself is colourless; only the tint behind it varies (see Mascot). */
export function VesperMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Ears sit behind the head so the head trims their lower half. */}
      <Circle cx="26" cy="26" r="14.5" fill={INK} />
      <Circle cx="74" cy="26" r="14.5" fill={INK} />
      <Circle cx="26" cy="26.5" r="7" fill={INNER_EAR} />
      <Circle cx="74" cy="26.5" r="7" fill={INNER_EAR} />
      <Circle cx="50" cy="55" r="35" fill={FUR} />

      {/* Patches, tilted outward, with a clear gap down the middle. */}
      <G>
        <Ellipse cx="35.5" cy="50" rx="11" ry="13.5" fill={INK} transform="rotate(-14 35.5 50)" />
        <Ellipse cx="64.5" cy="50" rx="11" ry="13.5" fill={INK} transform="rotate(14 64.5 50)" />
      </G>

      {/* Large pupils with two highlights: the sparkle is what makes it friendly. */}
      <Circle cx="36.5" cy="50.5" r="6.6" fill="#FFFFFF" />
      <Circle cx="63.5" cy="50.5" r="6.6" fill="#FFFFFF" />
      <Circle cx="36.8" cy="51" r="4.9" fill="#0E1216" />
      <Circle cx="63.8" cy="51" r="4.9" fill="#0E1216" />
      <Circle cx="35" cy="49" r="1.9" fill="#FFFFFF" />
      <Circle cx="62" cy="49" r="1.9" fill="#FFFFFF" />
      <Circle cx="38.4" cy="53" r="1" fill="#FFFFFF" fillOpacity={0.85} />
      <Circle cx="65.4" cy="53" r="1" fill="#FFFFFF" fillOpacity={0.85} />

      <Ellipse cx="50" cy="64.5" rx="4" ry="3" fill="#0E1216" />
      <Path
        d="M42.5 68.6 q 7.5 6 15 0"
        stroke="#0E1216"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Ellipse cx="22.5" cy="62.5" rx="6.2" ry="4.2" fill={BLUSH} fillOpacity={0.75} />
      <Ellipse cx="77.5" cy="62.5" rx="6.2" ry="4.2" fill={BLUSH} fillOpacity={0.75} />
    </Svg>
  );
}
