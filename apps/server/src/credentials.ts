import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decryptSecret, encryptSecret } from "../../../packages/integrations/src/vault.ts";
import type { Config } from "./config.ts";
import type { Store } from "./db.ts";

const CREDENTIAL_KIND = "model-credentials";

/** Server environment keys, kept as a fallback for deployments configured that way. */
export const ENVIRONMENT_KEYS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
};

export interface Credential {
  secret: string;
  fromEnvironment: boolean;
}

interface CredentialRecord {
  id: string;
  encrypted: string;
}

const keyPromises = new Map<string, Promise<string>>();

/**
 * Deployments without TOKEN_ENCRYPTION_KEY get a private key generated inside
 * the data directory on first use. Cached per directory so every service in the
 * process agrees on one key.
 */
function encryptionKey(config: Config): Promise<string> {
  if (config.encryptionKey) return Promise.resolve(config.encryptionKey);
  const path = join(config.dataDir, "credential-key");
  let pending = keyPromises.get(path);
  if (!pending) {
    pending = (async () => {
      await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
      try {
        return (await readFile(path, "utf8")).trim();
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        const key = randomBytes(32).toString("base64");
        await writeFile(path, key, { mode: 0o600, flag: "wx" });
        return key;
      }
    })();
    keyPromises.set(path, pending);
  }
  return pending;
}

/** Provider API keys, encrypted at rest and never returned to a client. */
export class CredentialStore {
  constructor(
    private readonly db: Store,
    private readonly config: Config,
  ) {}

  async save(owner: string, keys: Record<string, string>) {
    const key = await encryptionKey(this.config);
    for (const [provider, secret] of Object.entries(keys))
      await this.db.put<CredentialRecord>(owner, CREDENTIAL_KIND, {
        id: provider,
        encrypted: encryptSecret(secret, key),
      });
  }

  async resolve(owner: string): Promise<Record<string, Credential>> {
    const rows = await this.db.list<CredentialRecord>(owner, CREDENTIAL_KIND);
    const found: Record<string, Credential> = {};
    // Only touch the keystore when something is stored, so a workspace that
    // never saved a key performs no filesystem work at all.
    if (rows.length > 0) {
      const key = await encryptionKey(this.config);
      for (const row of rows) {
        try {
          found[row.id] = { secret: decryptSecret(row.encrypted, key), fromEnvironment: false };
        } catch {
          // A credential written under a different key is unusable; treat it as absent.
        }
      }
    }
    for (const [provider, variable] of Object.entries(ENVIRONMENT_KEYS)) {
      const secret = process.env[variable];
      if (!found[provider] && secret) found[provider] = { secret, fromEnvironment: true };
    }
    return found;
  }
}
