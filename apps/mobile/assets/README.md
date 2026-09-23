# Vesper artwork

## The mark

Vesper's mark is an original vector design: a faceted energy core inside an open
instrument ring, with an evening-star spark and an orbital bead. It is drawn
from primitives, so one definition serves every surface and every size — the
in-app `VesperMark` component and the exported icon set share the same geometry.

It is intentionally generic science-fiction vocabulary: an abstract core, a
gauge ring and a star. It contains **no third-party character, armor, reactor,
HUD framing or other protected design**, and no resemblance to any film or
comic property is intended. `VESPER` is a working default name, not a licensed
one, and the assistant's name is user-editable in the app.

Two source files must stay in sync:

| File | Role |
| --- | --- |
| `../src/vesper-mark.tsx` | The in-app React Native SVG component. |
| `build-icons.mjs` | The icon set, generated from the same geometry. |

Regenerate every icon from the repository root:

```sh
node apps/mobile/assets/build-icons.mjs
```

That writes `icon.svg`, `adaptive-icon.svg`, `splash.svg` and the PNGs Expo
consumes: `icon.png` (1024, opaque — the App Store rejects transparency),
`adaptive-icon.png` (Android foreground, mark kept inside the 66% safe zone),
`splash.png`, and `favicon.png`.

Rendering uses `@resvg/resvg-js`.

Two rendering gotchas worth knowing, both hit while building this:

- The mark is drawn with gradient fills. Each `VesperMark` instance derives
  unique gradient ids from `useId()`, because the avatar picker renders all
  three variants at once and duplicate ids would make every `url(#id)`
  reference resolve to the first one in the document.
- In `Mascot`, the mark sits in an absolutely-positioned wrapper on purpose.
  The colour tint behind it is a positioned element, and CSS paints positioned
  elements above in-flow content — a static child is hidden completely.

## Leaving the capybara behind

`capybara.png` was OpenMuse's original mascot (generated with the built-in
image-generation tool on September 16, 2026, prompt recorded below). It is kept
only because the upstream documentation and demo notes still reference it. No
code paths use it any more; `Mascot` in `../src/ui.tsx` renders the Vesper mark.

Historical generation prompt: “An original friendly capybara assistant mascot,
with a broad boxy rounded snout, small round ears, tiny relaxed eyes, a squat
body and short legs. Sitting in a gentle three-quarter view, with warm caramel
and oat tan coloring, a calm expression, a soft clay/plush finish and restrained
detail readable at 48–96 pixels. Entire character centered on a transparent
background. One character, no clothing, props, text, logos or watermark.”

All bundled artwork is included under this repository's MIT license.
