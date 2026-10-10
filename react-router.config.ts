import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // Lets /admin check the Operator session once, before any of its loaders or actions run.
  future: { v8_middleware: true },
} satisfies Config;
