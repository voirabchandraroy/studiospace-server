# StudioSpace — Server

Peer-to-Peer Creative Workspace & Production Studio Sharing Platform — API.

**Live API:** `https://studiospace-server.onrender.com` _(replace with your Render URL)_

---

## Project structure

```
studiospace-server/
├── index.js           ← the whole API (Express + MongoDB, ESM)
├── package.json
├── package-lock.json
├── .gitignore
├── .env               ← not committed
└── seed.js            ← optional demo data (safe to delete before submitting)
```

Everything lives in `index.js` — app setup, MongoDB connection, auth, studio CRUD,
bookings, wishlist. No controllers / routes / middleware folders.

---

## Tech stack

Express 5 · MongoDB (native driver) · JSON Web Token (HTTPOnly cookie) · bcryptjs ·
cookie-parser · CORS · dotenv · ESM (`"type": "module"`)

---

## Local setup

```bash
cd studiospace-server
npm install
cp .env.example .env      # add MONGODB_URI + JWT_SECRET
npm start                 # http://localhost:5000
# or
npm run dev               # node --watch, restarts on save
```

Optional demo data:

```bash
npm run seed    # 8 studios + 2 accounts + 1 booking
```

---

## Environment variables (`.env`)

| Variable | Example | Notes |
| --- | --- | --- |
| `PORT` | `5000` | Render sets this automatically |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/` | Atlas connection string |
| `DB_NAME` | `studiospace` | |
| `JWT_SECRET` | `a_very_long_random_string` | signs the auth token |
| `JWT_EXPIRES_IN` | `7d` | token lifetime |
| `CLIENT_URL` | `http://localhost:3000` | CORS origin(s), comma separated |
| `NODE_ENV` | `development` | `production` → `secure` + `SameSite=none` cookie |

---

## API reference

### Auth — `/api/auth`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/register` | Create account (validates 6 chars + upper + lower) |
| POST | `/login` | Log in, sets the HTTPOnly JWT cookie |
| POST | `/google` | Firebase/Google sign-in (upserts the user) |
| POST | `/logout` | Clears the cookie |
| GET | `/me` | Restores the session on page reload |

### Studios — `/api/studios`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/featured` | – | Top 6 studios (`.sort().limit(6)`) |
| GET | `/mine` | ✅ | Listings owned by the logged-in host |
| GET | `/` | – | `category`, `search`, `sort`, `page`, `limit` |
| POST | `/` | ✅ | Create a listing |
| GET | `/:id` | – | Single studio + recent reviews |
| PATCH | `/:id` | ✅ | Update (owner only) |
| DELETE | `/:id` | ✅ | Delete (owner only) |

### Bookings — `/api/bookings`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/` | ✅ | Create a booking with status `Pending` |
| GET | `/mine` | ✅ | Bookings I made as a guest |
| GET | `/host` | ✅ | Requests received for my studios |
| GET | `/studio/:id` | – | Taken slots for the availability calendar |
| PATCH | `/:id/status` | ✅ | Pending → Confirmed → Completed / Cancelled |
| DELETE | `/:id` | ✅ | Cancel a `Pending` booking |

### Wishlist — `/api/wishlist`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | ✅ | Saved studio ids |
| POST | `/toggle` | ✅ | Add / remove a saved studio |

✅ = protected by `verifyToken`; returns **401 Unauthorized** without a valid cookie.

---

## Challenges

**1 — JWT security with HTTPOnly cookies.**
Every mutation runs through `verifyToken`, which reads the JWT from an `httpOnly`
cookie that browser JavaScript cannot touch. Missing, invalid or expired tokens get
`401 Unauthorized`.

**2 — Booking double-booking prevention.**
Before saving a reservation the API loads all `Confirmed` bookings for that studio
and date and applies `existing.start < new.end && existing.end > new.start`.
Collisions return `409 Conflict` naming the occupied range. The same check re-runs
when a host confirms a slot.

**3 — Theme customization** (client side, `next-themes`) — light ⇄ dark toggle.

---

## Examiner test credentials

| Role | Email | Password |
| --- | --- | --- |
| Guest / creator | `examiner@studiospace.com` | `Exam@1234` |
| Studio host | `host@studiospace.com` | `Exam@1234` |
