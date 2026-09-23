# Vesper desktop

A Tauri v2 shell around the same React Native Web bundle the browser build
serves, so the desktop app has no separate interface to keep in step.

## Build

The shell loads an exported bundle rather than a dev server, so export it first:

```sh
# from the repository root
EXPO_PUBLIC_API_URL=http://localhost:8788 pnpm --dir apps/mobile exec expo export --platform web --output-dir dist/web
```

Then compile the shell (needs a Rust toolchain and the platform's linkers):

```sh
cd apps/desktop
../../node_modules/.bin/tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`: `.app` and `.dmg` on macOS,
`.msi` on Windows, `.deb` and `.AppImage` on Linux.

For development against the running dev server:

```sh
../../node_modules/.bin/tauri dev
```

## Icons

`src-tauri/icons/` is generated from the shared mark so every platform ships the
same artwork:

```sh
../../node_modules/.bin/tauri icon ../mobile/assets/icon.png
```

## Still to come

- **Local server sidecar.** Today the shell connects to an API that must already
  be running. Bundling the API (and optionally the browser worker) so a single
  double-click starts everything is the next step.
- **Runtime API address.** `apps/mobile/src/api.ts` resolves `API_URL` once at
  module load from a build-time value. Choosing between a local and a remote
  server at runtime needs that to become a resolved setting.
