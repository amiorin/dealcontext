# DealContext

DealContext is a shared sales CRM operated through a coding agent.

CRM operation: use the skill in `skills/dealcontext/`. Read `skills/dealcontext/SKILL.md` first; it holds the operating rules, the configuration (`DEALCONTEXT_URL`, `DEALCONTEXT_AGENT_EMAIL`, `DEALCONTEXT_AGENT_PASSWORD`), the client `skills/dealcontext/scripts/dc.py`, and pointers to the schema, workflow, and example references. Use agent credentials only. Superuser access is for provisioning and maintenance by the operator, not for CRM work. Keep passwords and tokens out of source files, logs, and commits.

Implementation changes: run both tests against a locally built PocketContext binary. Each uses an isolated temporary database.

```sh
python3 tests/integration.py --binary /absolute/path/to/pocketcontext
python3 tests/skill.py --binary /absolute/path/to/pocketcontext
```

`tests/skill.py` fails when a migration changes the SQL-readable tables or columns. Regenerate the skill's snapshot with `python3 tests/skill.py --binary /absolute/path/to/pocketcontext --write-schema` and update `skills/dealcontext/references/schema.md` to match. Never start a server against `pb_data/` for tests.
