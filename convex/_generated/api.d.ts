/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as checkoutAttempts from "../checkoutAttempts.js";
import type * as http from "../http.js";
import type * as lib_authEmail from "../lib/authEmail.js";
import type * as lib_operators from "../lib/operators.js";
import type * as lib_serverFunctions from "../lib/serverFunctions.js";
import type * as operators from "../operators.js";
import type * as tours from "../tours.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookings: typeof bookings;
  checkoutAttempts: typeof checkoutAttempts;
  http: typeof http;
  "lib/authEmail": typeof lib_authEmail;
  "lib/operators": typeof lib_operators;
  "lib/serverFunctions": typeof lib_serverFunctions;
  operators: typeof operators;
  tours: typeof tours;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
