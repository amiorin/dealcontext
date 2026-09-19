/// <reference path="../pb_data/types.d.ts" />
// Public web form submissions. Rows are created only by POST /api/intake/enquiry (pb_hooks/intake.pb.js).
// Agents triage them: they may change status, person, and deal, never the submitted values, and cannot delete.
migrate((app) => {
  const access = "@request.auth.id != '' && @request.auth.collectionName = 'agents'";
  const submitted = ["name", "email", "source", "utm_source", "utm_medium", "utm_campaign", "details"];
  const relation = (name, collection) => ({
    name, type: "relation", collectionId: app.findCollectionByNameOrId(collection).id,
    maxSelect: 1, required: false, cascadeDelete: false,
  });
  const text = (name, required = false, max = 200) => ({name, type: "text", required, max});
  app.save(new Collection({type: "base", name: "enquiries",
    listRule: access, viewRule: access, createRule: null, deleteRule: null,
    updateRule: access + submitted.map((field) => ` && @request.body.${field}:isset = false`).join(""),
    fields: [
      text("name", true), {name: "email", type: "email", required: true},
      {name: "status", type: "select", values: ["new", "qualified", "rejected", "spam"], maxSelect: 1, required: true},
      text("source"), text("utm_source"), text("utm_medium"), text("utm_campaign"),
      {name: "details", type: "json", maxSize: 16384},
      relation("person", "people"), relation("deal", "deals"), relation("updated_by", "agents"),
      {name: "created", type: "autodate", onCreate: true, onUpdate: false},
      {name: "updated", type: "autodate", onCreate: true, onUpdate: true},
    ],
    indexes: [
      "CREATE INDEX idx_enquiries_status_created ON enquiries (status, created)",
      "CREATE INDEX idx_enquiries_email ON enquiries (email, created)",
      "CREATE INDEX idx_enquiries_created ON enquiries (created)",
    ]}));
}, (app) => {
  app.delete(app.findCollectionByNameOrId("enquiries"));
});
