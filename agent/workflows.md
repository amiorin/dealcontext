# Workflows

## Start a pipeline

Create a pipeline with `active: true`, then stages with distinct positions. Choose names and stage probabilities with the user. There are no seeded business records.

## Create a deal

Find the organization and person by SQL. Resolve ambiguous matches before writing. Reuse existing records or create missing contacts through the records API. Find the target stage and create a deal with title, stage, owner, value_minor, currency, and status `open`. Create the next activity if the user requested a follow-up.

## Move or close a deal

Look up the deal and destination stage IDs. PATCH the deal's `stage`; moving to a stage in another pipeline also changes its pipeline. To close a deal, PATCH status to `won` or `lost`, set `closed_at` to the current UTC time, and provide `lost_reason` when appropriate. Reopening a deal should clear `closed_at` and `lost_reason`. These date/status conventions are agent responsibilities in this version, not server-enforced invariants.

## Follow up

Translate relative dates using the user's timezone and store UTC. Create an activity with subject, kind, owner, due_at, and the relevant relations. To complete it, set `done: true` and `completed_at`. Recording or completing an email activity does not send a message.

## Record evidence

Write notes linked to their deal, person, or organization. Preserve the source URL when available. Distinguish a customer's statement from an inference. Notes and activities provide interaction history; stage changes are not automatically audited.

## Retry safely

Read current state after a timeout before retrying writes. Several REST requests are not one transaction. If a deal was created but its activity failed, keep the deal and retry only the missing activity. Tell the user about partial results.
