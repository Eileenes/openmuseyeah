import Svg, { Circle, Ellipse, G, Rect } from "react-native-svg";

/**
 * Vesper's assistant: a minimal 2D bot panda.
 *
 * Large round cream face, faint oval blush, and eyes that are two identical
 * black vertical capsules at 3:1 sitting parallel. No iris, sclera, highlight,
 * lash, brow, mouth or nose. Flat pastel fills, minimal shading. The ears are
 * the one retained decoration that says "panda".
 *
 * Geometry mirrors apps/mobile/assets/build-icons.mjs — change both together.
 * The icon is a cropped, tilted close-up; here the same face is centred, because
 * an avatar inside a round chip cannot lose its edges.
 */
export type MarkVariant = "sky" | "sand" | "lilac";

const FACE = "#F7F1E6";
const INK = "#17171A";
const BLUSH = "#E8B9AC";

/** Tints sit behind the head and only need to frame it. */
const palettes: Record<MarkVariant, string> = {
  sky: "#DCEBF6",
  sand: "#F6E7CF",
  lilac: "#E7E1F6",
};

export function markTint(variant: MarkVariant = "sky") {
  return palettes[variant];
}

export function VesperMark({ size }: { size: number }) {
  // Everything is derived from the face radius so the drawing scales cleanly.
  const r = 34;
  const earR = r * 0.37;
  const earX = r * 0.68;
  const earY = -r * 0.74;
  const eyeW = r * 0.21;
  const eyeH = eyeW * 3;
  const eyeX = r * 0.37;
  const eyeY = -r * 0.1;
  const capsule = (key: string, cx: number) => (
    <Rect
      key={key}
      x={cx - eyeW / 2}
      y={eyeY - eyeH / 2}
      width={eyeW}
      height={eyeH}
      rx={eyeW / 2}
      fill={INK}
    />
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="translate(50 50)">
        <Circle cx={-earX} cy={earY} r={earR} fill={INK} />
        <Circle cx={earX} cy={earY} r={earR} fill={INK} />
        <Circle cx={0} cy={0} r={r} fill={FACE} />
        <Ellipse
          cx={-r * 0.72}
          cy={r * 0.04}
          rx={r * 0.19}
          ry={r * 0.12}
          fill={BLUSH}
          fillOpacity={0.55}
        />
        <Ellipse
          cx={r * 0.72}
          cy={r * 0.04}
          rx={r * 0.19}
          ry={r * 0.12}
          fill={BLUSH}
          fillOpacity={0.55}
        />
        {capsule("left", -eyeX)}
        {capsule("right", eyeX)}
      </G>
    </Svg>
  );
}
