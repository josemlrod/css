import {
  type RouteConfig,
  route,
  layout,
  index,
} from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  layout('routes/layout.tsx', [
    route('/tour/:tourId', 'routes/tour-booking.tsx'),
    route(
      '/checkout/success/:checkoutAttemptId',
      'routes/checkout-success.tsx',
    ),
    route('/checkout/cancel/:checkoutAttemptId', 'routes/checkout-cancel.tsx'),
    route('/paypal/capture/:checkoutAttemptId', 'routes/paypal-capture.ts'),
    route('/paypal/webhook', 'routes/paypal-webhook.ts'),
    route('/manage/:bookingId', 'routes/manage-tour.tsx'),
  ]),
] satisfies RouteConfig;
