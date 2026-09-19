# API examples

The examples assume `BASE_URL` is the server address and `TOKEN` is a token obtained from `POST /api/collections/agents/auth-with-password` with `{ "identity": "agent@example.com", "password": "..." }`. Never save real credentials in this file.

Read the schema:

```sh
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
```

All recorded changes to one record, newest first:

```sql
SELECT created, action, actor, actor_type, changes
FROM audit_log
WHERE collection = 'deals' AND record = '<deal-id>'
ORDER BY created DESC
LIMIT 50
```

Submit plain SQL in JSON:

```sh
curl --fail-with-body "$BASE_URL/api/context/query" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  --data '{"sql":"SELECT id, title, currency, value_minor FROM deals WHERE status = '\''open'\'' LIMIT 50"}'
```

Write with the PocketBase records API. Replace the example IDs with IDs read from this workspace:

```http
POST /api/collections/deals/records
Authorization: <agent-token>
Content-Type: application/json

{"title":"Acme renewal","stage":"<stage-id>","organization":"<organization-id>","owner":"<agent-id>","value_minor":250000,"currency":"USD","status":"open"}
```

```http
PATCH /api/collections/deals/records/<deal-id>
Authorization: <agent-token>
Content-Type: application/json

{"stage":"<negotiation-stage-id>"}
```

```http
POST /api/collections/activities/records
Authorization: <agent-token>
Content-Type: application/json

{"subject":"Follow up with Acme","kind":"call","deal":"<deal-id>","owner":"<agent-id>","due_at":"2026-09-25 09:00:00.000Z","done":false}
```

Close a deal as lost. The server fills `closed_at`:

```http
PATCH /api/collections/deals/records/<deal-id>
Authorization: <agent-token>
Content-Type: application/json

{"status":"lost","lost_reason":"Chose a competitor"}
```

Reopen it. Both fields must be cleared in the same request:

```http
PATCH /api/collections/deals/records/<deal-id>
Authorization: <agent-token>
Content-Type: application/json

{"status":"open","closed_at":"","lost_reason":""}
```

Do not send `created_by` or `updated_by`, and do not send DELETE requests; agents cannot delete records.

Use HTTP clients that encode JSON correctly. For SQL literals, use a trusted SQL literal encoder rather than interpolating raw user text. Check the response's truncation indicator and use ordered pagination when needed.
