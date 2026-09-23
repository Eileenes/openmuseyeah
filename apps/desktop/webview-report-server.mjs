/**
 * Receives reports from inside the desktop webview.
 *
 * The packaged window cannot be screenshotted or given devtools in every
 * environment, so when the interface misbehaves the fastest way to see what it
 * is doing is to have it tell you. Run this, start the shell with
 * VESPER_DEBUG_BEACON=1 and CFFIXED_USER_HOME pointed at a writable directory,
 * then read the log.
 *
 *   node apps/desktop/webview-report-server.mjs /tmp/reports.log
 *
 * It logs the Origin header too, which is how the packaged window's opaque
 * "null" origin was identified.
 */

import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const out = process.argv[2] ?? "/tmp/reports.log";
writeFileSync(out, "");
createServer((request, response) => {
  appendFileSync(
    out,
    `ORIGIN=${JSON.stringify(request.headers.origin ?? null)} REFERER=${JSON.stringify(request.headers.referer ?? null)} METHOD=${request.method} URL=${decodeURIComponent(request.url ?? "/").slice(0, 120)}\n`,
  );
  response.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain" });
  response.end("ok");
}).listen(8901, "127.0.0.1", () => console.log("reporting on 8901"));
