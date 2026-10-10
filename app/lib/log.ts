// One JSON line per step of the Booker's journey, so Fly logs can be filtered by event or id:
//   fly logs | grep '"bookingId":"<id>"'
// Never log access tokens, emails, or names. Ids are enough to find the rest in the console.
type Details = Record<string, unknown>;

export function logEvent(event: string, details: Details = {}) {
  console.log(JSON.stringify({ level: 'info', event, ...details }));
}

// PayPal API errors carry the status code and response body (issue, debug_id) in their message.
export function logError(event: string, error: unknown, details: Details = {}) {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      ...details,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { message: String(error) },
    }),
  );
}
