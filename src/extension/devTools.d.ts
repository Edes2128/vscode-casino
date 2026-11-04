/**
 * True in development and test builds, false in the packaged extension. The build (scripts/build-extension.mjs)
 * replaces it with a literal, so everything behind `if (__DEV_TOOLS__)` is deleted from what ships: the
 * dev-server probing (an HTTP client) and the test API (which hands out the wallet). Nothing here can be
 * switched on by an environment variable in an installed extension, because the code is not there.
 */
declare const __DEV_TOOLS__: boolean;
