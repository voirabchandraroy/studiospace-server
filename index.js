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

/* ============================== STUDIOS ============================== */

const toStudio = (doc) => doc && ({ ...doc, _id: doc._id.toString() })

// GET /api/studios/featured — top 6 rated / newest
app.get('/api/studios/featured', async (req, res) => {
  try {
    const result = await studiosCollection
      .find()
      .sort({ rating: -1, createdAt: -1 })
      .limit(6)
      .toArray()
    res.send(result.map(toStudio))
  } catch (err) {
    res.status(500).json({ message: 'Failed to load featured studios.' })
  }
})

// GET /api/studios/mine — listings owned by the logged-in host
app.get('/api/studios/mine', verifyToken, async (req, res) => {
  try {
    const result = await studiosCollection
      .find({ ownerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray()
    res.send(result.map(toStudio))
  } catch (err) {
    res.status(500).json({ message: 'Failed to load your listings.' })
  }
})

// GET /api/studios?category=&search=&sort=&page=&limit=
app.get('/api/studios', async (req, res) => {
  try {
    const { category, search, sort = 'newest', page = '1', limit = '9' } = req.query
    const filter = {}

    if (category && category !== 'All') {
      // tolerant: "Photo Studio" and "Photo Studios" both match
      const escaped = category
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+')
        .replace(/s$/i, '')
      filter.category = { $regex: new RegExp(`^${escaped}s?$`, 'i') }
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { overview: { $regex: search, $options: 'i' } },
      ]
    }

    const sortOption =
      sort === 'price-asc' ? { hourlyRate: 1 }
      : sort === 'price-desc' ? { hourlyRate: -1 }
      : sort === 'rating' ? { rating: -1 }
      : { createdAt: -1 }

    const pageNumber = Number(page) || 1
    const pageSize = Number(limit) || 9

    const [studios, total] = await Promise.all([
      studiosCollection.find(filter).sort(sortOption).skip((pageNumber - 1) * pageSize).limit(pageSize).toArray(),
      studiosCollection.countDocuments(filter),
    ])

    res.send({
      studios: studios.map(toStudio),
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to load studios.' })
  }
})

// POST /api/studios — protected (Challenge 1)
app.post('/api/studios', verifyToken, async (req, res) => {
  try {
    const { title, category, hourlyRate, securityDeposit, maxCapacity, location, image, gallery, amenities, overview } = req.body

    if (!title || !category || !hourlyRate || !location || !image) {
      return res.status(400).json({ message: 'Title, category, rate, location and image are required.' })
    }

    const newStudio = {
      title,
      category,
      hourlyRate: Number(hourlyRate),
      securityDeposit: Number(securityDeposit) || 0,
      maxCapacity: Number(maxCapacity) || 1,
      location,
      image,
      gallery: Array.isArray(gallery) ? gallery.filter(Boolean) : [],
      amenities: Array.isArray(amenities) ? amenities : [],
      overview: overview || '',
      rating: 0,
      reviewCount: 0,
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      createdAt: new Date(),
    }

    const result = await studiosCollection.insertOne(newStudio)
    res.status(201).json({
      message: 'Studio listed successfully.',
      studio: toStudio({ ...newStudio, _id: result.insertedId }),
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to create studio listing.' })
  }
})

// GET /api/studios/:id
app.get('/api/studios/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid studio id.' })

    const studio = await studiosCollection.findOne({ _id: new ObjectId(id) })
    if (!studio) return res.status(404).json({ message: 'Studio not found.' })

    const reviews = await bookingsCollection
      .find({ studioId: id, status: 'Completed' })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray()

    res.send({ ...toStudio(studio), reviews })
  } catch (err) {
    res.status(500).json({ message: 'Failed to load studio details.' })
  }
})

// PATCH /api/studios/:id — owner only (Challenge 1)
app.patch('/api/studios/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid studio id.' })

    const studio = await studiosCollection.findOne({ _id: new ObjectId(id) })
    if (!studio) return res.status(404).json({ message: 'Studio not found.' })
    if (studio.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden — you can only edit your own listings.' })
    }

    const allowed = ['title', 'category', 'hourlyRate', 'securityDeposit', 'maxCapacity', 'location', 'image', 'gallery', 'amenities', 'overview']
    const update = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key]
    }
    if (update.hourlyRate) update.hourlyRate = Number(update.hourlyRate)
    if (update.securityDeposit) update.securityDeposit = Number(update.securityDeposit)
    if (update.maxCapacity) update.maxCapacity = Number(update.maxCapacity)

    const result = await studiosCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    )

    res.send({ message: 'Studio updated successfully.', studio: toStudio(result) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update studio.' })
  }
})

// DELETE /api/studios/:id — owner only (Challenge 1)
app.delete('/api/studios/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid studio id.' })

    const studio = await studiosCollection.findOne({ _id: new ObjectId(id) })
    if (!studio) return res.status(404).json({ message: 'Studio not found.' })
    if (studio.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden — you can only delete your own listings.' })
    }

    await studiosCollection.deleteOne({ _id: new ObjectId(id) })
    res.send({ message: 'Studio listing deleted successfully.' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete studio.' })
  }
})

/* ============================== BOOKINGS ============================== */

const toBooking = (doc) => doc && ({ ...doc, _id: doc._id.toString() })

// GET /api/bookings/host — requests received for my studios
app.get('/api/bookings/host', verifyToken, async (req, res) => {
  try {
    const mine = await studiosCollection.find({ ownerEmail: req.user.email }).toArray()
    const ids = mine.map((s) => s._id.toString())
    const result = await bookingsCollection
      .find({ studioId: { $in: ids } })
      .sort({ createdAt: -1 })
      .toArray()
    res.send(result.map(toBooking))
  } catch (err) {
    res.status(500).json({ message: 'Failed to load host bookings.' })
  }
})

// GET /api/bookings/mine — reservations I made as a guest
app.get('/api/bookings/mine', verifyToken, async (req, res) => {
  try {
    const result = await bookingsCollection
      .find({ userEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray()
    res.send(result.map(toBooking))
  } catch (err) {
    res.status(500).json({ message: 'Failed to load bookings.' })
  }
})

// GET /api/bookings/studio/:id — taken slots for the availability calendar
app.get('/api/bookings/studio/:id', async (req, res) => {
  try {
    const result = await bookingsCollection
      .find({ studioId: req.params.id, status: { $in: ['Confirmed', 'Pending'] } })
      .toArray()
    res.send(result.map(toBooking))
  } catch (err) {
    res.status(500).json({ message: 'Failed to load studio availability.' })
  }
})

// POST /api/bookings — Challenge 2: reject overlapping confirmed slots
app.post('/api/bookings', verifyToken, async (req, res) => {
  try {
    const { studioId, date, startTime, endTime, note } = req.body

    if (!studioId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Studio, date and time range are required.' })
    }
    if (!ObjectId.isValid(studioId)) {
      return res.status(400).json({ message: 'Invalid studio id.' })
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res.status(400).json({ message: 'End time must be later than the start time.' })
    }

    const studio = await studiosCollection.findOne({ _id: new ObjectId(studioId) })
    if (!studio) return res.status(404).json({ message: 'Studio not found.' })
    if (studio.ownerEmail === req.user.email) {
      return res.status(400).json({ message: 'You cannot book your own studio space.' })
    }

    const confirmed = await bookingsCollection
      .find({ studioId, date, status: 'Confirmed' })
      .toArray()

    const collision = confirmed.find((b) => hasOverlap(b, startTime, endTime))
    if (collision) {
      return res.status(409).json({
        message: `This studio is already booked on ${date} from ${collision.startTime} to ${collision.endTime}. Please pick another slot.`,
      })
    }

    const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60
    const booking = {
      studioId,
      studioTitle: studio.title,
      studioImage: studio.image,
      location: studio.location,
      hourlyRate: studio.hourlyRate,
      userEmail: req.user.email,
      userName: req.user.name,
      date,
      startTime,
      endTime,
      hours,
      totalCost: hours * studio.hourlyRate,
      note: note || '',
      status: 'Pending',
      createdAt: new Date(),
    }

    const result = await bookingsCollection.insertOne(booking)
    res.status(201).json({
      message: 'Booking request sent. Status: Pending.',
      booking: toBooking({ ...booking, _id: result.insertedId }),
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to create booking.' })
  }
})

// PATCH /api/bookings/:id/status  { status }
app.patch('/api/bookings/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const allowed = ['Pending', 'Confirmed', 'Completed', 'Cancelled']

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid booking status.' })
    }
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking id.' })

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })

    const studio = await studiosCollection.findOne({ _id: new ObjectId(booking.studioId) })
    const isGuest = booking.userEmail === req.user.email
    const isHost = studio?.ownerEmail === req.user.email
    if (!isGuest && !isHost) {
      return res.status(403).json({ message: 'Forbidden — not your booking.' })
    }

    // re-check conflicts when a host confirms a slot
    if (status === 'Confirmed') {
      const conflicts = await bookingsCollection
        .find({ studioId: booking.studioId, date: booking.date, status: 'Confirmed', _id: { $ne: new ObjectId(id) } })
        .toArray()

      const collision = conflicts.find((b) => hasOverlap(b, booking.startTime, booking.endTime))
      if (collision) {
        return res.status(409).json({
          message: `Cannot confirm — overlaps a confirmed booking (${collision.startTime}–${collision.endTime}).`,
        })
      }
    }

    const result = await bookingsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status } },
      { returnDocument: 'after' }
    )

    res.send({ message: `Booking marked as ${status}.`, booking: toBooking(result) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update booking status.' })
  }
})

// DELETE /api/bookings/:id — guest cancels a Pending booking
app.delete('/api/bookings/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking id.' })

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    if (booking.userEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden — not your booking.' })
    }
    if (booking.status !== 'Pending') {
      return res.status(400).json({ message: `Only pending bookings can be cancelled (current: ${booking.status}).` })
    }

    await bookingsCollection.deleteOne({ _id: new ObjectId(id) })
    res.send({ message: 'Booking cancelled successfully.' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking.' })
  }
})

/* ============================== WISHLIST ============================== */

// GET /api/wishlist
app.get('/api/wishlist', verifyToken, async (req, res) => {
  try {
    const items = await wishlistCollection.find({ userEmail: req.user.email }).toArray()
    res.send(items.map((i) => i.studioId))
  } catch (err) {
    res.status(500).json({ message: 'Failed to load wishlist.' })
  }
})

// POST /api/wishlist/toggle  { studioId }
app.post('/api/wishlist/toggle', verifyToken, async (req, res) => {
  try {
    const { studioId } = req.body
    if (!studioId) return res.status(400).json({ message: 'studioId is required.' })

    const email = req.user.email
    const existing = await wishlistCollection.findOne({ userEmail: email, studioId })

    if (existing) {
      await wishlistCollection.deleteOne({ userEmail: email, studioId })
      return res.send({ saved: false, message: 'Removed from your saved studios.' })
    }

    await wishlistCollection.insertOne({ userEmail: email, studioId, createdAt: new Date() })
    res.status(201).send({ saved: true, message: 'Added to your saved studios.' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update wishlist.' })
  }
})

/* ------------------- 404 + error handler + listen ------------------- */
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' })
})

app.use((err, req, res, next) => {
  console.error(err.message)
  res.status(500).json({ success: false, message: 'Internal server error.' })
})

// http://localhost:5000
app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})
