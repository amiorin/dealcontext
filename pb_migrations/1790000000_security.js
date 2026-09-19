/// <reference path="../pb_data/types.d.ts" />
// Agents are machine accounts: one-day tokens, no login alert emails, and a self-service password change.
// PocketBase requires oldPassword for a non-superuser password change and invalidates the older tokens.
// The rule rejects a body that names any other editable field, whatever the value.
migrate((app) => {
  const agents = app.findCollectionByNameOrId("agents");
  agents.authToken.duration = 86400;
  agents.authAlert.enabled = false;
  agents.updateRule = "id = @request.auth.id && @request.auth.collectionName = 'agents'" +
    " && @request.body.email:isset = false && @request.body.name:isset = false" +
    " && @request.body.verified:isset = false && @request.body.emailVisibility:isset = false";
  app.save(agents);
}, (app) => {
  const agents = app.findCollectionByNameOrId("agents");
  agents.authToken.duration = 432000; // PocketBase v0.40.4 default
  agents.authAlert.enabled = true;
  agents.updateRule = null;
  app.save(agents);
});
