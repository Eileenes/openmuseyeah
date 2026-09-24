import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Rect } from "react-native-svg";

/**
 * Vesper's assistant: a minimal 2D bot panda.
 *
 * Large round cream face, faint oval blush, and eyes that are two identical
 * black vertical capsules at 3:1 sitting parallel. No iris, sclera, highlight,
 * lash, brow, mouth or nose. Flat pastel fills, minimal shading. The ears are
 * the one retained decoration that says "panda".
 *
 * The drawing is the app icon's composition, not a re-interpretation of it: the
 * face is enlarged, tilted 15 degrees clockwise and pushed past the left and
 * bottom edges, over the same dark plate. An avatar that only shared the face
 * but not the crop read as a different character next to the Dock icon.
 *
 * Geometry mirrors apps/mobile/assets/build-icons.mjs (closeUp) — change both
 * together. The one deliberate difference is the plate: the icon is a square,
 * while an avatar sits in a round chip, so the plate and the crop are circular.
 */
export type MarkVariant = "sky" | "sand" | "lilac";

const FACE = "#F7F1E6";
const INK = "#17171A";
const BLUSH = "#E8B9AC";

/**
 * The plate behind the face. "sky" is the app icon's own colour, so the default
 * avatar is identical to the Dock and Finder icon; the other two are the same
 * composition in a warm and a cool dark.
 */
const plates: Record<MarkVariant, string> = {
  sky: "#2C2C31",
  sand: "#3A332A",
  lilac: "#332E3F",
};

/** The face in its own frame, centred on the origin and scaleable by `r`. */
function face(r: number) {
  const earR = r * 0.37;
  const earY = -r * 0.74;
  const earX = r * 0.68;
  const eyeW = r * 0.21;
  const eyeH = eyeW * 3; // the 3:1 capsule
  const eyeX = r * 0.37;
  const eyeY = -r * 0.1;
  const capsule = (cx: number) => (
    <Rect
      x={cx - eyeW / 2}
      y={eyeY - eyeH / 2}
      width={eyeW}
      height={eyeH}
      rx={eyeW / 2}
      fill={INK}
    />
  );
  return (
    <G>
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
      {capsule(-eyeX)}
      {capsule(eyeX)}
    </G>
  );
}

export function VesperMark({ size, variant = "sky" }: { size: number; variant?: MarkVariant }) {
  // A clip reference has to be unique per instance, and React's useId contains
  // colons, which are not valid inside url(#...).
  const clipId = `vesper-mark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={50} cy={50} r={50} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Circle cx={50} cy={50} r={50} fill={plates[variant]} />
        {/* closeUp(): r = size * 0.62 at translate(0.3, 0.82), rotated 15deg. */}
        <G transform="translate(30 82) rotate(15)">{face(62)}</G>
      </G>
    </Svg>
  );
}
