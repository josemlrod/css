import { data } from 'react-router';

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);

  if (
    url.pathname.startsWith('/.well-known/') ||
    url.pathname === '/robots.txt' ||
    url.pathname === '/favicon.ico'
  ) {
    throw data(null, { status: 404 });
  }

  throw data('Not Found', {
    status: 404,
    statusText: 'The requested page could not be found.',
  });
}
