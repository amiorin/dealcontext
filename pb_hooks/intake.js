/// <reference path="../pb_data/types.d.ts" />
// Helpers for intake.pb.js. Every hook handler runs in its own runtime, so handlers load this with require().

const BODY_LIMIT = 16384; // bytes; equals the maxSize of enquiries.details
const COLUMNS = {name: 200, email: 254, utm_source: 200, utm_medium: 200, utm_campaign: 200};
const HONEYPOT = "website";
const KEY = /^[a-z0-9_]{1,40}$/, MAX_KEYS = 20, MAX_VALUE = 4000;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const DUPLICATE_SECONDS = 600, PER_EMAIL = 5; // per email inside the window; further ones are dropped like duplicates
// Rate limits are per client address, can be off, and an attacker can rotate addresses. This cap bounds what
// anonymous clients can store, whatever their addresses. DEALCONTEXT_INTAKE_HOURLY_CAP overrides the default.
const HOURLY_CAP = 200;
// Line breaks and other control characters have no place in a one-line value, and they would let a submitted
// name end a heredoc or fake extra lines in the notification email.
const CONTROL = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/;
const OK = JSON.stringify({ok: true});

// Same key order for equal objects, so two details values compare as strings.
function canonical(details) {
  const out = {};
  for (const key of Object.keys(details).sort()) out[key] = details[key];
  return JSON.stringify(out);
}

// Splits the body into columns and details. Throws a 400 that names every rejected key.
function parse(body) {
  const errors = {}, messages = [], columns = {}, details = {};
  const fail = (field, code, message) => {
    messages.push(message);
    errors[field] = errors[field] || new ValidationError(code, message);
  };
  for (const field in COLUMNS) {
    const value = body[field] === undefined || body[field] === null ? "" : body[field];
    if (typeof value !== "string") {
      fail(field, "validation_invalid_type", field + " must be a string");
      continue;
    }
    columns[field] = value.trim();
    if (CONTROL.test(columns[field])) {
      fail(field, "validation_invalid_characters", field + " must not contain line breaks or control characters");
    } else if (columns[field].length > COLUMNS[field]) {
      fail(field, "validation_max_text_constraint", field + " must be at most " + COLUMNS[field] + " characters");
    }
  }
  for (const field of ["name", "email"]) {
    if (columns[field] === "") fail(field, "validation_required", field + " is required");
  }
  if (columns.email && !errors.email && !EMAIL.test(columns.email)) {
    fail("email", "validation_is_email", "email must be a valid email address");
  }
  const keys = Object.keys(body).filter((key) => !Object.prototype.hasOwnProperty.call(COLUMNS, key) && key !== HONEYPOT);
  if (keys.length > MAX_KEYS) {
    fail("details", "validation_too_many_keys", "details: at most " + MAX_KEYS + " keys besides name, email, and the utm keys are accepted");
  }
  for (const key of keys.slice(0, MAX_KEYS)) {
    const shown = JSON.stringify(key.slice(0, 40));
    if (!KEY.test(key) || key === "__proto__") {
      fail("details." + key.slice(0, 40), "validation_invalid_key", "key " + shown + " must match [a-z0-9_]{1,40}");
    } else if (typeof body[key] !== "string") {
      fail("details." + key, "validation_invalid_type", "key " + shown + " must be a string");
    } else if (body[key].length > MAX_VALUE) {
      fail("details." + key, "validation_max_text_constraint", "key " + shown + " must be at most " + MAX_VALUE + " characters");
    } else {
      details[key] = body[key];
    }
  }
  if (messages.length) throw new BadRequestError(messages.join("; "), errors);
  return {columns, details: canonical(details)};
}

// POST /api/intake/enquiry. The response never carries the record or the input.
function enquiry(e) {
  // The length is declared so the response is complete for the client as soon as it is flushed.
  const ok = () => {
    e.response.header().set("Content-Type", "application/json");
    e.response.header().set("Content-Length", String(OK.length));
    return e.string(200, OK);
  };
  const type = String(e.request.header.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new ApiError(415, "Content-Type must be application/json.", {});
  let raw, body;
  try {
    raw = toString(e.request.body); // the body limit middleware ends the read at BODY_LIMIT
  } catch (error) {
    throw new ApiError(413, "Request entity too large.", {});
  }
  try {
    body = JSON.parse(raw);
  } catch (error) {
    throw new BadRequestError("The request body must be a JSON object.", {});
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("The request body must be a JSON object.", {});
  }
  // Honeypot: a filled hidden field gets the success response and nothing is stored.
  if (body[HONEYPOT] !== undefined && body[HONEYPOT] !== null && body[HONEYPOT] !== "") return ok();

  const {columns, details} = parse(body);
  const since = new Date(Date.now() - DUPLICATE_SECONDS * 1000).toISOString().replace("T", " ");
  const hour = new Date(Date.now() - 3600 * 1000).toISOString().replace("T", " ");
  const cap = parseInt($os.getenv("DEALCONTEXT_INTAKE_HOURLY_CAP"), 10) > 0 ? parseInt($os.getenv("DEALCONTEXT_INTAKE_HOURLY_CAP"), 10) : HOURLY_CAP;
  let id = "", full = false;
  // One transaction, so two identical submissions that arrive together store one row.
  const store = () => e.app.runInTransaction((txApp) => {
    const recent = txApp.findRecordsByFilter("enquiries", "email = {:email} && created >= {:since}", "-created", PER_EMAIL, 0,
      {email: columns.email, since: since});
    if (recent.length >= PER_EMAIL) return;
    for (const row of recent) {
      if (canonical(JSON.parse(row.getString("details") || "{}")) === details) return;
    }
    if (txApp.countRecords("enquiries", $dbx.exp("created >= {:hour}", {hour: hour})) >= cap) {
      full = true;
      return;
    }
    const record = new Record(txApp.findCollectionByNameOrId("enquiries"));
    for (const field in columns) record.set(field, columns[field]);
    record.set("status", "new");
    record.set("source", String(e.request.header.get("Origin") || "").slice(0, 200));
    record.set("details", details);
    txApp.save(record);
    id = record.id;
  });
  try {
    store();
  } catch (error) {
    // A value that passed the checks above and failed the collection's own field validation.
    let fields = {};
    try { fields = JSON.parse(JSON.stringify(error.value)) || {}; } catch (_) {}
    const names = Object.keys(fields).filter((field) => typeof fields[field] === "string");
    if (names.length === 0) throw error;
    const errors = {};
    for (const field of names) errors[field] = new ValidationError("validation_invalid_value", field + ": " + fields[field]);
    throw new BadRequestError(names.map((field) => field + ": " + fields[field]).join("; "), errors);
  }
  if (full) throw new ApiError(429, "Too many enquiries were received in the last hour. Try again later.", {});
  // The response is sent before the email, so a slow or failing mail server cannot delay or fail the request.
  ok();
  e.flush();
  if (id) notify(e.app, id, columns);
}

// Optional operator email: name, email, and record id, never the free text.
function notify(app, id, columns) {
  try {
    const to = String($os.getenv("DEALCONTEXT_INTAKE_NOTIFY") || "").trim();
    if (!to || !app.settings().smtp.enabled) return;
    const plain = (value) => value.replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]+/g, " ");
    app.newMailClient().send(new MailerMessage({
      from: {address: app.settings().meta.senderAddress, name: app.settings().meta.senderName},
      to: [{address: to}],
      subject: "New enquiry",
      text: "A new enquiry was stored.\n\nName: " + plain(columns.name) + "\nEmail: " + plain(columns.email) + "\nRecord: enquiries/" + id + "\n",
    }));
  } catch (error) {
    app.logger().error("intake: the notification email was not sent", "record", id, "error", String(error));
  }
}

module.exports = {enquiry, BODY_LIMIT};
