# Use PayPal Orders and Captures

This decision supersedes [ADR 0001: Use Stripe Checkout Attempts Before Bookings](./0001-stripe-checkout-attempts.md).

CSS Tours persists a Checkout Attempt before creating its PayPal Order. A pending Checkout Attempt records the selected tour, price, Booker details, expiry, and private access-token hash, but does not reserve capacity.

CSS Tours creates a Booking only after the server verifies a completed PayPal capture. Verification can come from the synchronous capture API response in the server action or a verified `PAYMENT.CAPTURE.COMPLETED` webhook. Return routes never create Bookings.

The completion path checks capacity again before creating the Booking. If the paid party no longer fits, CSS Tours creates no Booking and refunds the capture through the PayPal refund API. A `PENDING` capture leaves the Checkout Attempt pending until a verified webhook reports its final state.
