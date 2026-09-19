/// <reference path="../pb_data/types.d.ts" />
// Public enquiry form endpoint. The logic is in intake.js; handlers cannot see file-level variables.

// Unauthenticated. The body limit replaces the default 32 MB limit for this route. Successful requests are kept out
// of the request log, which would otherwise hold the client address and user agent next to the time of the enquiry.
routerAdd("POST", "/api/intake/enquiry", (e) => require(`${__hooks}/intake.js`).enquiry(e),
  $apis.bodyLimit(require(`${__hooks}/intake.js`).BODY_LIMIT), $apis.skipSuccessActivityLog());
