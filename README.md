# DealContext

A sales CRM operated through a coding agent. Contacts, pipelines, deals, activities, and notes live in PocketBase. Agents read context with SQL and write records through the normal PocketBase REST API. There is no CRM frontend.

[PocketContext](https://github.com/amiorin/pocketcontext) supplies the server and restricted SQL endpoints. This repository supplies the CRM schema, configuration, workflow tests, and an installable agent skill in [skills/dealcontext](skills/dealcontext/SKILL.md) that holds the agent instructions and a small command-line client.

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

Give the coding agent the skill described in the next section, the server URL, and the provisioned agent credentials. No MCP service is required.

## Install the skill on another computer

The computer that operates the CRM needs Python 3, the skill, and three environment variables. It does not need a clone of this repository. Install the skill with the [`skills` CLI](https://github.com/vercel-labs/skills), which needs Node.js:

```sh
npx skills add amiorin/dealcontext --list                                        # shows the skill found in skills/dealcontext
npx skills add amiorin/dealcontext --skill dealcontext --agent claude-code -g -y # user-level install for Claude Code
```

`-g` installs for the user (for Claude Code: `~/.claude/skills/dealcontext`); without it the skill is installed into the current project. `--agent` takes one or more agent names; without `--agent` and `-y` the CLI asks. `npx skills update dealcontext -g` fetches a newer version. A local checkout works as a source too: `npx skills add /path/to/dealcontext --skill dealcontext`. Without Node.js, copy the `skills/dealcontext` directory into the agent's skills directory.

Set these variables in the environment that starts the coding agent:

```sh
export DEALCONTEXT_URL=https://crm.example.com
export DEALCONTEXT_AGENT_EMAIL=agent@example.com
export DEALCONTEXT_AGENT_PASSWORD=...   # from a secret store, not from a committed file
```

Use an `https` URL for a server that is not on the same computer; the password and token travel in the requests. Do not place superuser credentials in the agent's environment. The skill needs only the agent account, tells the agent never to look for operator credentials, and the agent account cannot delete records, provision accounts, or change the schema.

Check the setup from the installed skill directory:

```sh
python3 scripts/dc.py whoami   # logs in; prints the agent ID, name, and server URL
python3 scripts/dc.py check    # exit 0: the skill's schema snapshot matches the server; exit 3: lists the differences
```

`dc.py` uses only the Python standard library. It caches the login token in `$XDG_CACHE_HOME/dealcontext/` (default `~/.cache/dealcontext/`) with mode 0600, never prints the password or token, and has no delete command. `dc.py logout` removes the cached token. When `check` reports differences, the server is newer or older than the installed skill: the live schema is authoritative, and updating the skill brings the reference files back in line.

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

PocketBase's batch API is enabled: `POST /api/batch` runs up to 20 record writes as one transaction with a 5 second timeout. The rules above, the `created_by` and `updated_by` stamps, and `audit_log` apply to each request in a batch. If one request fails, the batch returns HTTP 400 with that request's error and nothing is saved. A create may send its own 15-character `id`, so a later request in the same batch can refer to the new record; this makes "create a deal with its first activity and a note" atomic. See [examples](skills/dealcontext/references/examples.md).

Deletes are superuser-only on all seven CRM collections. An agent DELETE returns 403. The operator deletes records through the dashboard or with a superuser token. Agents correct mistakes by updating records, for example closing a deal as lost or completing an activity.

Every CRM record has `created_by` and `updated_by`. The server sets them from the authenticated agent and ignores values an agent sends. Superuser requests leave them unchanged. `audit_log` receives one row for each create, update, and delete made through the records API on the seven CRM collections, by agents and superusers, with the actor and the changed values. A no-op update and a rejected write add no row. The log is append-only for agents: they can read it through SQL and the records API, and its create, update, and delete rules are superuser-only. Internal relation clears that follow an operator delete are not logged. Stage history is read from `audit_log`; see [examples](skills/dealcontext/references/examples.md).

`created_by` and `updated_by` are optional relations, so deleting an agent account clears those stamps on its records. `audit_log.actor` is plain text and keeps the ID. PocketBase also refuses to delete an agent while records name it as `owner`. To retire an agent and keep its stamps, change its password instead of deleting the account.

Rules outside this list remain agent conventions documented in [workflows](skills/dealcontext/references/workflows.md). This version does not include tenant isolation, email sync, external message delivery, or currency conversion.

`pocketcontext.json` sets SQL tables, query timeout, and result limits. Empty column arrays expose all columns of those configured tables. Review newly added fields before deploying migrations that could expose sensitive data.

See [schema](skills/dealcontext/references/schema.md), [workflows](skills/dealcontext/references/workflows.md), and [examples](skills/dealcontext/references/examples.md). Back up the data directory using PocketBase's supported backup procedure before upgrades. Review and test migration changes before applying them to a live CRM.

## Verify

```sh
python3 tests/integration.py --binary ../pocketcontext/bin/pocketcontext
python3 tests/skill.py --binary ../pocketcontext/bin/pocketcontext
```

The integration test creates a temporary database, provisions two agents, and exercises contact creation, stage changes, follow-ups, notes, deal closure, SQL joins, permissions, and field validation. It also checks each server rule above with a rejected and an accepted write, superuser-only deletes, `created_by` and `updated_by` stamping, the `audit_log` rows for creates, updates, and deletes, and the batch API. It deletes its temporary state when finished.

The skill test checks the skill's frontmatter and links, copies `skills/dealcontext` to a temporary directory outside the repository, and runs `dc.py` there against a temporary server with a temporary `HOME`: configuration errors, the token cache, every command, batch success and failure, recovery from a rejected token, exit codes, and that the password and token never reach the output. Its `check` step fails when a migration changes the SQL-readable tables or columns. Regenerate the snapshot and review the reference files:

```sh
python3 tests/skill.py --binary ../pocketcontext/bin/pocketcontext --write-schema
```

Schema migrations use [PocketBase JavaScript migrations](https://pocketbase.io/docs/js-migrations/). Authentication and writes use the [PocketBase Web APIs](https://pocketbase.io/docs/api-records/).
