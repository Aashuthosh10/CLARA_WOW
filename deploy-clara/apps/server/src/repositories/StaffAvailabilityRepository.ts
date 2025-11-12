/**
 * Staff Availability Repository
 * Persists data in MongoDB with in-memory fallback.
 */
import { Collection } from 'mongodb';
import { StaffAvailability } from '../models/Call.js';
import { getCollection } from '../db/mongoClient.js';

type StaffAvailabilityDocument = {
  userId: string;
  orgId: string;
  status: 'available' | 'busy' | 'away' | 'offline';
  updatedAt: number;
  skills?: string[];
};

export class StaffAvailabilityRepository {
  private collection: Collection<StaffAvailabilityDocument> | null = null;
  private memoryStore: Map<string, StaffAvailability> = new Map();
  private useMemory = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize().catch((error) => {
      console.error('Failed to initialize MongoDB for staff availability. Falling back to in-memory store.', error);
      this.useMemory = true;
      this.collection = null;
    });
  }

  private async initialize() {
    try {
      const collection = await getCollection<StaffAvailabilityDocument>('staff_availability');
      await collection.createIndex({ userId: 1, orgId: 1 }, { unique: true });
      await collection.createIndex({ orgId: 1, status: 1, updatedAt: -1 });
      this.collection = collection;
      this.useMemory = false;
    } catch (error) {
      throw error;
    }
  }

  private async ensureInitialized() {
    if (this.collection || this.useMemory) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private getMemoryKey(userId: string, orgId: string) {
    return `${userId}:${orgId}`;
  }

  async setAvailability(availability: StaffAvailability): Promise<void> {
    await this.ensureInitialized();

    if (this.useMemory || !this.collection) {
      const key = this.getMemoryKey(availability.userId, availability.orgId);
      this.memoryStore.set(key, { ...availability });
      return;
    }

    try {
      await this.collection.updateOne(
        { userId: availability.userId, orgId: availability.orgId },
        {
          $set: {
            status: availability.status,
            updatedAt: availability.updatedAt,
            skills: availability.skills,
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Failed to set availability in MongoDB, falling back to memory store:', error);
      const key = this.getMemoryKey(availability.userId, availability.orgId);
      this.memoryStore.set(key, { ...availability });
      this.useMemory = true;
      this.collection = null;
    }
  }

  /**
   * Find available staff for call routing
   * Returns staff sorted by most recently updated.
   */
  async findAvailableStaff(orgId: string, skills?: string[]): Promise<StaffAvailability[]> {
    await this.ensureInitialized();

    if (this.useMemory || !this.collection) {
      return Array.from(this.memoryStore.values())
        .filter((availability) => availability.orgId === orgId && availability.status === 'available')
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    try {
      const query: Record<string, any> = { orgId, status: 'available' };
      if (skills && skills.length > 0) {
        query.skills = { $all: skills };
      }

      const docs = await this.collection
        .find(query)
        .sort({ updatedAt: -1 })
        .toArray();

      return docs.map((doc) => ({
        userId: doc.userId,
        orgId: doc.orgId,
        status: doc.status,
        updatedAt: doc.updatedAt,
        skills: doc.skills,
      }));
    } catch (error) {
      console.error('Failed to query availability from MongoDB, falling back to memory store:', error);
      this.useMemory = true;
      this.collection = null;
      return Array.from(this.memoryStore.values())
        .filter((availability) => availability.orgId === orgId && availability.status === 'available')
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }
  }

  async getAvailability(userId: string, orgId: string): Promise<StaffAvailability | null> {
    await this.ensureInitialized();

    if (this.useMemory || !this.collection) {
      const key = this.getMemoryKey(userId, orgId);
      return this.memoryStore.get(key) || null;
    }

    try {
      const doc = await this.collection.findOne({ userId, orgId });
      if (!doc) {
        return null;
      }
      return {
        userId: doc.userId,
        orgId: doc.orgId,
        status: doc.status,
        updatedAt: doc.updatedAt,
        skills: doc.skills,
      };
    } catch (error) {
      console.error('Failed to read availability from MongoDB, falling back to memory store:', error);
      const key = this.getMemoryKey(userId, orgId);
      return this.memoryStore.get(key) || null;
    }
  }

  async close() {
    // Mongo client is managed globally; nothing to close per-repository.
  }
}

