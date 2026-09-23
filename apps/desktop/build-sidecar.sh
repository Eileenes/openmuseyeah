#!/bin/sh
# Assembles the local API the desktop shell starts alongside itself.
#
#   sh apps/desktop/build-sidecar.sh
#
# Produces apps/desktop/sidecar/ containing:
#   node         a copy of the Node runtime
#   server.js    the whole API bundled into one file
#   pglite.wasm  PGlite's engine   } loaded from the *working directory* at
#   pglite.data  PGlite's image    } runtime, so the shell must spawn with
#                                    cwd set to this directory
#
# Bundling beats copying node_modules by a wide margin here: 22 MB of files
# against roughly 1 GB of tree.
#
# A single-file binary was tried first and does not work: `bun build --compile`
# produces a working executable, but PGlite reads its wasm and data files from
# disk and a compiled binary has no such files, so it dies with
# `ENOENT: /$bunfs/root/pglite.data`.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
# Inside src-tauri so the resource path in tauri.conf.json stays unambiguous.
out="$here/src-tauri/sidecar"

echo "building the server"
(cd "$root" && pnpm build:server)

echo "bundling"
rm -rf "$out"
mkdir -p "$out"
bun build "$root/dist/apps/server/src/index.js" --outfile "$out/server.js" --target node

echo "copying the PGlite runtime files"
dist=$(dirname "$(find "$root/node_modules/.pnpm" -name pglite.data -print -quit)")
cp "$dist/pglite.wasm" "$out/pglite.wasm"
cp "$dist/pglite.data" "$out/pglite.data"

echo "copying the node runtime"
cp "$(node -e 'console.log(require("node:fs").realpathSync(process.execPath))')" "$out/node"
chmod +x "$out/node"

echo "done: $out"
du -sh "$out"
