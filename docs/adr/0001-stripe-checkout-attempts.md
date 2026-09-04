# Use Stripe Checkout Attempts Before Bookings

Superseded by [ADR 0002: Use PayPal Orders and Captures](./0002-paypal-orders-capture.md).

CSS Tours will persist **Checkout Attempts** before redirecting Bookers to Stripe Checkout, but will create **Bookings** only from verified Stripe webhook completion. Pending Checkout Attempts do not reserve capacity; capacity is checked again when payment succeeds, and a successful payment that no longer fits capacity is automatically refunded without creating a Booking. This avoids unpaid Bookings and abandoned capacity holds while keeping enough internal state to reconcile Stripe webhooks, refunds, and private no-login access through hashed access tokens.
