/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const access = "@request.auth.id != '' && @request.auth.collectionName = 'agents'";
  const agents = new Collection({
    type: "auth", name: "agents", listRule: null, viewRule: "id = @request.auth.id",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [{name: "name", type: "text", required: true, max: 200}],
    passwordAuth: {enabled: true, identityFields: ["email"]},
  });
  app.save(agents);
  const text = (name, required = false, max = 500) => ({name, type: "text", required, max});
  const relation = (name, collection, required = false) => ({
    name, type: "relation", collectionId: app.findCollectionByNameOrId(collection).id,
    maxSelect: 1, required, cascadeDelete: false,
  });
  const owner = () => relation("owner", "agents", true);
  const date = (name) => ({name, type: "date"});
  const choice = (name, values) => ({name, type: "select", values, maxSelect: 1, required: true});
  function create(name, fields, indexes = []) {
    app.save(new Collection({type: "base", name,
      listRule: access, viewRule: access, createRule: access, updateRule: access, deleteRule: access,
      fields: fields.concat([
        {name: "created", type: "autodate", onCreate: true, onUpdate: false},
        {name: "updated", type: "autodate", onCreate: true, onUpdate: true},
      ]), indexes}));
  }
  create("organizations", [text("name", true), {name: "website", type: "url"}, text("address"), owner()],
    ["CREATE INDEX idx_organizations_name ON organizations (name)"]);
  create("people", [text("name", true), {name: "email", type: "email"}, text("phone"), relation("organization", "organizations"), owner()],
    ["CREATE INDEX idx_people_organization ON people (organization)", "CREATE INDEX idx_people_email ON people (email)"]);
  create("pipelines", [text("name", true), {name: "active", type: "bool"}],
    ["CREATE UNIQUE INDEX idx_pipelines_name ON pipelines (name)"]);
  create("stages", [text("name", true), relation("pipeline", "pipelines", true),
    {name: "position", type: "number", min: 0, onlyInt: true},
    {name: "probability", type: "number", min: 0, max: 100}],
    ["CREATE UNIQUE INDEX idx_stages_pipeline_position ON stages (pipeline, position)"]);
  create("deals", [text("title", true), relation("stage", "stages", true),
    relation("organization", "organizations"), relation("person", "people"), owner(),
    {name: "value_minor", type: "number", min: 0, max: 9007199254740991, onlyInt: true},
    {name: "currency", type: "text", required: true, min: 3, max: 3, pattern: "^[A-Z]{3}$"},
    choice("status", ["open", "won", "lost"]), date("expected_close"), date("closed_at"), text("lost_reason")],
    ["CREATE INDEX idx_deals_stage_status ON deals (stage, status)", "CREATE INDEX idx_deals_owner ON deals (owner)"]);
  create("activities", [text("subject", true), choice("kind", ["call", "meeting", "email", "task"]),
    relation("deal", "deals"), relation("person", "people"), relation("organization", "organizations"), owner(),
    {name: "due_at", type: "date", required: true}, {name: "done", type: "bool"}, date("completed_at"), text("description", false, 20000)],
    ["CREATE INDEX idx_activities_deal_done_due ON activities (deal, done, due_at)"]);
  create("notes", [text("body", true, 100000), relation("deal", "deals"), relation("person", "people"),
    relation("organization", "organizations"), owner(), {name: "source_url", type: "url"}],
    ["CREATE INDEX idx_notes_deal_created ON notes (deal, created)"]);
}, (app) => {
  for (const name of ["notes", "activities", "deals", "stages", "pipelines", "people", "organizations", "agents"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
