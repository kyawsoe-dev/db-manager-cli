import { MongoClient, Db } from 'mongodb';
import { DbAdapter, MongoConfig } from '../types';

export class MongoAdapter implements DbAdapter {
  private client!: MongoClient;
  private db!: Db;
  constructor(private cfg: MongoConfig) {}

  kind() { return 'mongo' as const; }

  async connect() {
    this.client = new MongoClient(this.cfg.uri);
    await this.client.connect();
    this.db = this.client.db(this.cfg.dbName);
    await this.db.command({ ping: 1 });
  }

  async find(collection: string, filter: any = {}, projection?: any, limit?: number) {
    let cursor = this.db.collection(collection).find(filter);
    if (projection) cursor = cursor.project(projection);
    if (limit) cursor = cursor.limit(limit);
    return await cursor.toArray();
  }

  async listCollections(): Promise<string[]> {
    const cols = await this.db.listCollections().toArray();
    return cols.map(c => c.name);
  }

  async close() { await this.client.close(); }
}
