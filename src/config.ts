import fs from "fs";
import path from "path";
import YAML from "yaml";
import { z } from "zod";
import dotenv from "dotenv";
import { AnyDbConfig } from "./types";
import prompts from "prompts";

dotenv.config();

const schema = z.object({
  connections: z.record(z.string(), z.unknown()),
});

function resolveEnvStrings<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as any)) {
      if (typeof v === "string") {
        (obj as any)[k] = v.replace(
          /\$\{([A-Z0-9_]+)\}/g,
          (_, name) => process.env[name] ?? ""
        );
      } else if (v && typeof v === "object") {
        (obj as any)[k] = resolveEnvStrings(v);
      }
    }
  }
  return obj;
}

function getConfigFilePath(): string {
  return (
    process.env.DBMAN_CONFIG_PATH ||
    path.join(process.env.HOME || ".", ".dbman.yaml")
  );
}

export function loadConfig(): Record<string, AnyDbConfig> {
  const locations = [
    path.resolve(process.cwd(), ".dbman.yaml"),
    getConfigFilePath(),
  ].filter(Boolean);

  let mergedDoc: any = { connections: {} };

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      const parsed = YAML.parse(fs.readFileSync(loc, "utf8")) || {
        connections: {},
      };
      if (parsed?.connections) {
        mergedDoc.connections = {
          ...mergedDoc.connections,
          ...parsed.connections,
        };
      }
    }
  }

  const parsed = schema.parse(mergedDoc);
  const result: Record<string, AnyDbConfig> = {};
  for (const [name, raw] of Object.entries(parsed.connections)) {
    const cfg = resolveEnvStrings(raw || {}) as Record<string, any>;

    let type: "postgres" | "mysql" | "mongo";

    if (cfg.type === 0 || cfg.type === "postgres") type = "postgres";
    else if (cfg.type === 1 || cfg.type === "mysql") type = "mysql";
    else if (cfg.type === 2 || cfg.type === "mongo") type = "mongo";

    result[name] = {
      name,
      ...cfg,
      type,
    } as AnyDbConfig;
  }

  return result;
}

export async function promptForMissingCredentials(cfg: AnyDbConfig) {
  if (cfg.type === "mongo") return cfg;
  if (!cfg.user || !cfg.password || !cfg.database) {
    const response = await prompts([
      {
        type: "text",
        name: "user",
        message: `DB user for ${cfg.name}:`,
        initial: cfg.user || "",
      },
      {
        type: "password",
        name: "password",
        message: `DB password for ${cfg.name}:`,
        initial: cfg.password || "",
      },
      {
        type: "text",
        name: "database",
        message: `DB name for ${cfg.name}:`,
        initial: cfg.database || "",
      },
    ]);
    cfg = { ...cfg, ...response };
  }
  return cfg;
}

export function saveConfig(name: string, cfg: AnyDbConfig) {
  const configFile = getConfigFilePath();

  let doc: any = { connections: {} };
  if (fs.existsSync(configFile)) {
    doc = YAML.parse(fs.readFileSync(configFile, "utf8")) || {
      connections: {},
    };
  }

  doc.connections[name] = { ...cfg, name };

  fs.writeFileSync(configFile, YAML.stringify(doc), "utf8");
}
