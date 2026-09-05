# CSS Tours — Cinematic Sites of Savannah

A tour booking app for Savannah, GA walking tours. Bookers select a tour, pay via PayPal, and receive email confirmation with real-time capacity tracking and self-service cancellation.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19, React Router v7 (SSR) |
| Styling | Tailwind CSS v4, shadcn/ui (Base UI) |
| Animations | Motion |
| Backend / DB | Convex |
| Payments | PayPal Orders v2, JS SDK v6 buttons, webhooks, refunds |
| Email | Resend |
| Validation | Zod v4 |
| Testing | Vitest |
| Deployment | Docker → Fly.io |

## Built Features

- **4-step booking wizard**: date/time picker, guest count, Booker details, and PayPal or guest card buttons on the confirm step
- **PayPal checkout integration**: Orders v2 creation, server-side capture, and amount verification
- **PayPal webhook handling** — `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `CHECKOUT.PAYMENT-APPROVAL.REVERSED`, `PAYMENT.CAPTURE.REFUNDED`, and `PAYMENT.REFUND.FAILED`; idempotent completion and refund handling
- **Booking management** — private no-login access via hashed tokens, self-cancel up to 24h before tour
- **Refund processing**: PayPal refund on cancellation, with email notification on success or failure
- **Booking Communication** — transactional emails via Resend (booking confirmed, refund issued, cancellation failed)
- **Convex persistence** — `tours`, `checkoutAttempts` (30-min TTL), `bookings` tables with full CRUD + queries
- **Design parity** — fonts, color palette, and header/footer matching the marketing site

## Getting Started

```bash
bun install
```

Copy `.env.example` to `.env` and fill in the required values, then:

```bash
bun run dev
```

App available at `http://localhost:5173`.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with HMR |
| `bun run build` | Production build |
| `bun run typecheck` | TypeScript check |
| `bun test` | Run tests |
| `bun run seed:tours` | Seed tours in Convex |

## Deployment

Build and deploy with Docker:

```bash
docker build -t css-tours .
```

CI/CD via GitHub Actions auto-deploys to Fly.io on push to `main`.

## Domain Language

- **Booker** — the person booking (not "user")
- **Checkout Attempt** — pre-payment record (not "booking")
- **Booking** — confirmed, paid reservation
- **Booking Communication** — email sent to the Booker
