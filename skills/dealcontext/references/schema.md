# Schema

Every CRM record has `id`, `created`, `updated`, `created_by`, and `updated_by`. IDs are PocketBase record IDs: 15 characters from `[a-z0-9]`. The server generates one unless a create sends its own `id`, which a batch uses to link new records (see [workflows.md](workflows.md)). Dates use UTC strings, for example `2026-09-19 14:00:00.000Z`. A date-only value such as `2026-12-31` is accepted and stored as midnight UTC. Missing optional numbers are stored as 0 and missing bools as false; in SQL a bool compares as `0` or `1` and comes back as JSON `true` or `false`. Missing optional strings, dates, and relations are empty strings, not SQL NULL. Single relations store record IDs.

| Collection | Fields |
| --- | --- |
| organizations | name (required), website, address, owner (required agent ID) |
| people | name (required), email, phone, organization, owner (required) |
| pipelines | name (required, unique), active |
| stages | name (required), pipeline (required), position (nonnegative integer), probability (0–100) |
| deals | title, stage, owner, currency, status (all required); organization, person, value_minor, expected_close, closed_at, lost_reason |
| activities | subject, kind, owner, due_at (required); deal, person, organization, done, completed_at, description |
| notes | body, owner (required); deal, person, organization, source_url |

Deal status is `open`, `won`, or `lost`. Activity kind is `call`, `meeting`, `email`, or `task`. Stage position is unique within its pipeline. A deal belongs to a pipeline through its stage; join `deals.stage = stages.id` and `stages.pipeline = pipelines.id`.

`value_minor` is an integer amount in the currency's minor unit (USD 12500 means $125.00; JPY 12500 means ¥12500). `currency` is a required three-letter uppercase code and must be an active ISO 4217 alphabetic code; the server rejects others, including `ZZZ`, `XXX`, and `XTS`. Conversion is an application responsibility. Do not add amounts across currencies without an explicit conversion policy. Values are limited to JavaScript's safe integer range.

`agents` is a password-auth collection with a required display `name`. Superusers provision and manage agents. Auth records are excluded from SQL. Use the authenticated record ID for ownership; ask the operator for other agent IDs when reassigning.

`created_by` and `updated_by` are optional relations to `agents`. For agent requests the server sets both to the authenticated agent on create, and sets `updated_by` on update while `created_by` keeps its stored value. Values sent by an agent are ignored. Superuser requests leave both fields as they are, so records created by a superuser have them empty unless the superuser sets them. If the operator deletes an agent account, these stamps are cleared on its records; `audit_log.actor` keeps the ID.

## Server rules

The server checks these rules on every validated save, from the records API and from the dashboard. A violation returns HTTP 400 with a message naming the field and the rule.

| Collection | Rule |
| --- | --- |
| deals | `status = open`: `closed_at` and `lost_reason` are empty |
| deals | `status = won`: `closed_at` is set, `lost_reason` is empty |
| deals | `status = lost`: `closed_at` is set, `lost_reason` is optional |
| deals | `currency` is an active ISO 4217 alphabetic code |
| activities | `done = true`: `completed_at` is set |
| activities | `done = false`: `completed_at` is empty |
| notes | at least one of `deal`, `person`, `organization` is set |
| deals, activities, notes | if `person` and `organization` are both set and the person has an organization, it equals the record's `organization`; a person without an organization passes |

The server fills two values and nothing else. When a request sets a deal's status to `won` or `lost` and `closed_at` is empty, it becomes the current UTC time. When an activity is done and `completed_at` is empty, it becomes the current UTC time. Values you send are kept. Nothing is cleared for you: reopening a deal needs `closed_at` and `lost_reason` cleared in the same PATCH, and setting `done: false` needs `completed_at` cleared in the same PATCH. Send dates as UTC strings in the format above or as RFC 3339. A date value the server cannot parse returns 400; it is never replaced by the current time. This check runs before anything else, also for every request of a batch: a batch that contains an unparseable date fails as a whole with a plain 400 that names the field, without a request index. Two requests that change the same record at the same time do not overwrite each other: the second gets HTTP 409 and must read the record again and retry.

## Deletes

Deletes are superuser-only on all seven CRM collections; an agent DELETE returns 403. The operator deletes through the dashboard or with a superuser token. Required relations prevent deleting records still referenced by them. Optional relations are cleared when their target is deleted, and that internal clear is not validated, so a note can be left without a link after the operator deletes its only target. The note rule applies again on that note's next save.

## audit_log

`audit_log` records writes made through the records API on the seven CRM collections, by agents and superusers. Agents can read it through SQL and through the records API. Its create, update, and delete rules are superuser-only, so agents cannot add, change, or remove rows.

| Field | Content |
| --- | --- |
| action | `create`, `update`, or `delete` |
| collection | collection name, for example `deals` |
| record | ID of the record written |
| actor | agent ID as text; empty for a superuser |
| actor_type | `agent` or `superuser` |
| changes | JSON, see below |
| created | time of the write |

`changes` depends on the action:

- create: `{"after": {field: value, ...}}` with the record's data fields.
- update: `{"before": {...}, "after": {...}}` with only the fields whose value changed. `updated` and `updated_by` are never listed. An update that changes nothing writes no row.
- delete: `{"before": {...}}` with the full record.

A rejected write leaves no row. The log does not cover everything: when the operator deletes a record, PocketBase clears optional relations that pointed to it (and `created_by`/`updated_by` when an agent account is deleted) without an `audit_log` row, and records that existed before the log was added have no `create` row. Rows are ordered by `created`, which has millisecond resolution, so two writes in the same millisecond have no defined order. A `delete` row keeps the deleted record's full contents readable to every agent. Read values with `json_extract`, for example `json_extract(changes, '$.after.stage')`. Indexes cover (`collection`, `record`, `created`) and (`actor`, `created`).

Discover actual columns using `/api/context/schema` (`dc.py schema`). The server's migrations are the source of truth. `references/schema.json` lists the SQL tables and columns at the time this skill was published, and `dc.py check` compares it with the server. All authenticated agents share access; there is no tenant isolation or row-level SQL policy.
