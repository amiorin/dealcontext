/// <reference path="../pb_data/types.d.ts" />
// Model hooks cover REST, dashboard, and internal account changes alike.
onRecordCreateExecute((e) => require(`${__hooks}/agent_directory.js`).sync(e, false), "agents");
onRecordUpdateExecute((e) => require(`${__hooks}/agent_directory.js`).sync(e, false), "agents");
onRecordDeleteExecute((e) => require(`${__hooks}/agent_directory.js`).sync(e, true), "agents");
