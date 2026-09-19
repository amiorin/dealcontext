# Workflows

## Start a pipeline

Create a pipeline with `active: true`, then stages with distinct positions. Choose names and stage probabilities with the user. There are no seeded business records.

## Create a deal

Find the organization and person by SQL. Resolve ambiguous matches before writing. Reuse existing records or create missing contacts through the records API. Find the target stage and create a deal with title, stage, owner, value_minor, currency, and status `open`. Create the next activity if the user requested a follow-up.

## Move or close a deal

Look up the deal and destination stage IDs. PATCH the deal's `stage`; moving to a stage in another pipeline also changes its pipeline. To close a deal, PATCH status to `won` or `lost`. The server sets `closed_at` to the current UTC time when you leave it empty; send `closed_at` yourself only when the deal closed at a different time. Provide `lost_reason` when the deal is lost and the reason is known. A won deal cannot have a `lost_reason`. To reopen a deal, PATCH `status: open` together with `closed_at: ""` and `lost_reason: ""`; the server does not clear them and rejects the request otherwise. These rules are server-enforced and violations return HTTP 400.

## Follow up

Translate relative dates using the user's timezone and store UTC. Create an activity with subject, kind, owner, due_at, and the relevant relations. To complete it, set `done: true`. The server sets `completed_at` to the current UTC time when you leave it empty; send it yourself to record a different time. To mark it not done again, PATCH `done: false` together with `completed_at: ""`. When you set both `person` and `organization` on a deal, activity, or note, use the person's own organization or the server rejects the write. If a person moves to another organization, later edits to their deals, activities, and notes that still name the old organization are rejected until the same PATCH sends the new `organization`. Recording or completing an email activity does not send a message.

## Record evidence

Write notes linked to their deal, person, or organization; the server rejects a note with none of the three. Preserve the source URL when available. Distinguish a customer's statement from an inference. Notes and activities provide interaction history; record changes, including stage moves, are in `audit_log`.

## Review history

Query `audit_log` by `collection` and `record` to see who changed a record and when. Each row has `action`, `actor` (agent ID, empty for a superuser), `actor_type`, `created`, and a `changes` JSON with the before and after values of the changed fields. For a deal's stage history, select rows where `json_extract(changes, '$.after.stage')` is not NULL, ordered by `created`; the first row is the deal's creation unless the deal existed before the log was added. Join stage IDs to `stages` for names. Filter by `actor` and `created` to list one agent's recent writes. Agent accounts are not SQL-readable, so ask the operator to map an unfamiliar actor ID to an agent. The log is append-only for agents; do not try to correct it.

## Retry safely

Read current state after a timeout before retrying writes. On HTTP 409 another request changed the record first: read it again, confirm your change still applies, and retry. Several REST requests are not one transaction. If a deal was created but its activity failed, keep the deal and retry only the missing activity. Tell the user about partial results. Agents cannot delete, so a duplicate created by a blind retry stays until the operator deletes it. Report the duplicate's collection and record ID to the user, and until it is removed mark it so it is not mistaken for live work, for example close a duplicate deal as `lost` with `lost_reason` "duplicate" or complete a duplicate activity.
