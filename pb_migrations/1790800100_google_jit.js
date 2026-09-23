migrate((app) => {
  const agents = app.findCollectionByNameOrId("agents");
  // PocketBase sets this context internally only during OAuth record creation.
  // The Google hook validates the provider identity before this path is reached.
  agents.createRule = "@request.context = 'oauth2'";
  app.save(agents);
}, (app) => {
  const agents = app.findCollectionByNameOrId("agents");
  agents.createRule = null;
  app.save(agents);
});
