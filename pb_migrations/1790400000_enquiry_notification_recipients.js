/// <reference path="../pb_data/types.d.ts" />
// Operator-managed mailing list. Deliberately absent from pocketcontext.json.
migrate((app) => {
  app.save(new Collection({type: "base", name: "enquiry_notification_recipients",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      {name: "email", type: "email", required: true},
      {name: "name", type: "text", max: 200},
      {name: "enabled", type: "bool"},
      {name: "created", type: "autodate", onCreate: true, onUpdate: false},
      {name: "updated", type: "autodate", onCreate: false, onUpdate: true},
    ],
    indexes: ["CREATE UNIQUE INDEX idx_enquiry_notification_recipients_email ON enquiry_notification_recipients (email COLLATE NOCASE)"],
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId("enquiry_notification_recipients"));
});
