/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const access = "@request.auth.id != '' && @request.auth.collectionName = 'agents'";
  const agents = app.findCollectionByNameOrId("agents").id;
  for (const name of ["organizations", "people", "pipelines", "stages", "deals", "activities", "notes"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.deleteRule = null;
    for (const field of ["created_by", "updated_by"]) {
      collection.fields.add(new RelationField({name: field, collectionId: agents, maxSelect: 1, required: false, cascadeDelete: false}));
    }
    app.save(collection);
  }
  // Append-only: rows are written by pb_hooks/integrity.pb.js, never through the records API.
  app.save(new Collection({type: "base", name: "audit_log",
    listRule: access, viewRule: access, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      {name: "action", type: "select", values: ["create", "update", "delete"], maxSelect: 1, required: true},
      {name: "collection", type: "text", required: true, max: 100},
      {name: "record", type: "text", required: true, max: 100},
      {name: "actor", type: "text", max: 100},
      {name: "actor_type", type: "select", values: ["agent", "superuser"], maxSelect: 1},
      {name: "changes", type: "json", maxSize: 5242880},
      {name: "created", type: "autodate", onCreate: true, onUpdate: false},
    ],
    indexes: [
      "CREATE INDEX idx_audit_log_record ON audit_log (collection, record, created)",
      "CREATE INDEX idx_audit_log_actor ON audit_log (actor, created)",
    ]}));
}, (app) => {
  const access = "@request.auth.id != '' && @request.auth.collectionName = 'agents'";
  app.delete(app.findCollectionByNameOrId("audit_log"));
  for (const name of ["notes", "activities", "deals", "stages", "pipelines", "people", "organizations"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.deleteRule = access;
    collection.fields.removeByName("created_by");
    collection.fields.removeByName("updated_by");
    app.save(collection);
  }
});
