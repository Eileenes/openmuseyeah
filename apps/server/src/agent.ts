import "./config.ts";
import { HttpAgent } from "@ag-ui/client";
import {
  type AgentsFactory,
  type CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotHonoHandler,
  type ModelSpecifier,
} from "@copilotkit/runtime/v2";
import type { Auth } from "./auth.ts";
import type { Config } from "./config.ts";
import { ConversationAgent } from "./engine/conversation.ts";
import type { AgentService } from "./engine/service.ts";
import { resolveModel } from "./model-settings.ts";

/** `model` is the owner's resolved model; it only matters for the model backend. */
export function agentConfigured(config: Config, model?: ModelSpecifier) {
  if (config.agentBackend === "sample") return true;
  return config.agentBackend === "agui" ? Boolean(config.agentUrl) : Boolean(model);
}
export function makeRuntime(
  config: Config,
  service: AgentService,
  auth: Auth,
  intelligence?: CopilotKitIntelligence,
) {
  const agents: AgentsFactory = async ({ request }) => {
    const owner = await auth.owner(request.headers.get("authorization") ?? undefined);
    // Resolved per request so a model saved in Assistant settings takes effect
    // on the next turn without restarting the server.
    const model = await resolveModel(service.db, config, owner);
    return {
      default:
        config.agentBackend === "agui"
          ? new HttpAgent({
              url: config.agentUrl ?? "http://127.0.0.1:1/unconfigured",
              headers: config.agentToken ? { Authorization: `Bearer ${config.agentToken}` } : {},
            })
          : new ConversationAgent(config, service, owner, model),
    };
  };
  const runtime = intelligence
    ? new CopilotRuntime({
        agents,
        intelligence,
        identifyUser: async (request) => ({
          id: await auth.owner(request.headers.get("authorization") ?? undefined),
          name: "Vesper user",
        }),
        generateThreadNames: false,
      })
    : new CopilotRuntime({ agents });
  return createCopilotHonoHandler({ runtime, basePath: "/api/copilotkit" });
}
