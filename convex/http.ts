import { httpRouter } from 'convex/server';

import { auth } from './auth';

const http = httpRouter();

// Serves the JWKS Convex uses to verify Operator session tokens.
auth.addHttpRoutes(http);

export default http;
