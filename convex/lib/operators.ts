// OPERATOR_ALLOWED_EMAILS on the Convex deployment is a comma-separated list of
// the only emails that can create an Operator account or use the operator console.
export function isOperatorEmail(email: string | undefined) {
  if (!email) return false;

  const allowed = (process.env.OPERATOR_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}
