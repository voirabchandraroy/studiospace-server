/**
 * Optional dev helper — inserts demo studios, accounts and one booking.
 * Safe to delete before submitting; the assignment does not need it.
 *
 *   node seed.js
 */
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017')
const db = client.db(process.env.DB_NAME || 'studiospace')
const usersCollection = db.collection('users')
const studiosCollection = db.collection('studios')
const bookingsCollection = db.collection('bookings')
const wishlistCollection = db.collection('wishlist')

const studios = [
  {
    title: 'Northlight Cyc Wall Studio',
    category: 'Photo Studio',
    hourlyRate: 55,
    securityDeposit: 150,
    maxCapacity: 12,
    location: 'Banani, Dhaka',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: ['Cyc Wall', 'Profoto Lighting', 'Makeup Room', 'Free Parking', 'Wi-Fi'],
    overview:
      'A 1,400 sq ft daylight studio with a 20ft infinity cove, 5m ceiling height and drive-in access. Profoto D2 packs, a full C-stand rack and a private makeup room are included in every booking. Blackout curtains let you kill the daylight completely for controlled strobe work.',
    rating: 4.9,
    reviewCount: 34,
  },
  {
    title: 'Riverside Sound Stage B',
    category: 'Film Stage',
    hourlyRate: 180,
    securityDeposit: 800,
    maxCapacity: 60,
    location: 'Gulshan, Dhaka',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80',
    gallery: ['https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Green Screen', '4K Video', 'Loading Dock', 'Makeup Room', 'Green Room', 'Equipment Rental'],
    overview:
      'A 5,000 sq ft column-free stage with 3-phase power, a 30ft grid height and a permanent 40ft green screen wall. Includes a grip package, two dressing rooms, a production office and a drive-in loading dock big enough for a 5-ton truck.',
    rating: 4.8,
    reviewCount: 21,
  },
  {
    title: 'The Quiet Room Podcast Lounge',
    category: 'Podcast Lounge',
    hourlyRate: 35,
    securityDeposit: 100,
    maxCapacity: 5,
    location: 'Dhanmondi, Dhaka',
    image: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=1200&q=80',
    gallery: ['https://images.unsplash.com/photo-1587731556938-38755b4803a6?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Soundproofing', 'Podcast Microphones', 'Wi-Fi', 'Air Conditioning'],
    overview:
      'An acoustically treated 4-person lounge built for long-form conversation. Four Shure SM7Bs into a Rodecaster Duo, headphones for everyone, and full acoustic isolation from street noise. Record an entire season in a weekend.',
    rating: 5.0,
    reviewCount: 47,
  },
  {
    title: 'Analog Tracking Suite',
    category: 'Music Suite',
    hourlyRate: 70,
    securityDeposit: 250,
    maxCapacity: 8,
    location: 'Uttara, Dhaka',
    image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    amenities: ['Mixing Console', 'MIDI Keyboards', 'Soundproofing', 'Equipment Rental', 'Wi-Fi'],
    overview:
      'A hybrid tracking room centred on a 24-channel analog console, a live room with adjustable acoustics and a vocal booth. Backline includes a Fender Rhodes, a Juno-106 and a Gretsch kit. House engineer available on request.',
    rating: 4.7,
    reviewCount: 18,
  },
  {
    title: 'Clay & Kiln Art Workshop',
    category: 'Art Workshop',
    hourlyRate: 28,
    securityDeposit: 80,
    maxCapacity: 16,
    location: 'Lalmatia, Dhaka',
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    amenities: ['Kitchenette', 'Free Parking', 'Wi-Fi', 'Air Conditioning'],
    overview:
      "A messy-friendly workshop with eight potter's wheels, two kilns, slab roller and endless bench space. Concrete floors, a slop sink and hose-down walls mean you can make as much mess as the work requires.",
    rating: 4.6,
    reviewCount: 12,
  },
  {
    title: 'Neon Loft Editorial Space',
    category: 'Photo Studio',
    hourlyRate: 42,
    securityDeposit: 120,
    maxCapacity: 10,
    location: 'Mohammadpur, Dhaka',
    image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    gallery: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Profoto Lighting', 'Green Room', 'Wi-Fi', 'Kitchenette'],
    overview:
      'A top-floor loft with 12ft south-facing windows, original brick and a rotating set-build area. Perfect for editorial fashion, lookbooks and e-commerce. Two strobe heads, a 7ft octabox and a steamer come with the room.',
    rating: 4.8,
    reviewCount: 29,
  },
  {
    title: 'Blackbox Theatre Stage',
    category: 'Film Stage',
    hourlyRate: 95,
    securityDeposit: 400,
    maxCapacity: 40,
    location: 'Mirpur, Dhaka',
    image: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    amenities: ['4K Video', 'Loading Dock', 'Green Room', 'Air Conditioning'],
    overview:
      'A flexible blackbox with a 24ft lighting grid, movable seating banks and a sprung floor. Used equally for narrative shoots, rehearsals and live-streamed performances. Full LED fixture package available.',
    rating: 4.5,
    reviewCount: 9,
  },
  {
    title: 'Sunset Rooftop Deck',
    category: 'Photo Studio',
    hourlyRate: 60,
    securityDeposit: 150,
    maxCapacity: 20,
    location: 'Baridhara, Dhaka',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    amenities: ['Free Parking', 'Wi-Fi', 'Kitchenette'],
    overview:
      'An open-air 2,000 sq ft rooftop with unobstructed west views — the golden hour here is genuinely unbeatable. Best for lifestyle, portrait and small commercial crews. Book 3 hours and the reflector kit is free.',
    rating: 4.9,
    reviewCount: 41,
  },
]

const hostEmail = 'host@studiospace.com'
const examinerEmail = 'examiner@studiospace.com'
const password = 'Exam@1234' // upper + lower + 6+ chars

async function seed() {
  await client.connect()
  console.log('You successfully connected to MongoDB!')

  await studiosCollection.deleteMany({})
  await bookingsCollection.deleteMany({})
  await wishlistCollection.deleteMany({})

  await usersCollection.deleteMany({ email: { $in: [hostEmail, examinerEmail] } })
  await usersCollection.insertMany([
    { name: 'Ava Rahman', email: hostEmail, photoURL: 'https://i.pravatar.cc/150?img=47', password: await bcrypt.hash(password, 10), provider: 'credentials', createdAt: new Date() },
    { name: 'Examiner Account', email: examinerEmail, photoURL: 'https://i.pravatar.cc/150?img=12', password: await bcrypt.hash(password, 10), provider: 'credentials', createdAt: new Date() },
  ])
  console.log(`Created users: ${hostEmail} / ${examinerEmail}  (password: ${password})`)

  const docs = studios.map((s, i) => ({
    ...s,
    ownerEmail: i % 2 === 0 ? hostEmail : examinerEmail,
    ownerName: i % 2 === 0 ? 'Ava Rahman' : 'Examiner Account',
    createdAt: new Date(Date.now() - i * 86400000),
  }))

  const result = await studiosCollection.insertMany(docs)
  console.log(`Inserted ${result.insertedCount} studios`)

  const studioIds = Object.values(result.insertedIds)
  const inFiveDays = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]

  await bookingsCollection.insertOne({
    studioId: studioIds[0].toString(),
    studioTitle: studios[0].title,
    studioImage: studios[0].image,
    location: studios[0].location,
    hourlyRate: studios[0].hourlyRate,
    userEmail: examinerEmail,
    userName: 'Examiner Account',
    date: inFiveDays,
    startTime: '10:00',
    endTime: '14:00',
    hours: 4,
    totalCost: 4 * studios[0].hourlyRate,
    note: 'Fashion editorial — crew of 6, need the steamer.',
    status: 'Confirmed',
    createdAt: new Date(),
  })
  console.log('Inserted 1 sample confirmed booking')

  await client.close()
  console.log('\nSeed complete.')
}

seed().catch((err) => {
  console.dir(err)
  process.exit(1)
})
