/// <reference path="../pb_data/types.d.ts" />
// Batch requests run in one transaction, so a workflow such as "create a deal and its first activity" is atomic.
migrate((app) => {
  const settings = app.settings();
  settings.batch.enabled = true;
  settings.batch.maxRequests = 20;
  settings.batch.timeout = 5;
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.batch.enabled = false;
  settings.batch.maxRequests = 50;
  settings.batch.timeout = 3;
  app.save(settings);
});
