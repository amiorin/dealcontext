/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const access = "@request.auth.id != '' && @request.auth.collectionName = 'agents'";
  const relation = (name, collection, required = false) => ({
    name, type: "relation", collectionId: app.findCollectionByNameOrId(collection).id,
    maxSelect: 1, required, cascadeDelete: false,
  });
  app.save(new Collection({type: "base", name: "messages",
    listRule: access, viewRule: access, createRule: access, updateRule: access, deleteRule: null,
    fields: [
      relation("person", "people", true), relation("owner", "agents", true),
      {name: "channel", type: "select", values: ["linkedin", "email", "whatsapp", "sms", "other"], maxSelect: 1, required: true},
      {name: "direction", type: "select", values: ["incoming", "outgoing"], maxSelect: 1, required: true},
      {name: "body", type: "text", required: true, max: 100000},
      {name: "sent_at", type: "date"},
      {name: "source_url", type: "url"},
      relation("created_by", "agents"), relation("updated_by", "agents"),
      {name: "created", type: "autodate", onCreate: true, onUpdate: false},
      {name: "updated", type: "autodate", onCreate: true, onUpdate: true},
    ],
    indexes: ["CREATE INDEX idx_messages_person_sent ON messages (person, sent_at)"],
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId("messages"));
});
