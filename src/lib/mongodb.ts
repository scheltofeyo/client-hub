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
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        // Each Netlify Function instance opens its own pool, so we keep the
        // per-instance pool small to avoid Atlas connection-limit pressure
        // (M0/M10 caps + many warm Function instances).
        maxPoolSize: 10,
        // One warm connection so the first request after a cold start doesn't
        // pay full TCP+TLS handshake.
        minPoolSize: 1,
        // Cap the initial TCP+TLS handshake. Without this the driver default
        // is 30s, which is what a cold Atlas cluster turned into: a 30s+
        // blank-page stall on the first request of the day.
        connectTimeoutMS: 10000,
        // Fail fast on Atlas blips instead of letting a page render hang for
        // the 30-second default. Combined with withRetry() on the hottest
        // reads, this turns transient flaps into a sub-second retry rather
        // than a 30s spinner that ends in a 500.
        serverSelectionTimeoutMS: 5000,
        // Long-running aggregations (results-tab analyses) still need headroom.
        socketTimeoutMS: 45000,
        // Index builds are handled at deploy time (npm run seed calls
        // syncIndexes); letting every cold start re-arm createIndexes for all
        // ~35 models just adds command load on a cold connection.
        autoIndex: process.env.NODE_ENV !== "production",
      })
      .catch((err) => {
        // Un-cache the rejected promise: otherwise one failed cold connect is
        // sticky for the life of this warm instance and every later request
        // re-awaits the same rejection instead of retrying.
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
