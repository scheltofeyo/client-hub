import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

// Cache connection across hot reloads in dev
const globalWithMongoose = global as typeof globalThis & {
  mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}

const cached = globalWithMongoose.mongoose;

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // Each Netlify Function instance opens its own pool, so we keep the
      // per-instance pool small to avoid Atlas connection-limit pressure
      // (M0/M10 caps + many warm Function instances).
      maxPoolSize: 10,
      // One warm connection so the first request after a cold start doesn't
      // pay full TCP+TLS handshake.
      minPoolSize: 1,
      // Fail fast on Atlas blips instead of letting a page render hang for
      // the 30-second default. Combined with withRetry() on the hottest
      // reads, this turns transient flaps into a sub-second retry rather
      // than a 30s spinner that ends in a 500.
      serverSelectionTimeoutMS: 5000,
      // Long-running aggregations (results-tab analyses) still need headroom.
      socketTimeoutMS: 45000,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
