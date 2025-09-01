import fs from "fs";
import path from "path";
import YAML from "yaml";
import { z } from "zod";
import dotenv from "dotenv";
import { AnyDbConfig } from "./types";

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

export function loadConfig(): Record<string, AnyDbConfig> {
  const locations = [
    path.resolve(process.cwd(), ".dbman.yaml"),
    path.resolve(process.cwd(), ".dbman.yml"),
    process.env.HOME ? path.join(process.env.HOME, ".dbman.yaml") : "",
  ].filter(Boolean);

  let doc: any = null;
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      doc = YAML.parse(fs.readFileSync(loc, "utf8"));
      break;
    }
  }

  function parseDbType(t?: string): "postgres" | "mysql" | "mongo" {
    if (t === "mysql" || t === "mongo") return t;
    return "postgres"; // default
  }

  function makeDefaultCfg(): AnyDbConfig {
    const type = process.env.DBMAN_DEFAULT_TYPE;
    if (type === "mysql") {
      return {
        name: "default",
        type: "mysql",
        host: process.env.DBMAN_DEFAULT_HOST || "localhost",
        port: Number(process.env.DBMAN_DEFAULT_PORT || 3306),
        user: process.env.DBMAN_DEFAULT_USER || "root",
        password: process.env.DBMAN_DEFAULT_PASSWORD || "root",
        database: process.env.DBMAN_DEFAULT_NAME || "appdb",
      };
    }
    if (type === "mongo") {
      return {
        name: "default",
        type: "mongo",
        uri: process.env.DBMAN_DEFAULT_URI || "mongodb://localhost:27017",
        dbName: process.env.DBMAN_DEFAULT_NAME || "appdb",
      };
    }
    // default to postgres
    return {
      name: "default",
      type: "postgres",
      host: process.env.DBMAN_DEFAULT_HOST || "localhost",
      port: Number(process.env.DBMAN_DEFAULT_PORT || 5432),
      user: process.env.DBMAN_DEFAULT_USER || "postgres",
      password: process.env.DBMAN_DEFAULT_PASSWORD || "postgres",
      database: process.env.DBMAN_DEFAULT_NAME || "appdb",
    };
  }

  const defaultCfg = makeDefaultCfg();

  if (!doc) doc = { connections: { default: defaultCfg } };
  else doc.connections.default = { ...defaultCfg, ...doc.connections.default };

  const parsed = schema.parse(doc);
  const result: Record<string, AnyDbConfig> = {};
  for (const [name, raw] of Object.entries(parsed.connections)) {
    const cfg = resolveEnvStrings(raw) as any;
    const type = cfg.type;
    if (!["postgres", "mysql", "mongo"].includes(type)) {
      throw new Error(`Unsupported "type" for connection "${name}": ${type}`);
    }
    result[name] = { name, ...cfg } as AnyDbConfig;
  }

  return result;
}
