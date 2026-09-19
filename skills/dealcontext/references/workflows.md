# Workflows

Field names and server rules are in [schema.md](schema.md). Requests and `dc.py` commands are in [examples.md](examples.md).

## Start a pipeline

Create the pipeline with `active: true` and its stages in one batch: choose the pipeline id with `dc.py newid` and use it in each stage's `pipeline`. Always send `position`, numbered 1, 2, 3 in pipeline order; an omitted position is stored as 0 and the second such stage fails the unique index. Choose names and stage probabilities with the user. There are no seeded business records.

## Create a deal

Find the organization and person by SQL. Resolve ambiguous matches before writing. Reuse existing records. Find the target stage. A deal needs title, stage, owner, currency, and status `open`. Send `value_minor` when the value is known; an omitted value is stored as 0, which reads the same as a zero-value deal. If the user gives no currency, ask; do not guess.

Write the deal and everything that belongs to it in one batch (`POST /api/batch`, or `dc.py batch`): missing contacts first, then the deal, then its first activity if the user requested a follow-up, then a note if there is evidence to record. Choose the id of each new record that a later request refers to: take a 15-character `[a-z0-9]` id from `dc.py newid`, send it as `id` in the create body, and use it in the later relations. A batch holds at most 20 requests and is one transaction: either every record is saved, with one `audit_log` row each, or none is. When a batch fails, the response names the failed request and its error; fix that request and send the whole batch again.

## Move or close a deal

Look up the deal and destination stage IDs. PATCH the deal's `stage`; moving to a stage in another pipeline also changes its pipeline. To close a deal, PATCH status to `won` or `lost`. The server sets `closed_at` to the current UTC time when you leave it empty; send `closed_at` yourself only when the deal closed at a different time. Provide `lost_reason` when the deal is lost and the reason is known. A won deal cannot have a `lost_reason`. To reopen a deal, PATCH `status: open` together with `closed_at: ""` and `lost_reason: ""`; the server does not clear them and rejects the request otherwise. These rules are server-enforced and violations return HTTP 400.

## Follow up

Translate relative dates using the user's timezone and store UTC. Create an activity with subject, kind, owner, due_at, and the relevant relations. To complete it, set `done: true`. The server sets `completed_at` to the current UTC time when you leave it empty; send it yourself to record a different time. To mark it not done again, PATCH `done: false` together with `completed_at: ""`. When you set both `person` and `organization` on a deal, activity, or note, use the person's own organization or the server rejects the write. If a person moves to another organization, later edits to their deals, activities, and notes that still name the old organization are rejected until the same PATCH sends the new `organization`. Recording or completing an email activity does not send a message.

## Record evidence

Write notes linked to their deal, person, or organization; the server rejects a note with none of the three. Preserve the source URL when available. Distinguish a customer's statement from an inference. Notes and activities provide interaction history; record changes, including stage moves, are in `audit_log`.

## Review history

Query `audit_log` by `collection` and `record` to see who changed a record and when. Each row has `action`, `actor` (agent ID, empty for a superuser), `actor_type`, `created`, and a `changes` JSON with the before and after values of the changed fields. For a deal's stage history, select rows where `json_extract(changes, '$.after.stage')` is not NULL, ordered by `created`; the first row is the deal's creation unless the deal existed before the log was added. Join stage IDs to `stages` for names. Filter by `actor` and `created` to list one agent's recent writes. Agent accounts are not SQL-readable, so ask the operator to map an unfamiliar actor ID to an agent. The log is append-only for agents; do not try to correct it.

## Retry safely

Read current state after a timeout before retrying writes: the write may have been saved. A client-chosen id makes this check exact, because `get` on that id shows whether the record exists, and a repeated create with the same id is rejected instead of making a duplicate. On HTTP 409 (`dc.py` exit code 4) another request changed the record first: read it again, confirm your change still applies, and retry.

A batch is atomic, so a failed batch saved nothing and can be sent again after the fix. Several requests outside a batch are not one transaction and can partially succeed. If a deal was created but its activity failed, keep the deal and retry only the missing activity. Tell the user about partial results. Agents cannot delete, so a duplicate created by a blind retry stays until the operator deletes it. Report the duplicate's collection and record ID to the user, and until it is removed mark it so it is not mistaken for live work, for example close a duplicate deal as `lost` with `lost_reason` "duplicate" or complete a duplicate activity.
