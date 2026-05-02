/**
 * CRA TypeScript ambient declarations: react-scripts shims, CSS modules, and Firebase env keys.
 */
/// <reference types="react-scripts" />

declare module "*.css";

declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_FIREBASE_API_KEY?: string;
    readonly REACT_APP_FIREBASE_AUTH_DOMAIN?: string;
    readonly REACT_APP_FIREBASE_PROJECT_ID?: string;
    /** Demo unlock passcode (optional; dev fallback in `data/demoAccess.ts`). */
    readonly REACT_APP_DEMO_ACCESS_CODE?: string;
  }
}
