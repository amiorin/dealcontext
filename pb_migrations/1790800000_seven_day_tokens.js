migrate((app) => {
  const agents = app.findCollectionByNameOrId("agents");
  agents.authToken.duration = 604800;
  app.save(agents);
}, (app) => {
  const agents = app.findCollectionByNameOrId("agents");
  agents.authToken.duration = 86400;
  app.save(agents);
});
