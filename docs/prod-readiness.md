# Production readiness

Work to finish before Bookers arrive from the WordPress site. Bookers click a hard-coded tour link on WordPress, land on `/tour/:tourId`, and book through the stepper.

Last reviewed: 2026-09-23. At that point `bun run typecheck` passed and `bun test` passed (69 tests).

Line numbers drift as code changes. Each item also names the function or component so it can be found again.

Each item links to its GitHub issue (all labeled `launch`). Tick items off as PRs land.

## Blockers

### 1. Lock down Convex functions (#59)

- [ ] Done

Every Convex function is a public `query` or `mutation`. The Convex URL also ships in the client bundle because `app/root.tsx` (`App`, around line 55) creates a `ConvexReactClient` that nothing uses. Anyone can read the URL from devtools and call:

- `tours:seedTours` (`convex/tours.ts`) to reprice or delete tours
- `bookings:createBooking` to fill slots with fake Bookings
- `checkoutAttempts:createCheckoutAttempt` followed by `completeCheckoutAttempt` with a made-up PayPal order ID, which creates a "paid" Booking with no payment
- `bookings:getBookingById` to read a Booker's name and email

Fix:

- Delete unused functions: `createBooking`, `updateBooking`, `getBookingById`, `getBookingWithTour`.
- Convert `seedTours` to `internalMutation` and run it with `npx convex run`.
- Add a server secret argument to every remaining public function. Check it against a Convex environment variable. Pass it from a small wrapper in `app/lib`.
- Remove `ConvexProvider` and `ConvexReactClient` from `app/root.tsx`.

Do this first, in its own PR.

### 2. Stable tour links (#60)

- [ ] Done

`seedTours` deletes each tour by slug and inserts a new one (`convex/tours.ts`, around lines 49-53). Every run creates new IDs. That breaks hard-coded WordPress links and orphans existing Bookings:

- The manage page redirects to `/` because the tour is gone.
- `completeCheckoutAttempt` throws "Tour not found" after PayPal already captured the money. The Booker is charged, gets no Booking, and gets no refund.

Fix:

- Have WordPress link by slug, for example `/tour/film-locations`. Look up tours by slug in the `tour-booking.tsx` loader and action, with a `by_slug` index.
- Change the seed to update existing tours in place instead of deleting them.

Finish this before anyone writes the WordPress links.

### 3. Remove placeholder tour content (#61)

- [ ] Done

The tour page shows food-tour placeholder copy and a fake review count:

- `app/routes/tour-booking.tsx`: "Tour · Food" (around line 27), 5 stars "(500)" (around lines 39-40), "Six tastings, recipe card" (around line 68)
- `app/components/stepper/guest-selector.tsx`: "chatting with the chefs"

A made-up review count is an FTC problem, not only a copy problem. Use real tour fields, for example `category` and `highlights`, or remove these blocks.

### 4. Block past time slots (#62)

- [ ] Done

`BookingDetailsValidation` only checks that the date is today or later (`app/lib/dates.ts`, `isDateOnOrAfterToday`). At 3 PM a Booker can still pay for today's 9 AM slot.

Fix:

- Server: reject a date and time that has already started in `America/New_York`. Add a lead-time cutoff once the operator picks one (see open questions).
- UI: hide or disable past times in `app/components/stepper/date-selector.tsx`.

### 5. Let the operator block dates (#63)

- [ ] Done

Every listed start time is bookable on every date forever. The operator can't close a holiday, a storm day, or a day the guide is sick.

Minimum fix:

- Add a `blockedDates: string[]` field on `tours`, edited from the Convex dashboard.
- Add a maximum booking window, for example 90 days out.
- Enforce both in the booking action and in the date selector.

The schedule answers from the operator may change this.

### 6. Tell the business about new Bookings (#64)

- [ ] Done

Nobody at the business is notified of a new Booking or cancellation, and there is no roster view. The admin dashboard is item 3 in `docs/tour-booking-roadmap.md`, and it's out of scope for launch.

Scrappy fix:

- Send an email to the operator address on every Booking and every cancellation.
- Use the Convex dashboard `bookings` table as the roster until the admin dashboard exists.

### 7. Stop swallowing email failures (#65)

- [ ] Done

Every send function in `app/lib/email.ts` ends in `catch {}`. The confirmation email is the only place the manage/cancel link exists. If Resend rejects a send, the Booker can't cancel and nobody finds out.

Fix:

- Log the error with enough context to find the Booking.
- Alert the operator when the confirmation email fails, so they can resend the link by hand.

Durable retries are tracked in #54 and #56 and can wait.

### 8. Fix the cancellation cutoff timezone (#66)

- [ ] Done

`tourStartAt` in `app/routes/manage-tour.tsx` (around line 46) parses `"2026-09-25 9:00 AM"` in the server's local timezone. Fly runs in UTC, so a 9 AM tour is treated as 5 AM Eastern and the 24-hour cutoff lands 4 to 5 hours early. Confirmed locally: with `TZ=UTC`, `new Date("2026-09-25 9:00 AM")` returns `09:00Z`.

Fix: either set `TZ=America/New_York` under `[env]` in `fly.toml`, or compute the start time in Eastern explicitly. The explicit version doesn't depend on deploy config. Item 4 needs the same helper.

### 9. Customer-facing copy and dead links (#67)

- [ ] Done

Internal domain terms appear in customer-facing text:

- "Start a new Checkout Attempt" (`app/routes/checkout-cancel.tsx`, around line 66)
- "Your card was not charged by this app" (`checkout-cancel.tsx`)
- "Hi Jose, manage cancellation." and "Payment Status: refund pending" (`manageCancellationCopy` in `app/routes/manage-tour.tsx`)
- "Booking Status: canceled" on the manage page
- "Your Booking Communication record now shows Payment Status: refund failed" (`createRefundFailedEmail` in `app/lib/email.ts`)

Other fixes in the same pass:

- "Browse tours" links to `/v2/book`, which returns a 404 (`manage-tour.tsx`, around line 273). Point it at the WordPress tours page.
- The support address in emails falls back to the literal word "support" (`createRefundFailedEmail` and siblings in `email.ts`). Use `info@cinematicsitesofsavannah.com`, which the footer already uses.
- "Contact support" on the manage page gives no contact details. Add the email address and phone number.

Domain language stays in code and docs. Bookers see plain words.

## Should do

- [ ] **Check capacity before payment (#69).** Capacity is only checked after capture in `completeCheckoutAttempt` (`convex/checkoutAttempts.ts`). A full slot keeps taking payments and refunding them, and PayPal keeps its fixed fee on refunds. Add a capacity check in the `tour-booking.tsx` action before creating the PayPal order. Showing "full" on time buttons is a nice extra.
- [ ] **Add Convex indexes (#68).** Every lookup in `convex/checkoutAttempts.ts` uses `.filter()`, which scans the whole table inside a mutation, so concurrent bookings conflict and retry. Add indexes for `paypalOrderId`, `checkoutAttemptId`, `paypalRefundId`, tour + date + time, and `slug`.
- [ ] **Return 404 for bad tour IDs (#70).** A malformed ID fails Convex argument validation, and `getTourById` in `app/lib/tours.ts` rethrows it as a 500. The action reads `tour.startTimes` while `tour` can be null (`tour-booking.tsx`, around line 122).
- [ ] **Better error page (#71).** `ErrorBoundary` in `app/root.tsx` has no styling, no link back to the main site, and no contact details.
- [ ] **Redirect `/` in production (#72).** `app/routes/home.tsx` still shows the demo link. The manage page also redirects bad tokens to `/`. Send `/` to the WordPress tours page.
- [ ] **Gate CI (#73).** `.github/workflows/fly-deploy.yml` deploys every push to `main` without running `bun run typecheck` or `bun test`. It never deploys Convex functions, so the app and backend can drift apart. Add both checks and a `npx convex deploy` step with `CONVEX_DEPLOY_KEY`.
- [ ] **Handle refunds made in the PayPal dashboard (#74).** If the operator refunds from PayPal, for example for a weather cancellation, the Booking stays active. The webhook returns 503 for unknown refund IDs (`PAYMENT.CAPTURE.REFUNDED` in `app/routes/paypal-webhook.ts`), so PayPal retries for days. Return 200 for unknown refunds, and write down the manual process: refund in PayPal, then set `cancelled` in the Convex dashboard.
- [ ] **Cap name length (#75).** Add `.max(100)` to `bookerName` in `app/lib/booking-validation.ts`.
- [ ] **Success page copy (#76).** In `app/routes/checkout-success.tsx`, tell paid Bookers their manage link is in their email. The pending state never refreshes. Add a manual refresh or a short poll.
- [ ] **Avoid cold starts (#77).** `fly.toml` has `min_machines_running = 0`, so the first click from WordPress waits on a machine boot. Setting it to 1 costs a few dollars a month.
- [ ] **Error tracking, optional (#78).** Errors only go to Fly logs. A free Sentry project takes about 10 minutes to set up.

## Launch checklist (config, no code)

Tracked in #79.

- [ ] Create a production Convex deployment, separate from dev. Seed the real tours there after item 2 lands.
- [ ] Set the server secret from item 1 in the production Convex environment and in Fly secrets.
- [ ] Set up a live PayPal app:
  - live `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in Fly secrets
  - `PAYPAL_ENV=live` in Fly secrets
  - `VITE_PAYPAL_CLIENT_ID` and `VITE_PAYPAL_ENV=live` as GitHub repo variables (baked in at build time)
- [ ] Register a live PayPal webhook at `https://<prod-domain>/paypal/webhook` for these events:
  - `PAYMENT.CAPTURE.COMPLETED`
  - `PAYMENT.CAPTURE.DENIED`
  - `CHECKOUT.PAYMENT-APPROVAL.REVERSED`
  - `PAYMENT.CAPTURE.REFUNDED`
  - `PAYMENT.REFUND.FAILED`

  Then set `PAYPAL_WEBHOOK_ID`.
- [ ] Choose the final domain before launch, for example `book.cinematicsitesofsavannah.com`. `APP_ORIGIN` goes into PayPal return URLs and into manage links in sent emails, so changing it later breaks old links.
- [ ] Set `VITE_CONVEX_URL` to the production deployment in GitHub repo variables.
- [ ] Verify the sending domain in Resend (SPF and DKIM). Put `RESEND_FROM_EMAIL` on that domain and `RESEND_API_KEY` in Fly secrets.
- [ ] Send test emails to Gmail and Outlook and confirm they don't land in spam.
- [ ] Set `APP_ORIGIN` in Fly secrets.
- [ ] Run one real live-mode purchase at a low test price, then self-cancel it for a refund. Check webhook deliveries in the PayPal dashboard.
- [ ] Update the WordPress tour links to the production slugs from item 2.
- [ ] Add a privacy policy link to the footer. The app collects names, emails, and payments.

## Can wait

- Rate limiting the booking action. Each submit creates a Convex row and a PayPal order. At low volume, watch the logs instead.
- Durable, retryable Booking Communication (#54, #56).
- Admin dashboard and tour guide view (roadmap items 3 and 4).
- Apple Pay and Google Pay (#50).
- Holding seats during checkout. Two Bookers can still pay for the last spot, and the second one gets an automatic refund.
- Access tokens in request logs. `react-router-serve` logs full URLs, including `?token=`. Low risk for now.

## Open questions for the operator

Tracked in #58. Items 4 and 5 depend on these answers.

- [ ] Do tours run every day at every listed start time, or is the schedule seasonal?
- [ ] How late can someone book? Up to the start time, or a set number of hours before?
- [ ] How far ahead can people book?
- [ ] Who should receive new Booking and cancellation emails?
- [ ] Is "full refund up to 24 hours before the tour" final?
- [ ] Which support email and phone number should Bookers see?

## Suggested order

1. Item 1, Convex lockdown, in its own PR.
2. Item 2, stable tour links, before anyone writes WordPress links.
3. Items 3 and 9, content and copy.
4. Get answers to the open questions, then items 4, 5, and 8 together. They share the Eastern-time helper.
5. Items 6 and 7, operator notification and email failure alerts.
6. Should-do items, then the launch checklist, ending with the live test purchase.
