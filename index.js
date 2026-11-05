import express from 'express'
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'

const app = express()
const PORT = process.env.PORT || 8000

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

// credentials:true is required so the browser can send the HTTPOnly cookie
app.use(cors({
  origin: (process.env.CLIENT_URL || 'http://localhost:3000').split(','),
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())


const mongoClient = await connectToMongoDB()
const db = mongoClient.db("studiospace")
const usersCollection = db.collection("users")
const studiosCollection = db.collection("studios")
const bookingsCollection = db.collection("bookings")
const wishlistCollection = db.collection("wishlist")


/* ============================== JWT ============================== */

const COOKIE_NAME = 'token'

// signs the token that gets stored in an HTTPOnly cookie
const signToken = (user) =>
  jwt.sign({ email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

// reads the JWT back out of the cookie; 401 if it is missing / invalid / expired
const verifyToken = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).send({ message: 'unauthorized access' })

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'unauthorized access' })
    req.user = decoded
    next()
  })
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, photoURL, password } = req.body

  if (!name || !email || !password) {
    return res.status(400).send({ message: 'Name, email and password are required.' })
  }
  if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    return res.status(400).send({ message: 'Password needs 6+ characters, one uppercase and one lowercase letter.' })
  }

  const existing = await usersCollection.findOne({ email })
  if (existing) return res.status(409).send({ message: 'This email is already registered.' })

  const user = { name, email, photoURL, password: await bcrypt.hash(password, 10), createdAt: new Date() }
  const result = await usersCollection.insertOne(user)
  res.status(201).send({ message: 'Registration successful. Please log in.', insertedId: result.insertedId })
})

// POST /api/auth/login — verifies the password then issues the JWT cookie
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  const user = await usersCollection.findOne({ email })
  if (!user) return res.status(404).send({ message: 'No account found with this email.' })

  const isMatch = await bcrypt.compare(password, user.password || '')
  if (!isMatch) return res.status(401).send({ message: 'Incorrect password. Please try again.' })

  res
    .cookie(COOKIE_NAME, signToken(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .send({ message: 'Login successful.', user: { name: user.name, email: user.email, photoURL: user.photoURL } })
})

// POST /api/auth/google — social login (Firebase hands us the profile)
app.post('/api/auth/google', async (req, res) => {
  const { name, email, photoURL } = req.body
  let user = await usersCollection.findOne({ email })

  if (!user) {
    await usersCollection.insertOne({ name, email, photoURL, createdAt: new Date() })
    user = { name, email }
  }

  res
    .cookie(COOKIE_NAME, signToken(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .send({ message: 'Google login successful.', user: { name: user.name, email: user.email, photoURL } })
})

// GET /api/auth/me — keeps the user logged in on reload
app.get('/api/auth/me', verifyToken, async (req, res) => {
  const user = await usersCollection.findOne({ email: req.user.email })
  if (!user) return res.status(404).send({ message: 'User not found.' })
  res.send({ name: user.name, email: user.email, photoURL: user.photoURL })
})

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' }).send({ message: 'Logged out successfully.' })
})


/* ============================= STUDIOS ============================= */

// POST /add-studio
app.post('/add-studio', verifyToken, async (req, res) => {
  const data = { ...req.body, ownerEmail: req.user.email, ownerName: req.user.name, rating: 0, createdAt: new Date() }
  const result = await studiosCollection.insertOne(data)
  res.send(result)
})

// GET /studios
app.get('/studios', async (req, res) => {
  const { category, search, sort } = req.query
  const filter = {}
  if (category && category !== 'All') filter.category = category
  if (search) filter.$or = [
    { title: { $regex: search, $options: 'i' } },
    { location: { $regex: search, $options: 'i' } },
  ]

  const sortOption = sort === 'price-asc' ? { hourlyRate: 1 }
    : sort === 'price-desc' ? { hourlyRate: -1 }
    : sort === 'rating' ? { rating: -1 }
    : { createdAt: -1 }

  const result = await studiosCollection.find(filter).sort(sortOption).toArray()
  res.send(result)
})

// GET /studios/featured — top 6
app.get('/studios/featured', async (req, res) => {
  const result = await studiosCollection.find().sort({ rating: -1, createdAt: -1 }).limit(6).toArray()
  res.send(result)
})

// GET /studios/mine
app.get('/studios/mine', verifyToken, async (req, res) => {
  const result = await studiosCollection.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray()
  res.send(result)
})

// GET /studio/:id
app.get('/studio/:id', async (req, res) => {
  const { id } = req.params
  const result = await studiosCollection.findOne({ _id: new ObjectId(id) })
  res.send(result)
})

// PATCH /studio/:id
app.patch('/studio/:id', verifyToken, async (req, res) => {
  const { id } = req.params
  const data = req.body
  const result = await studiosCollection.updateOne(
    { _id: new ObjectId(id), ownerEmail: req.user.email },
    { $set: data }
  )
  res.json(result)
})

// DELETE /studio/:id
app.delete('/studio/:id', verifyToken, async (req, res) => {
  const { id } = req.params
  const result = await studiosCollection.deleteOne({ _id: new ObjectId(id), ownerEmail: req.user.email })
  res.json(result)
})


/* ============================= BOOKINGS ============================= */

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

// POST /add-booking — rejects slots that overlap a Confirmed booking
app.post('/add-booking', verifyToken, async (req, res) => {
  const { studioId, date, startTime, endTime, note } = req.body
  const studio = await studiosCollection.findOne({ _id: new ObjectId(studioId) })
  if (!studio) return res.status(404).send({ message: 'Studio not found.' })

  const confirmed = await bookingsCollection.find({ studioId, date, status: 'Confirmed' }).toArray()
  const collision = confirmed.find(
    (b) => toMinutes(b.startTime) < toMinutes(endTime) && toMinutes(b.endTime) > toMinutes(startTime)
  )
  if (collision) {
    return res.status(409).send({
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
    date, startTime, endTime, hours,
    totalCost: hours * studio.hourlyRate,
    note,
    status: 'Pending',
    createdAt: new Date(),
  }

  const result = await bookingsCollection.insertOne(booking)
  res.send(result)
})

// GET /bookings — ?email=guest (mine) or ?host=true (requests for my studios)
app.get('/bookings', verifyToken, async (req, res) => {
  if (req.query.host === 'true') {
    const mine = await studiosCollection.find({ ownerEmail: req.user.email }).toArray()
    const result = await bookingsCollection
      .find({ studioId: { $in: mine.map((s) => s._id.toString()) } })
      .sort({ createdAt: -1 })
      .toArray()
    return res.send(result)
  }

  const result = await bookingsCollection
    .find({ userEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray()
  res.send(result)
})

// GET /bookings/:studioId — taken slots for the availability calendar
app.get('/bookings/:studioId', async (req, res) => {
  const { studioId } = req.params
  const result = await bookingsCollection
    .find({ studioId, status: { $in: ['Confirmed', 'Pending'] } })
    .toArray()
  res.send(result)
})

// PATCH /booking/:id — { status }
app.patch('/booking/:id', verifyToken, async (req, res) => {
  const { id } = req.params
  const result = await bookingsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: req.body.status } }
  )
  res.json(result)
})

// DELETE /booking/:id
app.delete('/booking/:id', verifyToken, async (req, res) => {
  const { id } = req.params
  const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id), status: 'Pending' })
  res.json(result)
})


/* ============================= WISHLIST ============================= */

// GET /wishlist
app.get('/wishlist', verifyToken, async (req, res) => {
  const result = await wishlistCollection.find({ userEmail: req.user.email }).toArray()
  res.send(result.map((i) => i.studioId))
})

// POST /wishlist/toggle
app.post('/wishlist/toggle', verifyToken, async (req, res) => {
  const { studioId } = req.body
  const filter = { userEmail: req.user.email, studioId }
  const existing = await wishlistCollection.findOne(filter)

  if (existing) {
    await wishlistCollection.deleteOne(filter)
    return res.send({ saved: false, message: 'Removed from your saved studios.' })
  }

  await wishlistCollection.insertOne({ ...filter, createdAt: new Date() })
  res.send({ saved: true, message: 'Added to your saved studios.' })
})


//http://localhost:8000

app.get('/', (req, res) => {
    res.send({message: 'Server is running fine!'})
})

app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`)
})
