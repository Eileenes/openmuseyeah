import assert from "node:assert/strict";
import { test } from "node:test";
import type { Config } from "../apps/server/src/config.ts";
import { availableCapabilities } from "../apps/server/src/config.ts";

const base: Config = {
  mode: "live",
  port: 8787,
  host: "127.0.0.1",
  publicUrl: "http://localhost:8787",
  dataDir: "/unused",
  agentBackend: "model",
  googleRedirectUri: "http://localhost/callback",
  allowedOrigins: [],
};

test("tools for unconfigured services are not offered to the model", () => {
  assert.deepEqual(availableCapabilities(base), { mail: false, browser: false, computer: false });
});

test("each tool group appears once its service is configured", () => {
  assert.deepEqual(
    availableCapabilities({
      ...base,
      googleClientId: "id",
      googleClientSecret: "secret",
      workerUrl: "http://127.0.0.1:8790",
      workerToken: "token",
      computerEnabled: true,
    }),
    { mail: true, browser: true, computer: true },
  );
  assert.equal(availableCapabilities({ ...base, mode: "sample" }).mail, true);
});
