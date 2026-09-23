# Vesper artwork

## The assistant

A chibi panda, drawn from primitives as vector art. One definition serves every
surface and size — the in-app `VesperMark` component and the exported icon set
share the same geometry.

It is an original cartoon animal: a round head, two ears, tilted eye patches, a
small nose and a soft smile. It contains **no third-party character, logo or
other protected design**, and no resemblance to any film or comic property is
intended. `VESPER` is a working default name, not a licensed one, and the
assistant's name is user-editable in the app.

The face is built from a few large shapes on purpose. At the 42 px default the
eyes are only a couple of pixels across, so the silhouette and the eye
highlights carry the character rather than fine detail — that is also why the
first draft, which had smaller and more widely spaced features, was replaced.

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
`adaptive-icon.png` (Android foreground, artwork kept inside the safe zone),
`splash.png`, and `favicon.png`.

Rendering uses `@resvg/resvg-js`.

The desktop shell's icons are generated from the same PNG:

```sh
cd apps/desktop && ../../node_modules/.bin/tauri icon ../mobile/assets/icon.png
```

## Rendering notes

- In `Mascot`, the mark sits in an absolutely-positioned wrapper on purpose.
  The colour tint behind it is a positioned element, and CSS paints positioned
  elements above in-flow content — a static child is hidden completely.

All bundled artwork is included under this repository's MIT license.
