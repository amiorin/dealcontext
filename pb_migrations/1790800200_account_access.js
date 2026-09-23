migrate((app) => {
  const agents = app.findCollectionByNameOrId("agents");
  agents.fields.add(new BoolField({name: "disabled"}));
  agents.authRule = "disabled = false";
  agents.updateRule += " && @request.body.disabled:isset = false";
  app.save(agents);
}, () => {
  throw new Error("Account access rollback requires a deliberate backup restore.");
});
