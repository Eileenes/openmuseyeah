#!/bin/sh
# One command from source to a signed Vesper.app and .dmg.
#
#   pnpm desktop:build
#
# Signs with the first "Developer ID Application" identity in the keychain, or
# APPLE_SIGNING_IDENTITY when set. Notarizes only when APPLE_ID, APPLE_PASSWORD
# (an app-specific password) and APPLE_TEAM_ID are all set; otherwise the build
# is signed but not notarized.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)

identity=${APPLE_SIGNING_IDENTITY:-$(security find-identity -v -p codesigning |
  sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -n 1)}
if [ -z "$identity" ]; then
  echo "No Developer ID Application identity found; set APPLE_SIGNING_IDENTITY." >&2
  exit 1
fi
export APPLE_SIGNING_IDENTITY="$identity"

echo "exporting the interface"
(cd "$root/apps/mobile" && rm -rf dist/web && pnpm build:web)

sh "$here/build-sidecar.sh"

# Node needs JIT under the hardened runtime. Signed before bundling so the
# outer app signature seals this one instead of replacing it.
echo "signing the bundled node runtime"
codesign --force --timestamp --options runtime \
  --entitlements "$here/node.entitlements" \
  --sign "$identity" "$here/src-tauri/sidecar/node"

if [ -z "${APPLE_ID:-}" ] || [ -z "${APPLE_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; then
  echo "APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID not all set: skipping notarization"
  unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID
fi

echo "building the app"
(cd "$here" && "$root/node_modules/.bin/tauri" build)

bundle="$here/src-tauri/target/release/bundle"
codesign --verify --deep --strict "$bundle/macos/Vesper.app"
echo "done:"
ls -1 "$bundle/macos/Vesper.app" "$bundle"/dmg/*.dmg
