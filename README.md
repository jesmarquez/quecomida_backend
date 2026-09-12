# Food Marketplace — Backend

Express + Prisma API for the food marketplace project: vendors post meals,
customers place and verify orders by email code, vendors track order status.

## Stack

- **Express** — HTTP server / routing
- **Prisma + PostgreSQL** — database + ORM
- **JWT** — vendor authentication (customers don't need accounts)
- **Multer** — meal image uploads (stored to local disk in `/uploads`)
- **Nodemailer** — sends the order verification code email

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up a Postgres database.** Easiest options if you don't already have
   one running locally:
   - [Neon](https://neon.tech) or [Supabase](https://supabase.com) — free hosted Postgres, just copy the connection string
   - Or run one locally with Docker: `docker run --name food-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `DATABASE_URL` with your Postgres connection string, and set a
   random `JWT_SECRET`. For email, sign up for a free test inbox at
   [ethereal.email](https://ethereal.email) and paste the generated
   credentials into `SMTP_USER` / `SMTP_PASS` — every "sent" email will show
   up there with a preview link (also logged to your console).

4. **Run the initial migration** (creates the tables from `prisma/schema.prisma`)
   ```bash
   npm run prisma:migrate
   ```

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   Server runs at `http://localhost:4000`. Check `http://localhost:4000/health`.

## Data model

- **Vendor** — email, phone, address, name, hashed password
- **MealPost** — belongs to a vendor; description, price, `isAvailable`, one-or-more `MealImage`s
- **Order** — belongs to a meal post; customerEmail, quantity, `status` (`ORDERED` / `READY_FOR_PICKUP` / `HANDED_OVER`), `verificationCode`, `isVerified`

## API reference

### Vendors (auth)
| Method | Route | Auth | Body |
|---|---|---|---|
| POST | `/vendors/register` | — | `name, email, phone, address, password` |
| POST | `/vendors/login` | — | `email, password` |

Both return `{ vendor, token }`. Send `token` as `Authorization: Bearer <token>` on protected routes below.

### Meals
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/meals` | — | Published/available meals (customer-facing page) |
| GET | `/meals/mine` | vendor | All of the logged-in vendor's posts, including unavailable |
| GET | `/meals/:id` | — | Single meal detail |
| POST | `/meals` | vendor | multipart/form-data: `description, price, images[]` (1–5 files) |
| PUT | `/meals/:id` | vendor | Same fields, all optional; can add more `images[]` |
| PATCH | `/meals/:id/availability` | vendor | `{ isAvailable: true/false }` |
| DELETE | `/meals/:id` | vendor | — |

### Orders
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/orders` | — | `{ mealPostId, customerEmail, quantity }` — creates unverified order, emails a 6-digit code |
| POST | `/orders/:id/verify` | — | `{ code }` — confirms the order |
| GET | `/orders/:id` | — | Order status/details lookup (for the customer status page) |
| GET | `/orders` | vendor | This vendor's orders; optional `?status=` or `?mealPostId=` filters |
| PATCH | `/orders/:id/status` | vendor | `{ status: "ORDERED" \| "READY_FOR_PICKUP" \| "HANDED_OVER" }` |

## Connecting your existing frontend

Swap your json-server base URL for `http://localhost:4000` and adjust request
shapes to match the routes above. The main differences from a typical
json-server setup:
- Creating/updating meals is `multipart/form-data`, not JSON (because of image uploads)
- Vendor routes need the `Authorization` header once you're logged in
- The order flow is two calls (`POST /orders` then `POST /orders/:id/verify`), not one

## Next steps to consider

- Swap local disk storage for S3/Cloudinary if you deploy this (disk storage won't persist on most hosting platforms)
- Add rate limiting on `/orders` and `/orders/:id/verify` to prevent code-guessing abuse
- Add a "resend verification code" endpoint
- Move from Ethereal (dev-only) to a real provider like Resend or SendGrid for production email
