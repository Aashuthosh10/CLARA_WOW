import { Collection, Db, MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_URI = 'mongodb://localhost:27017/clara_db';

let cachedClient: MongoClient | null = null;
let connectPromise: Promise<MongoClient> | null = null;

/**
 * Returns a shared MongoDB client instance.
 * Reuses existing connection when available.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  connectPromise = MongoClient.connect(uri, {
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
  })
    .then((client) => {
      cachedClient = client;
      return client;
    })
    .catch((error) => {
      connectPromise = null;
      throw error;
    });

  return connectPromise;
}

/**
 * Returns the default application database.
 */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB_NAME || 'clara_db';
  return client.db(dbName);
}

/**
 * Convenience helper to access collections with proper typing.
 */
export async function getCollection<TSchema extends Record<string, unknown>>(name: string): Promise<Collection<TSchema>> {
  const db = await getDb();
  return db.collection<TSchema>(name);
}


