import {
  type RouteConfig,
  route,
  layout,
  index,
  prefix,
} from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  layout('routes/layout.tsx', [
    route('/tour/:slug', 'routes/tour-booking.tsx'),
    route(
      '/checkout/success/:checkoutAttemptId',
      'routes/checkout-success.tsx',
    ),
    route('/checkout/cancel/:checkoutAttemptId', 'routes/checkout-cancel.tsx'),
    route('/paypal/capture/:checkoutAttemptId', 'routes/paypal-capture.ts'),
    route('/paypal/webhook', 'routes/paypal-webhook.ts'),
    route('/manage/:bookingId', 'routes/manage-tour.tsx'),
  ]),
  // Operator console. Open for now; needs operator sign-in before launch.
  ...prefix('admin', [
    layout('routes/admin/layout.tsx', [
      index('routes/admin/index.ts'),
      route('bookings', 'routes/admin/bookings.tsx', [
        route(':bookingId', 'routes/admin/booking.tsx'),
      ]),
      route('tours', 'routes/admin/tours.tsx'),
      route('closed-dates', 'routes/admin/closed-dates.tsx'),
    ]),
  ]),
  route('*', 'routes/$.tsx'),
] satisfies RouteConfig;
