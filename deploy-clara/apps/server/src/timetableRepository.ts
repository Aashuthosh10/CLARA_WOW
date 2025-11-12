import { Collection } from 'mongodb';
import dotenv from 'dotenv';
import { getCollection } from './db/mongoClient.js';

type SemesterClass = {
  time: string;
  subject: string;
  subjectCode?: string;
  courseName?: string;
  classType?: 'Theory' | 'Lab' | 'Free' | 'Busy';
  batch?: string;
  room?: string;
};

type TimetableSchedule = {
  Monday?: SemesterClass[];
  Tuesday?: SemesterClass[];
  Wednesday?: SemesterClass[];
  Thursday?: SemesterClass[];
  Friday?: SemesterClass[];
  Saturday?: SemesterClass[];
};

export type FacultyTimetable = {
  facultyId: string;
  faculty: string;
  designation?: string;
  semester: string;
  schedule: TimetableSchedule;
  workload?: {
    theory: number;
    lab: number;
    totalUnits: number;
  };
  updatedAt: string;
  editHistory?: Array<{
    editedBy: string;
    date: string;
    fieldChanged: string;
  }>;
};

dotenv.config();

export class TimetableRepository {
  private collection: Collection<FacultyTimetable & { compositeKey: string; createdAt: string }> | null = null;
  private memoryStore: Map<string, FacultyTimetable> = new Map();
  private useMemory = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize().catch((error) => {
      console.error('Failed to initialize MongoDB for timetables. Falling back to in-memory store.', error);
      this.useMemory = true;
      this.collection = null;
    });
  }

  private async initialize() {
    const collection = await getCollection<FacultyTimetable & { compositeKey: string; createdAt: string }>('faculty_timetables');
    await collection.createIndex({ compositeKey: 1 }, { unique: true });
    await collection.createIndex({ facultyId: 1, updatedAt: -1 });
    await collection.createIndex({ semester: 1, faculty: 1 });
    this.collection = collection;
    this.useMemory = false;
  }

  private async ensureInitialized() {
    if (this.collection || this.useMemory) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private getKey(facultyId: string, semester: string): string {
    return `${this.normalizeFacultyId(facultyId)}_${semester}`;
  }

  private normalizeFacultyId(facultyId: string): string {
    return facultyId.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  async get(facultyId: string, semester: string): Promise<FacultyTimetable | null> {
    await this.ensureInitialized();

    const normalizedFacultyId = this.normalizeFacultyId(facultyId);
    const key = this.getKey(normalizedFacultyId, semester);
    
    if (this.useMemory || !this.collection) {
      const timetable = this.memoryStore.get(key);
      return timetable ? { ...timetable } : null;
    }

    try {
      const doc = await this.collection.findOne({ compositeKey: key });
      
      if (!doc) return null;
      
      return {
        facultyId: doc.facultyId,
        faculty: doc.faculty,
        designation: doc.designation,
        semester: doc.semester,
        schedule: doc.schedule,
        workload: doc.workload,
        updatedAt: doc.updatedAt,
        editHistory: doc.editHistory || [],
      };
    } catch (error) {
      console.error('Failed to get timetable from MongoDB, falling back to memory store:', error);
      this.collection = null;
      this.useMemory = true;
      const timetable = this.memoryStore.get(key);
      return timetable ? { ...timetable } : null;
    }
  }

  async createOrUpdate(
    timetable: FacultyTimetable,
    editedBy: string,
    fieldChanged?: string
  ): Promise<FacultyTimetable> {
    await this.ensureInitialized();

    const normalizedFacultyId = this.normalizeFacultyId(timetable.facultyId);
    const key = this.getKey(normalizedFacultyId, timetable.semester);
    const now = new Date().toISOString();
    
    // Add edit history entry
    const editHistory = [...(timetable.editHistory || [])];
    if (fieldChanged) {
      editHistory.push({
        editedBy,
        date: now,
        fieldChanged,
      });
    }

    const updatedTimetable: FacultyTimetable = {
      ...timetable,
      facultyId: normalizedFacultyId,
      updatedAt: now,
      editHistory: editHistory.slice(-50), // Keep last 50 edits
    };

    if (this.useMemory || !this.collection) {
      this.memoryStore.set(key, { ...updatedTimetable });
      return updatedTimetable;
    }

    try {
      await this.collection.updateOne(
        { compositeKey: key },
        {
          $set: {
            compositeKey: key,
            facultyId: normalizedFacultyId,
            semester: timetable.semester,
            faculty: timetable.faculty,
            designation: timetable.designation,
            schedule: timetable.schedule,
            workload: timetable.workload,
            updatedAt: now,
            editHistory: editHistory.slice(-50),
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
      return updatedTimetable;
    } catch (error) {
      console.error('Failed to save timetable to MongoDB, falling back to memory store:', error);
      this.collection = null;
      this.useMemory = true;
      this.memoryStore.set(key, { ...updatedTimetable });
      return updatedTimetable;
    }
  }

  async getAllForSemester(semester: string): Promise<FacultyTimetable[]> {
    await this.ensureInitialized();

    if (this.useMemory || !this.collection) {
      return Array.from(this.memoryStore.values())
        .filter(t => t.semester === semester);
    }

    try {
      const docs = await this.collection
        .find({ semester })
        .sort({ faculty: 1 })
        .toArray();
      
      return docs.map(doc => ({
        facultyId: doc.facultyId,
        faculty: doc.faculty,
        designation: doc.designation,
        semester: doc.semester,
        schedule: doc.schedule,
        workload: doc.workload,
        updatedAt: doc.updatedAt,
        editHistory: doc.editHistory || [],
      }));
    } catch (error) {
      console.error('Failed to get timetables from MongoDB, falling back to memory store:', error);
      this.collection = null;
      this.useMemory = true;
      return Array.from(this.memoryStore.values())
        .filter(t => t.semester === semester);
    }
  }

  async close() {
    // Mongo client managed globally; nothing to close here.
  }

  async getLatestForFaculty(facultyId: string): Promise<FacultyTimetable | null> {
    await this.ensureInitialized();

    const normalizedFacultyId = this.normalizeFacultyId(facultyId);

    if (this.useMemory || !this.collection) {
      const candidates = Array.from(this.memoryStore.values())
        .filter((entry) => this.normalizeFacultyId(entry.facultyId) === normalizedFacultyId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return candidates[0] ? { ...candidates[0] } : null;
    }

    try {
      const doc = await this.collection
        .find({ facultyId: normalizedFacultyId })
        .sort({ updatedAt: -1 })
        .limit(1)
        .next();

      if (!doc) {
        return null;
      }

      return {
        facultyId: doc.facultyId,
        faculty: doc.faculty,
        designation: doc.designation,
        semester: doc.semester,
        schedule: doc.schedule,
        workload: doc.workload,
        updatedAt: doc.updatedAt,
        editHistory: doc.editHistory || [],
      };
    } catch (error) {
      console.error('Failed to fetch latest timetable from MongoDB, falling back to memory:', error);
      this.collection = null;
      this.useMemory = true;
      const candidates = Array.from(this.memoryStore.values())
        .filter((entry) => this.normalizeFacultyId(entry.facultyId) === normalizedFacultyId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return candidates[0] ? { ...candidates[0] } : null;
    }
  }
}
