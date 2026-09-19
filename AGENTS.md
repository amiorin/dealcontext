# DealContext

DealContext is a shared sales CRM operated through a coding agent.

CRM operation: use the skill in `skills/dealcontext/`. Read `skills/dealcontext/SKILL.md` first; it holds the operating rules, the configuration (`DEALCONTEXT_URL`, `DEALCONTEXT_AGENT_EMAIL`, `DEALCONTEXT_AGENT_PASSWORD`), the client `skills/dealcontext/scripts/dc.py`, and pointers to the schema, workflow, and example references. Use agent credentials only. Superuser access is for provisioning and maintenance by the operator, not for CRM work. Keep passwords and tokens out of source files, logs, and commits.

Implementation changes: run the three tests against a locally built PocketContext binary (`make -C ../pocketcontext build`). Each uses an isolated temporary database.

```sh
python3 tests/integration.py --binary /absolute/path/to/pocketcontext
python3 tests/skill.py --binary /absolute/path/to/pocketcontext
python3 tests/deploy.py --binary /absolute/path/to/pocketcontext
```

`tests/skill.py` fails when a migration changes the SQL-readable tables or columns. Regenerate the skill's snapshot with `python3 tests/skill.py --binary /absolute/path/to/pocketcontext --write-schema` and update `skills/dealcontext/references/schema.md` to match. Never start a server against `pb_data/` for tests.

Container image: `Dockerfile`, `.dockerignore`, `docker/entrypoint.sh`, and `docker/litestream.yml` build the image that ONCE runs; see "Deploy with ONCE" in `README.md`. `.dockerignore` denies everything and allows single files: a new file that the image needs must be added there and to the `Dockerfile`. The image builds PocketContext at `POCKETCONTEXT_VERSION`; nothing else pins the server commit. Base image digests and the Litestream checksums are pinned in the `Dockerfile`, and its header says where each value comes from. `docker/smoke.py` (`config`, `smoke`, `restore`) checks a built image and needs Docker; `.github/workflows/image.yml` runs it on every push, and publishes to GHCR and pings the server only on `main`. The container environment is a contract between `docker/entrypoint.sh`, `pb_hooks/deploy.js`, and the README table: change them together.
