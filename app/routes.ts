import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('/tour/:tourId', 'routes/tour-booking.tsx'),
] satisfies RouteConfig;
