# StudioSpace — Server

Express + MongoDB REST API for the StudioSpace peer-to-peer studio marketplace.

**Live API:** `https://studiospace-server.onrender.com` _(replace with your Render URL)_

---

## Tech stack

Express.js · MongoDB (native driver) · TypeScript · JSON Web Token · bcryptjs · cookie-parser · CORS · Helmet · Morgan

---

## Local setup

```bash
cd studiospace-server

npm install

cp .env.example .env      # then fill in MONGODB_URI and JWT_SECRET

npm run dev               # http://localhost:5000
```

Optional — spin up a throwaway local MongoDB and load demo data:

```bash
npm run mongo     # terminal A: starts mongod on 27017
npm run seed      # terminal B: inserts 8 studios + 2 accounts + 1 booking
```

---

## Environment variables

| Variable | Example | Notes |
| --- | --- | --- |
| `PORT` | `5000` | Render supplies this automatically |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/` | MongoDB Atlas connection string |
| `DB_NAME` | `studiospace` | Database name |
| `JWT_SECRET` | `a_very_long_random_string` | Signs the auth token |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:3000` | CORS origin(s), comma-separated |
| `NODE_ENV` | `development` | `production` enables `secure` + `SameSite=none` cookies |

---

## API reference

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | – | Create an account (validates password rules) |
| POST | `/login` | – | Log in and receive the HTTPOnly JWT cookie |
| POST | `/google` | – | Upsert a Firebase/Google user and issue a cookie |
| POST | `/logout` | – | Clear the auth cookie |
| GET | `/me` | cookie | Restore the session on page reload |

### Studios — `/api/studios`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/featured` | – | Top 6 studios (`.sort().limit(6)`) |
| GET | `/` | – | List with `category`, `search`, `sort`, `page`, `limit` |
| GET | `/mine` | ✅ | Listings owned by the logged-in host |
| GET | `/:id` | – | Single studio + recent reviews |
| POST | `/` | ✅ | Create a listing |
| PATCH | `/:id` | ✅ | Update (owner only) |
| DELETE | `/:id` | ✅ | Delete (owner only) |

### Bookings — `/api/bookings`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/` | ✅ | Create a booking, status `Pending` |
| GET | `/mine` | ✅ | Bookings made by the user |
| GET | `/host` | ✅ | Requests received for the user's studios |
| GET | `/studio/:id` | – | Taken slots for the availability calendar |
| PATCH | `/:id/status` | ✅ | Host/guest status change |
| DELETE | `/:id` | ✅ | Cancel a `Pending` booking |

### Wishlist — `/api/wishlist`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | ✅ | Saved studio ids |
| POST | `/toggle` | ✅ | Add / remove a saved studio |

✅ = protected by the `verifyToken` middleware; returns **401 Unauthorized** without a valid cookie.

---

## Challenge implementations

**Challenge 1 — JWT security with HTTPOnly cookies.**
Every mutation (`POST /api/studios`, `PATCH|DELETE /api/studios/:id`, `POST /api/bookings`, `PATCH|DELETE /api/bookings/:id`, wishlist) sits behind `verifyToken`, which reads the JWT from an `httpOnly` cookie that browser JavaScript cannot access. Missing, invalid or expired tokens are rejected with `401 Unauthorized`.

**Challenge 2 — booking double-booking prevention.**
Before saving a reservation, the API queries all `Confirmed` bookings for that studio and date and applies the overlap rule `existing.start < new.end && existing.end > new.start`. Collisions are rejected with `409 Conflict` and a message naming the occupied range. The same check re-runs when a host tries to confirm a slot.

**Challenge 3 — theme customization.**
`next-themes` powers a navbar toggle that switches the entire app between light and dark, persisting the choice to `localStorage` and applying on first paint.

---

## Project structure

```
server/
├── scripts/
│   ├── dev-mongo.js      # throwaway local mongod for development
│   └── seed.ts           # demo studios, accounts and bookings
└── src/
    ├── index.ts               # express app, middleware, routes, error handler
    ├── config/db.ts           # Mongo client + collection helpers
    ├── controllers/           # auth, studio, booking, wishlist
    ├── lib/jwt.ts             # sign / verify + cookie options
    ├── middleware/verifyToken.ts
    ├── routes/
    └── types.ts
```
