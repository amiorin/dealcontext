# DealContext

A sales CRM operated through a coding agent. Contacts, pipelines, deals, activities, and notes live in PocketBase. Agents read context with SQL and write records through the normal PocketBase REST API. There is no CRM frontend.

[PocketContext](https://github.com/amiorin/pocketcontext) supplies the server and restricted SQL endpoints. This repository supplies the CRM schema, configuration, agent instructions, and workflow tests.

## Run locally

Keep the repositories in sibling directories:

```text
~/code/amiorin/
├── pocketcontext/
└── dealcontext/
```

Build PocketContext using the Go version in its `go.mod` and a C compiler. The SQLite driver uses CGO. Check out the commit recorded in `POCKETCONTEXT_VERSION`:

```sh
cd ../pocketcontext
git checkout "$(cat ../dealcontext/POCKETCONTEXT_VERSION)"
CGO_ENABLED=1 go build -o bin/pocketcontext ./cmd/pocketcontext
cd ../dealcontext
../pocketcontext/bin/pocketcontext serve --http=127.0.0.1:8090 \
  --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks \
  --contextConfig=./pocketcontext.json
```

The server applies migrations on startup. `pb_data/` contains local state and is excluded from Git. No contacts, deals, or agent passwords are seeded. The initial version targets PocketBase v0.40.4 through PocketContext.

## Provision an agent

Create a superuser with PocketContext's standard `superuser upsert <email> <password>` command, using the same `--dir` and migration paths. Authenticate at `POST /api/collections/_superusers/auth-with-password`. Use that temporary superuser token to create a record at `POST /api/collections/agents/records`:

```json
{
  "name": "Sales agent",
  "email": "agent@example.com",
  "password": "<strong-password>",
  "passwordConfirm": "<same-strong-password>"
}
```

Then authenticate the agent at `POST /api/collections/agents/auth-with-password` with `identity` and `password`. Send its token in the `Authorization` header for CRM and SQL requests. Agent accounts cannot provision accounts or edit collection schemas. Keep credentials outside the repository and avoid copying commands containing passwords into shell history.

Point your coding agent at this repository's [AGENTS.md](AGENTS.md), the server URL, and the provisioned agent credentials. The included instructions describe how to use the HTTP interfaces; no MCP service or agent-specific plugin is required.

## Data and permissions

The seven CRM collections and `audit_log` are SQL-readable. Auth and internal tables are excluded. Every authenticated `agents` account can read, create, and update all CRM records. The `owner` relation assigns work; it does not restrict visibility.

PocketBase validates fields and relations on writes. Server hooks in `pb_hooks/` add these rules to every validated save, from the records API and from the dashboard. A violation returns HTTP 400 with a message naming the field and the rule:

- An open deal has empty `closed_at` and `lost_reason`. A won deal has `closed_at` set and an empty `lost_reason`. A lost deal has `closed_at` set; `lost_reason` is optional.
- When a request sets a deal's status to `won` or `lost` without a `closed_at`, the server fills it with the current UTC time. Nothing is cleared automatically: reopening a deal must clear `closed_at` and `lost_reason` in the same request.
- `currency` must be an active ISO 4217 alphabetic code. `ZZZ`, `XXX`, and `XTS` are rejected.
- A done activity has `completed_at` set; the server fills it when empty. An activity that is not done has an empty `completed_at`.
- A note links to at least one deal, person, or organization.
- A date value the server cannot parse is rejected. It is not stored as empty or replaced by the current time.
- A write to a record that another request changed after the server loaded it returns HTTP 409 instead of overwriting that change. The client reads the record again and retries.
- On deals, activities, and notes, when both `person` and `organization` are set and the person has an organization, the two must match.

Deletes are superuser-only on all seven CRM collections. An agent DELETE returns 403. The operator deletes records through the dashboard or with a superuser token. Agents correct mistakes by updating records, for example closing a deal as lost or completing an activity.

Every CRM record has `created_by` and `updated_by`. The server sets them from the authenticated agent and ignores values an agent sends. Superuser requests leave them unchanged. `audit_log` receives one row for each create, update, and delete made through the records API on the seven CRM collections, by agents and superusers, with the actor and the changed values. A no-op update and a rejected write add no row. The log is append-only for agents: they can read it through SQL and the records API, and its create, update, and delete rules are superuser-only. Internal relation clears that follow an operator delete are not logged. Stage history is read from `audit_log`; see [examples](agent/examples.md).

`created_by` and `updated_by` are optional relations, so deleting an agent account clears those stamps on its records. `audit_log.actor` is plain text and keeps the ID. PocketBase also refuses to delete an agent while records name it as `owner`. To retire an agent and keep its stamps, change its password instead of deleting the account.

Rules outside this list remain agent conventions documented in [workflows](agent/workflows.md). This version does not include tenant isolation, email sync, external message delivery, or currency conversion.

`pocketcontext.json` sets SQL tables, query timeout, and result limits. Empty column arrays expose all columns of those configured tables. Review newly added fields before deploying migrations that could expose sensitive data.

See [schema](agent/schema.md), [workflows](agent/workflows.md), and [examples](agent/examples.md). Back up the data directory using PocketBase's supported backup procedure before upgrades. Review and test migration changes before applying them to a live CRM.

## Verify

```sh
python3 tests/integration.py --binary ../pocketcontext/bin/pocketcontext
```

The test creates a temporary database, provisions two agents, and exercises contact creation, stage changes, follow-ups, notes, deal closure, SQL joins, permissions, and field validation. It also checks each server rule above with a rejected and an accepted write, superuser-only deletes, `created_by` and `updated_by` stamping, and the `audit_log` rows for creates, updates, and deletes. It deletes its temporary state when finished.

Schema migrations use [PocketBase JavaScript migrations](https://pocketbase.io/docs/js-migrations/). Authentication and writes use the [PocketBase Web APIs](https://pocketbase.io/docs/api-records/).
