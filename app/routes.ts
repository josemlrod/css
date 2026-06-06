import { type RouteConfig, route, layout } from '@react-router/dev/routes';

export default [
  layout('routes/layout.tsx', [
    route('/tour/:tourId', 'routes/tour-booking.tsx'),
    route('/manage/:bookingId', 'routes/manage-tour.tsx'),
  ]),
] satisfies RouteConfig;
