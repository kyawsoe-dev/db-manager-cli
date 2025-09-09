import { MongoClient, Db } from "mongodb";
import { DbAdapter, MongoConfig } from "../types";

export class MongoAdapter implements DbAdapter {
  private client!: MongoClient;
  private db!: Db;

  constructor(private cfg: MongoConfig) {}

  kind() {
    return "mongo" as const;
  }

  async connect() {
    this.client = new MongoClient(this.cfg.uri);
    await this.client.connect();
    this.db = this.client.db(this.cfg.dbName);
    await this.db.command({ ping: 1 });
  }

  async insert(collection: string, doc: any) {
    return await this.db.collection(collection).insertOne(doc);
  }

  async find(
    collection: string,
    filter: any = {},
    projection?: any,
    limit?: number
  ) {
    let cursor = this.db.collection(collection).find(filter);
    if (projection) cursor = cursor.project(projection);
    if (limit) cursor = cursor.limit(limit);
    return await cursor.toArray();
  }

  async update(collection: string, filter: any, update: any) {
    return await this.db
      .collection(collection)
      .updateMany(filter, { $set: update });
  }

  async delete(collection: string, filter: any) {
    return await this.db.collection(collection).deleteMany(filter);
  }

  async dropCollection(collection: string) {
    return await this.db.collection(collection).drop();
  }

  async listCollections(): Promise<string[]> {
    const cols = await this.db.listCollections().toArray();
    return cols.map((c) => c.name);
  }

  async close() {
    await this.client.close();
  }
}
