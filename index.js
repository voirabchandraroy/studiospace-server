/**
 * StudioSpace — Peer-to-Peer Creative Workspace & Production Studio Sharing
 * Single-file Express + MongoDB API (Programming Hero B14 server pattern).
 */
import express from 'express'
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'

const app = express()
const PORT = process.env.PORT || 5000

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
    process.exit(1);
  }
}

app.use(cors({
  origin: (process.env.CLIENT_URL || 'http://localhost:3000').split(','),
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

const mongoClient = await connectToMongoDB()
const db = mongoClient.db(process.env.DB_NAME || "studiospace")
const usersCollection = db.collection("users")
const studiosCollection = db.collection("studios")
const bookingsCollection = db.collection("bookings")
const wishlistCollection = db.collection("wishlist")

/* ============ JWT in an HTTPOnly cookie — Challenge 1 ============ */
const COOKIE_NAME = 'token'

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

// Guards every server-side mutation. Missing/invalid/expired => 401.
const verifyToken = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized access — please log in first.' })
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized access — session expired.' })
  }
}

/* ============================== helpers ============================== */
// "14:30" -> 870
const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

// Challenge 2: two ranges collide when aStart < bEnd && aEnd > bStart
const hasOverlap = (booking, startTime, endTime) =>
  toMinutes(booking.startTime) < toMinutes(endTime) &&
  toMinutes(booking.endTime) > toMinutes(startTime)

const publicUser = (user) => user && ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  photoURL: user.photoURL || '',
  provider: user.provider,
})

app.get('/', (req, res) => {
  res.send({ message: 'StudioSpace server is running fine!' })
})

app.get('/api/health', (req, res) => {
  res.send({ status: 'ok', time: new Date().toISOString() })
})
