# API examples

Each example is shown as a `dc.py` command and as the HTTP request it sends. `dc.py` is `scripts/dc.py` in this skill; it logs in with the three `DEALCONTEXT_` environment variables and caches the token. The HTTP examples assume `BASE_URL` is the server address and `TOKEN` is a token obtained from `POST /api/collections/agents/auth-with-password` with `{ "identity": "agent@example.com", "password": "..." }`. Never save real credentials in a file. Field names and rules are in [schema.md](schema.md); the order of steps is in [workflows.md](workflows.md).

## Read

Your agent ID, which is the value for `owner`:

```sh
dc.py whoami
```

Read the schema:

```sh
dc.py schema
curl --fail-with-body "$BASE_URL/api/context/schema" -H "Authorization: $TOKEN"
```

Open deals without an upcoming activity:

```sql
SELECT d.id, d.title, d.value_minor, d.currency, s.name AS stage,
       p.name AS pipeline, o.name AS organization
FROM deals d
JOIN stages s ON s.id = d.stage
JOIN pipelines p ON p.id = s.pipeline
LEFT JOIN organizations o ON o.id = d.organization
WHERE d.status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM activities a
    WHERE a.deal = d.id AND a.done = 0
      AND a.due_at >= strftime('%Y-%m-%d %H:%M:%fZ', 'now')
  )
ORDER BY d.updated DESC
LIMIT 50
```

Stage history of one deal from `audit_log`. A `create` row has a NULL `from_stage`. A deal that existed before the log was added starts with an `update` row. A stage name is NULL if the operator deleted that stage:

```sql
SELECT a.created, a.action, a.actor, a.actor_type,
       f.name AS from_stage, t.name AS to_stage
FROM audit_log a
LEFT JOIN stages f ON f.id = json_extract(a.changes, '$.before.stage')
LEFT JOIN stages t ON t.id = json_extract(a.changes, '$.after.stage')
WHERE a.collection = 'deals' AND a.record = '<deal-id>'
  AND json_extract(a.changes, '$.after.stage') IS NOT NULL
ORDER BY a.created
LIMIT 200
```

All recorded changes to one record, newest first:

```sql
SELECT created, action, actor, actor_type, changes
FROM audit_log
WHERE collection = 'deals' AND record = '<deal-id>'
ORDER BY created DESC
LIMIT 50
```

Run a query. Pass SQL that contains single quotes on standard input. Over HTTP, submit plain SQL in JSON:

```sh
dc.py sql - <<'SQL'
SELECT id, title, currency, value_minor FROM deals WHERE status = 'open' LIMIT 50
SQL
curl --fail-with-body "$BASE_URL/api/context/query" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  --data '{"sql":"SELECT id, title, currency, value_minor FROM deals WHERE status = '\''open'\'' LIMIT 50"}'
```

The response is `{"columns": [...], "rows": [[...], ...], "truncated": false}`. SQL NULL is JSON `null`; an empty optional field is `""`. When `truncated` is true the rows are incomplete and `dc.py` prints a `WARNING` line on stderr.

## Write one record

Write with the PocketBase records API. Replace the example IDs with IDs read from this workspace:

```sh
dc.py create deals '{"title":"Acme renewal","stage":"<stage-id>","organization":"<organization-id>","owner":"<agent-id>","value_minor":250000,"currency":"USD","status":"open"}'
```

```http
POST /api/collections/deals/records
Authorization: <agent-token>
Content-Type: application/json

{"title":"Acme renewal","stage":"<stage-id>","organization":"<organization-id>","owner":"<agent-id>","value_minor":250000,"currency":"USD","status":"open"}
```

Move a deal to another stage:

```sh
dc.py update deals <deal-id> '{"stage":"<negotiation-stage-id>"}'
```

```http
PATCH /api/collections/deals/records/<deal-id>
Authorization: <agent-token>
Content-Type: application/json

{"stage":"<negotiation-stage-id>"}
```

Add a follow-up to an existing deal:

```sh
dc.py create activities '{"subject":"Follow up with Acme","kind":"call","deal":"<deal-id>","owner":"<agent-id>","due_at":"2026-09-25 09:00:00.000Z","done":false}'
```

```http
POST /api/collections/activities/records
Authorization: <agent-token>
Content-Type: application/json

{"subject":"Follow up with Acme","kind":"call","deal":"<deal-id>","owner":"<agent-id>","due_at":"2026-09-25 09:00:00.000Z","done":false}
```

Close a deal as lost. The server fills `closed_at`:

```sh
dc.py update deals <deal-id> '{"status":"lost","lost_reason":"Chose a competitor"}'
```

```http
PATCH /api/collections/deals/records/<deal-id>
Authorization: <agent-token>
Content-Type: application/json

{"status":"lost","lost_reason":"Chose a competitor"}
```

Reopen it. Both fields must be cleared in the same request:

```sh
dc.py update deals <deal-id> '{"status":"open","closed_at":"","lost_reason":""}'
```

```http
PATCH /api/collections/deals/records/<deal-id>
Authorization: <agent-token>
Content-Type: application/json

{"status":"open","closed_at":"","lost_reason":""}
```

Read one record back:

```sh
dc.py get deals <deal-id>
curl --fail-with-body "$BASE_URL/api/collections/deals/records/<deal-id>" -H "Authorization: $TOKEN"
```

## Write several records in one batch

A batch is one transaction of at most 20 requests. This one creates a deal, its first activity, and a note. The deal's ID is chosen by the client (`dc.py newid` prints one: 15 characters of `[a-z0-9]`) so that the later requests can refer to it:

```sh
dc.py newid
dc.py batch - <<'JSON'
[
  {"method":"POST","url":"/api/collections/deals/records","body":{"id":"<new-deal-id>","title":"Acme renewal","stage":"<stage-id>","organization":"<organization-id>","owner":"<agent-id>","value_minor":250000,"currency":"USD","status":"open"}},
  {"method":"POST","url":"/api/collections/activities/records","body":{"subject":"Follow up with Acme","kind":"call","deal":"<new-deal-id>","owner":"<agent-id>","due_at":"2026-09-25 09:00:00.000Z"}},
  {"method":"POST","url":"/api/collections/notes/records","body":{"body":"Customer asked for a renewal quote.","deal":"<new-deal-id>","owner":"<agent-id>"}}
]
JSON
```

Over HTTP the array is the value of `requests`:

```http
POST /api/batch
Authorization: <agent-token>
Content-Type: application/json

{"requests":[{"method":"POST","url":"/api/collections/deals/records","body":{"id":"<new-deal-id>","title":"Acme renewal","stage":"<stage-id>","owner":"<agent-id>","value_minor":250000,"currency":"USD","status":"open"}},{"method":"POST","url":"/api/collections/activities/records","body":{"subject":"Follow up with Acme","kind":"call","deal":"<new-deal-id>","owner":"<agent-id>","due_at":"2026-09-25 09:00:00.000Z"}}]}
```

A successful batch returns HTTP 200 and one `{"status":200,"body":{...record...}}` per request, in request order. Use `"method":"PATCH"` with a record URL to update inside a batch.

If one request fails, the whole batch returns HTTP 400 and nothing is saved, including `audit_log` rows. The failed request's own error is under `data.requests.<index>.response`, and `dc.py` prints `Failed request index <index>` with its message:

```json
{"status":400,"message":"Batch transaction failed.","data":{"requests":{"1":{"code":"batch_request_failed","message":"Batch request failed.","response":{"status":400,"message":"At least one of deal, person, organization must be set.","data":{}}}}}}
```

## Notes

Do not send `created_by` or `updated_by`, and do not send DELETE requests; agents cannot delete records. `dc.py create` and `dc.py update` remove the two fields from the body and say so on stderr.

Use HTTP clients that encode JSON correctly. For SQL literals, use a trusted SQL literal encoder rather than interpolating raw user text. Check the response's truncation indicator and use ordered pagination when needed.
