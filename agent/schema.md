# Schema

Every CRM record has `id`, `created`, and `updated`. IDs are PocketBase record IDs. Dates use UTC strings, for example `2026-09-19 14:00:00.000Z`. Missing optional strings, dates, and relations are empty strings, not SQL NULL. Single relations store record IDs.

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

`value_minor` is an integer amount in the currency's minor unit (USD 12500 means $125.00; JPY 12500 means ¥12500). `currency` is a required three-letter uppercase code. Currency validity and conversion are application responsibilities. Do not add amounts across currencies without an explicit conversion policy. Values are limited to JavaScript's safe integer range.

`agents` is a password-auth collection with a required display `name`. Superusers provision and manage agents. Auth records are excluded from SQL. Use the authenticated record ID for ownership; ask the operator for other agent IDs when reassigning.

Required relations prevent deleting records still referenced by them. Optional relations can be cleared when their target is deleted. Prefer closing a deal to deleting it; deletion is permanent and there is no audit log in this version.

Discover actual columns using `/api/context/schema`. The migrations are the source of truth. All authenticated agents share access; there is no tenant isolation or row-level SQL policy.
