import { redirect } from 'react-router';

import { convexAuthAction } from '~/lib/convex.server';
import {
  readOperatorTokens,
  serializeOperatorSession,
} from '~/lib/operator-session.server';

import { api } from '../../../convex/_generated/api';
import type { Route } from './+types/logout';

export function loader() {
  return redirect('/admin');
}

export async function action({ request }: Route.ActionArgs) {
  const tokens = await readOperatorTokens(request);

  // Ends the Convex Auth session too, so a copied cookie stops working.
  if (tokens) await convexAuthAction(api.auth.signOut, {}, tokens.token).catch(() => {});

  return redirect('/admin/login', {
    headers: { 'Set-Cookie': await serializeOperatorSession(null) },
  });
}
