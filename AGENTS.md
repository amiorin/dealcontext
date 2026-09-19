# DealContext

DealContext is a shared sales CRM operated through a coding agent. Read `agent/schema.md`, `agent/workflows.md`, and `agent/examples.md` before changing CRM data.

Read CRM data through `GET /api/context/schema` and `POST /api/context/query`. Write only through PocketBase's standard records API. Never modify SQLite directly, use SQL mutations, or change migrations to edit records.

Get the server URL and agent credentials from the user's environment. Authenticate against the `agents` collection. Keep passwords and tokens out of source files, logs, and commits. Superuser access is for initial provisioning and maintenance, not ordinary CRM work.

All agents share the same workspace and can read and change all CRM records. Ownership is assignment, not an access boundary. Do not claim private per-user visibility.

Resolve record IDs before a write. Ask for clarification when names match multiple records. Set explicit status, currency, and owner on deals. Report the result and record IDs after writes. A multi-request workflow can partially succeed: inspect the state before retrying to avoid duplicate activities or notes.

Do not send email, invitations, or other external messages unless the user explicitly requests it. An email activity records CRM work; it does not send an email.

Implementation changes: run `python3 tests/integration.py --binary /absolute/path/to/pocketcontext` against a locally built PocketContext binary. The test uses an isolated temporary database.
