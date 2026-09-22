/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const people = app.findCollectionByNameOrId("people");
  people.fields.add(new TextField({name: "job_title", max: 200}));
  app.save(people);
}, (app) => {
  const people = app.findCollectionByNameOrId("people");
  people.fields.removeByName("job_title");
  app.save(people);
});
