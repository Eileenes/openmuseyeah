import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { type ModelSpecifier, resolveModel as resolveNamedModel } from "@copilotkit/runtime/v2";
import type { ModelSettings } from "../../../packages/voice/src/settings.ts";
import type { Config } from "./config.ts";
import { CredentialStore, ENVIRONMENT_KEYS } from "./credentials.ts";
import type { Store } from "./db.ts";

/** One source of truth for where model configuration lives. */
export const MODEL_SETTINGS_KIND = "model-settings";
export const MODEL_SETTINGS_ID = "config";

type Llm = ModelSettings["llm"];

function build({ provider, model, baseUrl }: Llm, apiKey: string) {
  const baseURL = baseUrl?.trim() || undefined;
  if (provider === "anthropic") return createAnthropic({ apiKey, baseURL })(model);
  if (provider === "google") return createGoogleGenerativeAI({ apiKey, baseURL })(model);
  if (provider === "custom" && !baseURL) return undefined;
  const openai = createOpenAI({ apiKey, baseURL });
  // Compatible endpoints (DeepSeek, OpenRouter, local servers) speak Chat
  // Completions; only OpenAI itself serves the Responses API.
  return baseURL ? openai.chat(model) : openai(model);
}

/**
 * The model chat and delegated work run on, or undefined when nothing usable is
 * configured.
 *
 * A model saved in Assistant settings is built with that provider's saved key
 * and base URL. Without one, a deployment-level MODEL with a provider key in
 * the environment still works as before.
 */
export async function resolveModel(
  db: Store,
  config: Config,
  owner: string,
): Promise<ModelSpecifier | undefined> {
  const [stored, credentials] = await Promise.all([
    db.get<ModelSettings>(owner, MODEL_SETTINGS_KIND, MODEL_SETTINGS_ID),
    new CredentialStore(db, config).resolve(owner),
  ]);
  const llm = stored?.llm;
  const model = llm?.model?.trim();
  if (llm && model) {
    const apiKey = credentials[llm.provider]?.secret;
    return apiKey ? build({ ...llm, model }, apiKey) : undefined;
  }
  const environmentKey = Object.values(ENVIRONMENT_KEYS).some((name) => process.env[name]);
  return config.model && environmentKey ? config.model : undefined;
}

/** Sends the smallest possible request, proving the model and key actually work. */
export async function probeModel(spec: ModelSpecifier) {
  const model = typeof spec === "string" ? resolveNamedModel(spec) : spec;
  if (typeof model === "string" || model.specificationVersion !== "v3")
    throw new Error("This model cannot be tested from settings");
  await model.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "Reply with OK." }] }],
    maxOutputTokens: 16,
    abortSignal: AbortSignal.timeout(30_000),
  });
  return { provider: model.provider, model: model.modelId };
}
