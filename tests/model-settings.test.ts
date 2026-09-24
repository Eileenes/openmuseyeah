import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Config } from "../apps/server/src/config.ts";
import { ENVIRONMENT_KEYS } from "../apps/server/src/credentials.ts";
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

async function withStore(
  run: (db: Awaited<ReturnType<typeof createStore>>, dir: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "openmuse-model-settings-"));
  try {
    const db = await createStore({ dataDir: join(directory, "postgres") });
    await run(db, directory);
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function withoutEnvironmentKeys() {
  const saved = Object.fromEntries(Object.values(ENVIRONMENT_KEYS).map((n) => [n, process.env[n]]));
  for (const name of Object.values(ENVIRONMENT_KEYS)) delete process.env[name];
  return () => {
    for (const [name, value] of Object.entries(saved))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  };
}

test("nothing is configured until a model and its key exist", async () => {
  const restore = withoutEnvironmentKeys();
  try {
    await withStore(async (db, dir) => {
      const config = testConfig({ dataDir: dir, model: "openai/gpt-4o" });
      assert.equal(await resolveModel(db, config, "owner"), undefined);
      const voice = new VoiceService(db, config);
      await voice.saveSettings("owner", {
        llm: { provider: "anthropic", model: "claude-sonnet-4" },
      });
      assert.equal(await resolveModel(db, config, "owner"), undefined);
    });
  } finally {
    restore();
  }
});

test("a saved model is built with its provider's saved key and base URL", async () => {
  const restore = withoutEnvironmentKeys();
  try {
    await withStore(async (db, dir) => {
      const config = testConfig({ dataDir: dir });
      const voice = new VoiceService(db, config);
      await voice.saveSettings("owner", {
        llm: { provider: "openai", model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" },
        keys: { openai: "sk-test-1234567890" },
      });
      const model = await resolveModel(db, config, "owner");
      assert.ok(model && typeof model !== "string");
      assert.equal(model.modelId, "deepseek-chat");
      assert.equal(model.provider, "openai.chat");
      // The key belongs to one provider; another provider's model stays unconfigured.
      await voice.saveSettings("owner", { llm: { provider: "google", model: "gemini-2.5-flash" } });
      assert.equal(await resolveModel(db, config, "owner"), undefined);
    });
  } finally {
    restore();
  }
});

test("one owner's model and key do not leak into another owner's runs", async () => {
  const restore = withoutEnvironmentKeys();
  try {
    await withStore(async (db, dir) => {
      const config = testConfig({ dataDir: dir });
      const voice = new VoiceService(db, config);
      await voice.saveSettings("first", {
        llm: { provider: "anthropic", model: "claude-sonnet-4" },
        keys: { anthropic: "sk-ant-1234567890" },
      });
      assert.ok(await resolveModel(db, config, "first"));
      assert.equal(await resolveModel(db, config, "second"), undefined);
    });
  } finally {
    restore();
  }
});

test("a deployment MODEL still works with a key in the environment", async () => {
  const restore = withoutEnvironmentKeys();
  process.env.OPENAI_API_KEY = "sk-environment-key";
  try {
    await withStore(async (db, dir) => {
      const config = testConfig({ dataDir: dir, model: "openai/gpt-4o" });
      assert.equal(await resolveModel(db, config, "owner"), "openai/gpt-4o");
    });
  } finally {
    restore();
  }
});

test("a custom provider is an OpenAI-compatible endpoint with its own key", async () => {
  const restore = withoutEnvironmentKeys();
  try {
    await withStore(async (db, dir) => {
      const config = testConfig({ dataDir: dir });
      const voice = new VoiceService(db, config);
      await voice.saveSettings("owner", {
        llm: { provider: "custom", model: "qwen-plus", baseUrl: "https://example.com/v1" },
        keys: { custom: "sk-custom-1234567890" },
      });
      const model = await resolveModel(db, config, "owner");
      assert.ok(model && typeof model !== "string");
      assert.equal(model.modelId, "qwen-plus");
      assert.equal(model.provider, "openai.chat");
      const view = await voice.publicSettings("owner");
      assert.equal(view.credentials.custom?.stored, true);
      assert.equal(view.credentials.openai?.stored, false);
    });
  } finally {
    restore();
  }
});

test("a custom provider needs a base URL", async () => {
  await withStore(async (db, dir) => {
    const voice = new VoiceService(db, testConfig({ dataDir: dir }));
    await assert.rejects(
      voice.saveSettings("owner", { llm: { provider: "custom", model: "qwen-plus" } }),
      /Base URL/,
    );
  });
});
