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
- **Operator sign-in** — `/admin` requires a Convex Auth session (password or magic link); only allowlisted emails can sign up
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

### Operator sign-in

The operator console at `/admin` uses [Convex Auth](https://labs.convex.dev/auth). Set these on each Convex deployment (`npx convex env set <NAME> <value>`, add `--prod` for production):

| Variable | Value |
|---|---|
| `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` | Run `npx @convex-dev/auth` once per deployment to generate them. `SITE_URL` is the app origin, e.g. `http://localhost:5173` |
| `OPERATOR_ALLOWED_EMAILS` | Comma-separated emails allowed to sign up and use `/admin`. Removing an email signs that Operator out on their next request |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Same values as the app. Convex sends the sign-in link and the sign-up code |

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with HMR |
| `bun run build` | Production build |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Run tests (vitest) |
| `bun run seed:tours` | Seed tours in Convex through `npx convex run` (add `--prod` for production) |
| `bun run seed:test-tour` | Create the $1 test tour (add `--prod` for production). See [Testing production](#testing-production) |

## Deployment

Build and deploy with Docker:

```bash
docker build -t css-tours .
```

CI/CD via GitHub Actions:

- Every pull request runs `bun run typecheck` and `bun run test` (`.github/workflows/ci.yml`).
- Every push to `main` runs the same checks, then deploys Convex functions (`npx convex deploy`) and then the app to Fly.io (`.github/workflows/fly-deploy.yml`). A failing check blocks both deploys.
- The deploy needs a production Convex deploy key in the `CONVEX_DEPLOY_KEY` repository secret.

## Testing production

The test tour at `/tour/test-tour` costs $1 per guest and runs through live PayPal, Resend, and webhooks. Only signed-in Operators can see or book it; everyone else gets a 404. Its Bookings show up as "Test tour" in the console and in operator emails.

1. Create it once: `bun run seed:test-tour --prod`.
2. Sign in at `/admin`, then open `/tour/test-tour`.
3. Book a date at least two days out (self-cancel closes 24 hours before), using an email you can read.
4. Check the Booking email and the new-Booking operator email, then cancel from the manage link and check the refund emails.

PayPal returns the percentage fee on a refund but keeps the fixed fee, so each round costs about $0.50.

## Reading the logs

The server writes one JSON line per step of the Booker's journey (`app/lib/log.ts`). Filter Fly logs by an id to follow one Booker: `fly logs | grep '"bookingId":"<id>"'`, or by `checkoutAttemptId` or `paypalOrderId` before a Booking exists. Error lines include PayPal's status code and response body, which has the `issue` and `debug_id`.

| Step | Events |
|---|---|
| Form submitted | `checkout.rejected` (with `reason`), `checkout.start_failed`, or `checkout.started` (PayPal opens) |
| PayPal closed | `checkout.paypal_canceled` |
| PayPal approved | `checkout.capture_requested`, then `checkout.captured` or `checkout.capture_rejected`/`checkout.capture_failed` |
| Booking | `booking.created`, or `checkout.finalized` for any other outcome (duplicate, capacity race), then `checkout.success_viewed` |
| Webhooks | `paypal.webhook_received`, `refund.reconciled`, `paypal.webhook_failed` |
| Manage page | `manage.viewed` or `manage.rejected` |
| Cancel | `cancellation.requested` (with the Booker's reason), then `cancellation.completed`, `cancellation.rejected`, `cancellation.refund_failed`, or `cancellation.record_failed` (refunded in PayPal but the Booking wasn't updated) |
| Operator | `operator.refund_requested`, `operator.refund_failed`, `operator.marked_refunded` |
| Email | `email.sent` or `email.failed` |

Logs never include access tokens, emails, or names.

## Domain Language

- **Booker** — the person booking (not "user")
- **Checkout Attempt** — pre-payment record (not "booking")
- **Booking** — confirmed, paid reservation
- **Booking Communication** — email sent to the Booker
- **Operator** — allowlisted staff member who signs in to `/admin`
