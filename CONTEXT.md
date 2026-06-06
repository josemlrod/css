# CSS Tours

CSS Tours handles tour booking flows for people reserving guided tours.

## Language

**Booker**:
A person who provides contact information and receives booking communication.
_Avoid_: User

**Checkout Attempt**:
A temporary record of selected tour details and payment state before a **Booking** exists.
_Avoid_: Booking

**Booking**:
A paid reservation for a specific tour date, time, and party size.
_Avoid_: Checkout Attempt

**Booking Communication**:
A message sent to a **Booker** about a **Checkout Attempt** or **Booking**.
_Avoid_: Confirmation

**Booking Status**:
Whether a **Booking** is active or canceled.
_Avoid_: Payment Status

**Payment Status**:
Whether payment or refund activity for a **Checkout Attempt** or **Booking** is pending, paid, refunded, or failed.
_Avoid_: Booking Status

## Relationships

- A **Booker** provides contact information for a tour booking.
- A **Checkout Attempt** records selected tour details and payment state before payment succeeds.
- A **Checkout Attempt** becomes a **Booking** only after successful payment.
- A **Booking** is complete when payment succeeds.
- **Booking Status** describes whether a paid Booking should count as active.
- **Payment Status** describes payment and refund progress separately from Booking Status.
- **Booking Communication** is sent to the **Booker** email address for relevant Checkout Attempt and Booking outcomes.

## Example dialogue

> **Dev:** "Should the **Booker** receive the confirmation email?"
> **Domain expert:** "Yes — send booking communication to the **Booker** email address."

## Flagged ambiguities

- "user" was used for the person receiving booking email — resolved: use **Booker** because no authenticated user exists in this flow.
- "confirmation" was used for both a **Booking** and booking communication — resolved: use **Booking** for the reservation request.
- "booking" was used for both pre-payment tour details and paid reservations — resolved: use **Checkout Attempt** before payment succeeds and **Booking** after payment succeeds.
