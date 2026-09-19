/// <reference path="../pb_data/types.d.ts" />
// Record rules, attribution, and the audit log. The logic is in integrity.js; handlers cannot see file-level variables.

// Invariants for every validated save (records API and dashboard). Internal relation clears skip validation.
onRecordValidate((e) => {
  e.next();
  require(`${__hooks}/integrity.js`).validate(e.app, e.record);
}, "deals", "activities", "notes");

onRecordCreateRequest((e) => require(`${__hooks}/integrity.js`).write(e),
  "organizations", "people", "pipelines", "stages", "deals", "activities", "notes");
onRecordUpdateRequest((e) => require(`${__hooks}/integrity.js`).write(e),
  "organizations", "people", "pipelines", "stages", "deals", "activities", "notes");
onRecordDeleteRequest((e) => require(`${__hooks}/integrity.js`).audited(e),
  "organizations", "people", "pipelines", "stages", "deals", "activities", "notes");

onRecordCreateExecute((e) => require(`${__hooks}/integrity.js`).audit(e, "create"),
  "organizations", "people", "pipelines", "stages", "deals", "activities", "notes");
onRecordUpdateExecute((e) => require(`${__hooks}/integrity.js`).audit(e, "update"),
  "organizations", "people", "pipelines", "stages", "deals", "activities", "notes");
onRecordDeleteExecute((e) => require(`${__hooks}/integrity.js`).audit(e, "delete"),
  "organizations", "people", "pipelines", "stages", "deals", "activities", "notes");
