import { type RouteConfig, route, layout } from '@react-router/dev/routes';

export default [
  layout('routes/layout.tsx', [
    route('/tour/:tourId', 'routes/tour-booking.tsx'),
    route('/checkout/success/:checkoutAttemptId', 'routes/checkout-success.tsx'),
    route('/checkout/cancel/:checkoutAttemptId', 'routes/checkout-cancel.tsx'),
    route('/manage/:bookingId', 'routes/manage-tour.tsx'),
  ]),
] satisfies RouteConfig;
