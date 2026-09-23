import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Config } from "../apps/server/src/config.ts";
import { createStore } from "../apps/server/src/db.ts";
import { resolveModel } from "../apps/server/src/model-settings.ts";
import { VoiceService } from "../apps/server/src/voice.ts";

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: "/unused",
    agentBackend: "sample",
    googleRedirectUri: "http://localhost/callback",
    allowedOrigins: [],
    ...overrides,
  };
}

test("with nothing saved the agent keeps the deployment default model", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-model-settings-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    assert.equal(
      await resolveModel(db, testConfig({ model: "openai/gpt-4o" }), "owner"),
      "openai/gpt-4o",
    );
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a model saved in Assistant settings overrides the deployment default", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-model-settings-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const config = testConfig({ model: "openai/gpt-4o" });
    const voice = new VoiceService(db, config);
    // This is the exact write the settings screen performs.
    await voice.saveSettings("owner", { llm: { provider: "anthropic", model: "claude-sonnet-4" } });
    assert.equal(await resolveModel(db, config, "owner"), "anthropic/claude-sonnet-4");
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a blank model id falls back instead of producing a dangling provider", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-model-settings-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const config = testConfig({ model: "openai/gpt-4o" });
    const voice = new VoiceService(db, config);
    await voice.saveSettings("owner", { llm: { model: "   " } });
    assert.equal(await resolveModel(db, config, "owner"), "openai/gpt-4o");
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("one owner's model choice does not leak into another owner's runs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-model-settings-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    const config = testConfig({ model: "openai/gpt-4o" });
    const voice = new VoiceService(db, config);
    await voice.saveSettings("first", { llm: { provider: "google", model: "gemini-pro" } });
    assert.equal(await resolveModel(db, config, "first"), "google/gemini-pro");
    assert.equal(await resolveModel(db, config, "second"), "openai/gpt-4o");
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
