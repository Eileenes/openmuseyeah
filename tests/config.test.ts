import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertApiDeploymentConfig,
  type Config,
  DEFAULT_ALLOWED_ORIGINS,
} from "../apps/server/src/config.ts";

const sampleConfig: Config = {
  mode: "sample",
  port: 8787,
  host: "127.0.0.1",
  publicUrl: "http://localhost:8787",
  dataDir: ".openmuse",
  agentBackend: "sample",
  googleRedirectUri: "http://localhost:8787/api/google/callback",
  allowedOrigins: ["http://localhost:8081"],
};

function liveConfig(intelligenceApiKey?: string): Config {
  return {
    ...sampleConfig,
    mode: "live",
    agentBackend: "model",
    intelligenceApiKey,
  };
}

const missingKeyMessage =
  "Live mode requires CPK_INTELLIGENCE_API_KEY for durable Rich Threads. " +
  "Run `npx copilotkit@latest login` and `npx copilotkit@latest project select`, " +
  "then set the generated server-only key. " +
  "See https://docs.copilotkit.ai/intelligence/connect-your-runtime";

test("live API configuration rejects a missing or blank Intelligence key", () => {
  for (const key of [undefined, "", " \t\n"]) {
    assert.throws(() => assertApiDeploymentConfig(liveConfig(key)), {
      name: "Error",
      message: missingKeyMessage,
    });
  }
});

test("live API configuration accepts a non-empty Intelligence key", () => {
  assert.doesNotThrow(() => assertApiDeploymentConfig(liveConfig("test-project-key-never-sent")));
});

test("sample API configuration remains key-free", () => {
  assert.doesNotThrow(() => assertApiDeploymentConfig(sampleConfig));
});

test("the desktop shell's webview origins are allowed by default", () => {
  // A webview sends its own origin, not the dev server's, so a packaged app is
  // rejected as cross-origin unless these are present out of the box.
  for (const origin of ["tauri://localhost", "http://tauri.localhost"]) {
    assert.ok(DEFAULT_ALLOWED_ORIGINS.includes(origin), `${origin} must be allowed`);
  }
});

test("the default origin list stays a closed allow-list", () => {
  for (const origin of DEFAULT_ALLOWED_ORIGINS) {
    assert.ok(
      origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1") ||
        origin.startsWith("tauri://") ||
        origin.startsWith("http://tauri.localhost") ||
        origin.startsWith("https://tauri.localhost"),
      `${origin} is broader than expected`,
    );
  }
  assert.ok(!DEFAULT_ALLOWED_ORIGINS.includes("*"), "a wildcard would defeat the boundary");
});
