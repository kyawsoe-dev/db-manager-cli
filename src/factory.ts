import { AnyDbConfig, DbAdapter } from "./types";
import { PostgresAdapter } from "./adapters/PostgresAdapter";
import { MySQLAdapter } from "./adapters/MySQLAdapter";
import { MongoAdapter } from "./adapters/MongoAdapter";

export function makeAdapter(cfg: AnyDbConfig): DbAdapter {
  switch (cfg.type) {
    case "postgres":
      return new PostgresAdapter(cfg);
    case "mysql":
      return new MySQLAdapter(cfg);
    case "mongo":
      return new MongoAdapter(cfg);
    default:
      throw new Error(`Unsupported adapter: ${(cfg as any).type}`);
  }
}
