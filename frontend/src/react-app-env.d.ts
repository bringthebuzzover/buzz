/**
 * CRA TypeScript ambient declarations: react-scripts shims and CSS modules.
 */
/// <reference types="react-scripts" />

declare module "@brandEmails" {
  const brandEmails: {
    emailFrom: string;
    contactEmail: string;
    opsCcEmail: string;
  };
  export default brandEmails;
}

declare module "*.css";

declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL for the Buzz backend API. */
    readonly REACT_APP_API_URL?: string;
  }
}
