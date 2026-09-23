import { defaultModelSettings, type ModelSettings } from "../../../packages/voice/src/settings.ts";
import type { Config } from "./config.ts";
import type { Store } from "./db.ts";

/** One source of truth for where model configuration lives. */
export const MODEL_SETTINGS_KIND = "model-settings";
export const MODEL_SETTINGS_ID = "config";

/**
 * The effective `provider/model` for chat and delegated work: whatever was saved
 * in Assistant settings when a model is named, otherwise the deployment default.
 *
 * Only the model id is chosen here. Provider credentials still come from the
 * server environment, which keeps a single-owner server's keys off every client
 * and stops one owner's saved key from leaking into another owner's run.
 */
export async function resolveModel(
  db: Store,
  config: Config,
  owner: string,
): Promise<string | undefined> {
  const stored = await db.get<ModelSettings>(owner, MODEL_SETTINGS_KIND, MODEL_SETTINGS_ID);
  const model = stored?.llm?.model?.trim();
  if (!model) return config.model;
  const provider = stored?.llm?.provider ?? defaultModelSettings().llm.provider;
  return `${provider}/${model}`;
}
