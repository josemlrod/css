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
    route('/stripe/webhook', 'routes/stripe-webhook.ts'),
    route('/manage/:bookingId', 'routes/manage-tour.tsx'),
  ]),
] satisfies RouteConfig;
