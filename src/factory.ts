import { AnyDbConfig, DbAdapter } from "./types";
import { PostgresAdapter, MySQLAdapter, MongoAdapter } from "./adapters";

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
