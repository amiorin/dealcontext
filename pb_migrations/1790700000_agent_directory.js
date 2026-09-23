/// <reference path="../pb_data/types.d.ts" />
// Shared account labels, separate from authentication records. IDs match agents.id.
migrate((app) => {
  const access = "@request.auth.id != '' && @request.auth.collectionName = 'agents'";
  const directory = new Collection({
    type: "base", name: "agent_directory",
    listRule: access, viewRule: access,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [{name: "name", type: "text", required: true, max: 200}],
  });
  app.save(directory);
  // Bound each page when upgrading a database with existing accounts.
  for (let offset = 0; ; offset += 500) {
    const agents = app.findRecordsByFilter("agents", "", "id", 500, offset);
    for (const agent of agents) {
      const row = new Record(directory);
      row.set("id", agent.id);
      row.set("name", agent.getString("name"));
      app.save(row);
    }
    if (agents.length < 500) break;
  }
}, (app) => {
  app.delete(app.findCollectionByNameOrId("agent_directory"));
});
