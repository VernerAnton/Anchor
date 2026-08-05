/// <reference types="vite/client" />

/**
 * Build identity, substituted by Vite's `define` at build time. These are not
 * variables the app can change — by the time the bundle exists they are string
 * literals in the source.
 */
declare const __BUILD_SHA__: string;
declare const __BUILD_REF__: string;
declare const __BUILD_TIME__: string;
