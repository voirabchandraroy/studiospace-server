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

/* =============================== AUTH =============================== */

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, photoURL, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' })
    }
    // password rules: >= 6 chars, 1 uppercase, 1 lowercase
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' })
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one uppercase letter.' })
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one lowercase letter.' })
    }

    const existing = await usersCollection.findOne({ email })
    if (existing) {
      return res.status(409).json({ message: 'This email is already registered.' })
    }

    const newUser = {
      name,
      email,
      photoURL: photoURL || '',
      password: await bcrypt.hash(password, 10),
      provider: 'credentials',
      createdAt: new Date(),
    }
    const result = await usersCollection.insertOne(newUser)

    res.status(201).json({
      message: 'Registration successful. Please log in.',
      user: publicUser({ ...newUser, _id: result.insertedId }),
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to register user.' })
  }
})

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    const user = await usersCollection.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' })
    }
    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google sign-in. Please continue with Google.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' })
    }

    res.cookie(COOKIE_NAME, signToken({ email: user.email, name: user.name }), cookieOptions)
    res.send({ message: 'Login successful.', user: publicUser(user) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to log in.' })
  }
})

// POST /api/auth/google  (Firebase / social login)
app.post('/api/auth/google', async (req, res) => {
  try {
    const { name, email, photoURL } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required.' })

    let user = await usersCollection.findOne({ email })

    if (!user) {
      const newUser = {
        name: name || email.split('@')[0],
        email,
        photoURL: photoURL || '',
        provider: 'google',
        createdAt: new Date(),
      }
      const result = await usersCollection.insertOne(newUser)
      user = { ...newUser, _id: result.insertedId }
    }

    res.cookie(COOKIE_NAME, signToken({ email: user.email, name: user.name }), cookieOptions)
    res.send({ message: 'Google login successful.', user: publicUser(user) })
  } catch (err) {
    res.status(500).json({ message: 'Google authentication failed.' })
  }
})

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 })
  res.send({ message: 'Logged out successfully.' })
})

// GET /api/auth/me — keeps the session alive across a full page reload
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) return res.status(401).json({ message: 'Unauthorized access.' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await usersCollection.findOne({ email: decoded.email })
    if (!user) return res.status(404).json({ message: 'User not found.' })

    res.send(publicUser(user))
  } catch (err) {
    res.status(401).json({ message: 'Unauthorized access.' })
  }
})
