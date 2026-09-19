---
name: dealcontext
description: Operate a DealContext sales CRM through its HTTP API with the bundled dc.py client. Use when the user asks about deals, the pipeline, stages, contacts or people, organizations, follow-up activities, notes, or the history of a deal (audit log), or asks to add or change any of them, for example create a deal, move a deal to another stage, close a deal as won or lost, schedule a follow-up, record a note, or list open deals. Needs DEALCONTEXT_URL, DEALCONTEXT_AGENT_EMAIL, and DEALCONTEXT_AGENT_PASSWORD in the environment.
---

# DealContext

DealContext is a shared sales CRM on a PocketBase server. It has no user interface: you read it with SQL and write it through the records API. The bundled client `scripts/dc.py` does both. Paths in this file are relative to the directory that contains this file. The script works from any working directory; call it by its full path.

## Configuration

The client reads three environment variables:

- `DEALCONTEXT_URL`: server address, for example `https://crm.example.com`
- `DEALCONTEXT_AGENT_EMAIL`: email of your account in the `agents` collection
- `DEALCONTEXT_AGENT_PASSWORD`: its password

They must already be set in the environment your commands run in; do not set them inline in a command. If one is missing, the client exits with code 2 and names it. Stop and tell the user which variable to set. Do not search files for credentials. Never ask for, look for, or use superuser (operator) credentials; CRM work needs only the agent account. Never put the password or a token in a command line, a file, or your reply. The client logs in when needed and caches the token in `~/.cache/dealcontext/` with mode 0600.

Start a session with:

```sh
python3 scripts/dc.py whoami   # your agent id (the value for every `owner` field), name, server URL
python3 scripts/dc.py check    # exit 0: the reference files match the server; exit 3: differences are listed
```

## Commands

```text
dc.py whoami | check | schema | newid | logout
dc.py sql '<SELECT ...>'                     or: dc.py sql -        (query on standard input)
dc.py get <collection> <id>
dc.py create <collection> '<json object>'    or: ... -             (JSON on standard input)
dc.py update <collection> <id> '<json object with the fields to change>'
dc.py batch '<json array of {"method","url","body"}>'
```

Output is the server's JSON on stdout; add `--pretty` to indent it. Errors go to stderr with the HTTP status and the server's JSON body. Exit codes: 0 success, 1 HTTP or transport error, 2 usage or configuration error, 3 `check` found differences, 4 HTTP 409. There is no delete command. Use standard input for JSON or SQL that contains single quotes.

## Rules

1. The workspace is shared. Every agent can read and change every CRM record. `owner` assigns work; it is not an access boundary. Do not tell the user that records are private.
2. Read with SQL (`dc.py sql`, `dc.py schema`). SQL is read-only. Write only through `create`, `update`, and `batch`. Never edit the database, migrations, or server files to change records.
3. Resolve record ids with SQL before you write. If a name matches several records, ask the user which one. Set `status`, `currency`, and `owner` explicitly on deals.
4. You cannot delete. A DELETE returns 403. Mark the mistake instead: close a deal as `lost` with a `lost_reason`, complete an activity and explain in its `description`, or correct a note. A note that is wrong as a whole keeps its link and gets a body that starts with `[RETRACTED <date>: <reason>]`. If a record must be removed, give the user the collection and record id and ask them to have the operator delete it.
5. Do not send `created_by` or `updated_by`. The server sets them from your login, and every create and update is recorded in `audit_log` with your agent id.
6. Do not send email, invitations, or other external messages unless the user explicitly asks. An `email` activity records work; it sends nothing.
7. After writing, report what changed and the record ids.

## Reading

Select only the columns you need, always add `LIMIT`, and order the rows when you page. The server caps a result at 500 rows and 1 MB and a query at 2 seconds (`dc.py schema` prints the live `limits`): when the result has `"truncated": true` the client prints a `WARNING` line on stderr, and the rows are incomplete. Narrow the query or page with `ORDER BY ... LIMIT ... OFFSET ...`. Empty optional strings, dates, and relations are `''`, not NULL. Auth tables are not readable. Quote user text as a SQL literal by doubling single quotes. Count and sum in SQL instead of fetching rows to count them.

## Writing

Prefer one `batch` for a workflow that writes more than one record, for example a deal with its first activity and note. A batch is one transaction of at most 20 requests: all are saved or none. To reference a record created earlier in the same batch, choose its id yourself: get one from `dc.py newid`, send it as `"id"` in the create body, and use it in the later relations. Separate `create` and `update` calls are not a transaction and can partially succeed.

```sh
python3 scripts/dc.py batch - <<'JSON'
[{"method":"POST","url":"/api/collections/deals/records","body":{"id":"<newid>","title":"Acme renewal","stage":"<stage-id>","owner":"<agent-id>","value_minor":250000,"currency":"USD","status":"open"}},
 {"method":"POST","url":"/api/collections/activities/records","body":{"subject":"Follow up with Acme","kind":"call","deal":"<newid>","owner":"<agent-id>","due_at":"2026-09-25 09:00:00.000Z"}}]
JSON
```

## Errors

- HTTP 400 on a write: the request broke a field or record rule. For the record rules the top-level `message` names the field and the rule. For PocketBase's own field validation (required, format, unique, maximum) the top-level message is only "Failed to create record." and the detail is in `data.<field>.message`. Fix the request; do not retry it unchanged.
- HTTP 400 on `sql` with "SQL query rejected: ...": the query is not a single read-only SELECT over the allowed tables and functions. The message says what was refused. For a failed batch the client prints the index of the failed request and its message, and nothing from the batch was saved.
- Exit code 4 (HTTP 409): another request changed the record first. Read the record again, confirm your change still applies, then retry.
- Timeout or transport error on a write: the write may have been saved. Read the current state before retrying, or you create a duplicate that you cannot delete.
- HTTP 403 on a write: agents cannot delete or provision accounts. Do not look for another way around it.
- A login failure means the variables are wrong. Tell the user; do not try other credentials.

## References

- `references/schema.md`: collections, fields, required values, server rules, automatic values, `audit_log` format. Read it before your first write and before writing SQL joins.
- `references/workflows.md`: steps for starting a pipeline, creating a deal, moving or closing a deal, follow-ups, notes, history, and safe retries. Read the section for the task at hand.
- `references/examples.md`: SQL queries (open deals without a follow-up, stage history, record history) and write examples as HTTP and as `dc.py` commands. Read it when you need a query or request to adapt.
- `references/schema.json`: SQL tables and columns at the time this skill was published. `dc.py check` reads it; you rarely need to.

## Version skew

The server can be newer or older than this skill. The live schema from `dc.py schema` and the server's error messages are authoritative over the reference files. Run `dc.py check` at the start of a session. If it exits 3, use the live columns it lists, tell the user that the skill's reference files are out of date, and continue with care: rules described in `references/schema.md` may have changed as well.
