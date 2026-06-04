# CSS Tours

CSS Tours handles tour booking flows for people reserving guided tours.

## Language

**Booker**:
A person who provides contact information and receives booking communication.
_Avoid_: User

**Booking**:
A reservation request for a specific tour date, time, and party size.
_Avoid_: Confirmation

**Booking Communication**:
A message sent to a **Booker** about a **Booking**.
_Avoid_: Confirmation

## Relationships

- A **Booker** provides contact information for a tour booking.
- A **Booking** is complete when the **Booker** confirms the reviewed booking details.
- **Booking Communication** is sent to the **Booker** email address.

## Example dialogue

> **Dev:** "Should the **Booker** receive the confirmation email?"
> **Domain expert:** "Yes — send booking communication to the **Booker** email address."

## Flagged ambiguities

- "user" was used for the person receiving booking email — resolved: use **Booker** because no authenticated user exists in this flow.
- "confirmation" was used for both a **Booking** and booking communication — resolved: use **Booking** for the reservation request.
