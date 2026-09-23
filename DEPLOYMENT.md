# Deployment record

## Google Workspace JIT — 24 September 2026

Implementation `2fbd667` deployed with image `ghcr.io/pocketcontext/dealcontext@sha256:da88e0e737294f78f37c77dea43aaaf6df4be123388f4610f7758347399e0309`.
[Release CI/CD](https://github.com/pocketcontext/dealcontext/actions/runs/35928779636) passed required CRM/skill/deployment/intake tests, OAuth/JIT and revocation tests, container smoke/restore, both architecture builds, publication, safe SSH deployment, and public health. Server pin remains `52c784106f047dd052de395f47af78fc5c084e42`.

A targeted environment update under the existing deploy lock enabled the separate Google client and `DEALCONTEXT_GOOGLE_WORKSPACE_DOMAIN=pocketcontext.com`. The old container stopped cleanly before replacement. All existing environment values, deployment settings and sibling container states were preserved. Live verification confirmed Google enablement, seven-day tokens, disabled-account auth rule, OAuth-only signup, health, and unchanged existing account IDs.

All eligible Workspace members can now join the shared CRM on first Google login. Existing accounts retain identity and attribution. Disable accounts instead of deleting them. Skill revision 2 adds `dc.py login --google` with SSH loopback callback and private token renewal. Google suspension does not revoke PocketBase sessions; disable access separately in each application. No synthetic production records were added. A real Google browser login is still required for human end-to-end confirmation.
