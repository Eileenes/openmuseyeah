import { useId } from "react";
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

/**
 * Vesper's original mark: a faceted energy core inside an instrument ring,
 * with an evening-star spark. Vector so one definition serves every surface
 * and every size. Deliberately generic science-fiction vocabulary — no
 * third-party character, armor, reactor or HUD framing.
 *
 * Geometry mirrors apps/mobile/assets/build-icons.mjs — change both together.
 */
export type MarkVariant = "sky" | "sand" | "lilac";

const palettes: Record<MarkVariant, { glow: string; ring: string; from: string; to: string }> = {
  sky: { glow: "#BFE4F7", ring: "#6FB9E4", from: "#63CBF6", to: "#125FAE" },
  sand: { glow: "#F6E2BE", ring: "#DFB877", from: "#F3C468", to: "#B0721A" },
  lilac: { glow: "#DCD3F4", ring: "#AE9BE2", from: "#A78BEC", to: "#5538AC" },
};

/** Four-point sparkle: quadratic curves pulled toward the centre. */
function spark(cx: number, cy: number, r: number) {
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx} ${cy} ${cx + r} ${cy}`,
    `Q ${cx} ${cy} ${cx} ${cy + r}`,
    `Q ${cx} ${cy} ${cx - r} ${cy}`,
    `Q ${cx} ${cy} ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
}

export function VesperMark({ size, variant = "sky" }: { size: number; variant?: MarkVariant }) {
  const p = palettes[variant];
  /*
   * Gradient ids must be unique per instance. The avatar picker renders all
   * three variants at once, and duplicate ids in one document make every
   * url(#id) reference resolve to whichever element came first — which would
   * paint all three swatches in the first variant's colours.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const coreId = `vesper-core-${uid}`;
  const glowId = `vesper-glow-${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={coreId} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={p.from} />
          <Stop offset="1" stopColor={p.to} />
        </LinearGradient>
        <RadialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0.35" stopColor={p.glow} stopOpacity="0.75" />
          <Stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Halo */}
      <Circle cx="50" cy="50" r="46" fill={`url(#${glowId})`} />

      {/* Instrument ring with an open gauge gap */}
      <Circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke={p.ring}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeOpacity="0.55"
        strokeDasharray={[184, 80]}
        transform="rotate(-118 50 50)"
      />

      {/* Faceted core with a top-left sheen for depth */}
      <Circle cx="50" cy="50" r="30" fill={`url(#${coreId})`} />
      <Circle cx="42" cy="40" r="15" fill="#FFFFFF" fillOpacity={0.14} />
      <Circle
        cx="50"
        cy="50"
        r="30"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.35"
        strokeWidth="1.4"
      />

      {/* Evening star */}
      <G>
        <Path d={spark(50, 50, 18)} fill="#FFFFFF" fillOpacity={0.97} />
        <Path d={spark(75, 25, 5)} fill="#FFFFFF" fillOpacity={0.72} />
      </G>

      {/* Orbital bead */}
      <Circle cx="50" cy="8" r="3.4" fill="#FFFFFF" fillOpacity="0.9" />
    </Svg>
  );
}
