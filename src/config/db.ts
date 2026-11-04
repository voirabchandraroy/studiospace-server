import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.DB_NAME || "studiospace";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;
  if (!uri) throw new Error("MONGODB_URI is missing in .env");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log("MongoDB connected ->", dbName);
  return db;
}

export function getDB(): Db {
  if (!db) throw new Error("Database not initialised. Call connectDB() first.");
  return db;
}

export const collections = {
  users: () => getDB().collection("users"),
  studios: () => getDB().collection("studios"),
  bookings: () => getDB().collection("bookings"),
  wishlist: () => getDB().collection("wishlist"),
};
