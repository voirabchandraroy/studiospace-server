import express from 'express'
import { MongoClient, ObjectId } from 'mongodb'
import cors from 'cors'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
 
const app = express()
const PORT = process.env.PORT || 8000
const isProd = process.env.NODE_ENV === 'production'
 
/* ---------- MongoDB ---------- */
const client = new MongoClient(process.env.MONGODB_URI)
await client.connect().catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1) })
console.log('You successfully connected to MongoDB!')
const db = client.db(process.env.DB_NAME || 'studiospace')
const [users, studios, bookings, wishlist] = ['users', 'studios', 'bookings', 'wishlist'].map((n) => db.collection(n))
 
app.use(cors({ origin: (process.env.CLIENT_URL || 'http://localhost:3000').split(','), credentials: true }))
app.use(express.json(), cookieParser())
app.use((req, res, next) => { req.body ??= {}; next() })
 
const r = (fn) => (req, res, next) => fn(req, res, next).catch(next) // async errors -> error handler
const oid = (id) => new ObjectId(id)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const clean = ({ _id, ownerEmail, ownerName, rating, createdAt, ...rest }) => rest // fields a user may never set
 
/* ---------- JWT ---------- */
const pub = ({ name, email, photoURL }) => ({ name, email, photoURL })
const sign = (u) => jwt.sign({ email: u.email, name: u.name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
const sendLogin = (res, u, message) =>
  res.cookie('token', sign(u), { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/', maxAge: 7 * 864e5 })
    .send({ message, user: pub(u) })
 
const verifyToken = (req, res, next) => {
  try { req.user = jwt.verify(req.cookies?.token, process.env.JWT_SECRET); next() }
  catch { res.status(401).send({ message: 'unauthorized access' }) }
}
 
app.post('/api/auth/register', r(async (req, res) => {
  const { name, email, photoURL, password = '' } = req.body
  if (!name || !email || !password) return res.status(400).send({ message: 'Name, email and password are required.' })
  if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password))
    return res.status(400).send({ message: 'Password needs 6+ characters, one uppercase and one lowercase letter.' })
  if (await users.findOne({ email })) return res.status(409).send({ message: 'This email is already registered.' })
  const { insertedId } = await users.insertOne({ name, email, photoURL, password: await bcrypt.hash(password, 10), createdAt: new Date() })
  res.status(201).send({ message: 'Registration successful. Please log in.', insertedId })
}))
 
app.post('/api/auth/login', r(async (req, res) => {
  const { email, password } = req.body
  const user = await users.findOne({ email })
  if (!user) return res.status(404).send({ message: 'No account found with this email.' })
  if (!(await bcrypt.compare(password || '', user.password || ''))) return res.status(401).send({ message: 'Incorrect password. Please try again.' })
  sendLogin(res, user, 'Login successful.')
}))
 
// NOTE: trusts the profile sent by the client; verify the Firebase ID token here before going live
app.post('/api/auth/google', r(async (req, res) => {
  const { name, email, photoURL } = req.body
  if (!email) return res.status(400).send({ message: 'Email is required.' })
  let user = await users.findOne({ email })
  if (!user) { user = { name, email, photoURL, createdAt: new Date() }; await users.insertOne(user) }
  sendLogin(res, user, 'Google login successful.')
}))
 
app.get('/api/auth/me', verifyToken, r(async (req, res) => {
  const user = await users.findOne({ email: req.user.email })
  user ? res.send(pub(user)) : res.status(404).send({ message: 'User not found.' })
}))
 
app.post('/api/auth/logout', (req, res) => res.clearCookie('token', { path: '/' }).send({ message: 'Logged out successfully.' }))
 
/* ---------- Studios ---------- */
const SORTS = { 'price-asc': { hourlyRate: 1 }, 'price-desc': { hourlyRate: -1 }, rating: { rating: -1 } }
 
app.post('/api/add-studio', verifyToken, r(async (req, res) => {
  res.send(await studios.insertOne({ ...clean(req.body), ownerEmail: req.user.email, ownerName: req.user.name, rating: 0, createdAt: new Date() }))
}))
 
app.get('/api/studios', r(async (req, res) => {
  const { category, search, sort } = req.query
  const filter = {}
  if (category && category !== 'All') filter.category = category
  if (search) filter.$or = ['title', 'location'].map((f) => ({ [f]: { $regex: esc(search), $options: 'i' } }))
  res.send(await studios.find(filter).sort(SORTS[sort] ?? { createdAt: -1 }).toArray())
}))
 
app.get('/api/studios/featured', r(async (req, res) => res.send(await studios.find().sort({ rating: -1, createdAt: -1 }).limit(6).toArray())))
 
app.get('/api/studios/mine', verifyToken, r(async (req, res) =>
  res.send(await studios.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray())))
 
app.get('/api/studio/:id', r(async (req, res) => res.send(await studios.findOne({ _id: oid(req.params.id) }))))
 
app.patch('/api/studio/:id', verifyToken, r(async (req, res) =>
  res.json(await studios.updateOne({ _id: oid(req.params.id), ownerEmail: req.user.email }, { $set: clean(req.body) }))))
 
app.delete('/api/studio/:id', verifyToken, r(async (req, res) =>
  res.json(await studios.deleteOne({ _id: oid(req.params.id), ownerEmail: req.user.email }))))
 



 

app.listen(PORT, () => console.log(`Server is running at ${PORT}`))
 