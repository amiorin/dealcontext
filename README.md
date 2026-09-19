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

The seven CRM collections are SQL-readable. Auth and internal tables are excluded. Every authenticated `agents` account can read and write all CRM records. The `owner` relation assigns work; it does not restrict visibility.

PocketBase validates fields and relations on writes. Lifecycle conventions such as setting `closed_at` on a won deal are documented agent responsibilities. The first version does not include email sync, external message delivery, automated stage history, tenant isolation, or currency conversion.

`pocketcontext.json` sets SQL tables, query timeout, and result limits. Empty column arrays expose all columns of those configured tables. Review newly added fields before deploying migrations that could expose sensitive data.

See [schema](agent/schema.md), [workflows](agent/workflows.md), and [examples](agent/examples.md). Back up the data directory using PocketBase's supported backup procedure before upgrades. Review and test migration changes before applying them to a live CRM.

## Verify

```sh
python3 tests/integration.py --binary ../pocketcontext/bin/pocketcontext
```

The test creates a temporary database, provisions an agent, and exercises contact creation, stage changes, follow-ups, notes, deal closure, SQL joins, permissions, and field validation. It deletes its temporary state when finished.

Schema migrations use [PocketBase JavaScript migrations](https://pocketbase.io/docs/js-migrations/). Authentication and writes use the [PocketBase Web APIs](https://pocketbase.io/docs/api-records/).
