/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const people = app.findCollectionByNameOrId("people");
  people.fields.add(new TextField({name: "pronouns", max: 100}));
  app.save(people);
}, (app) => {
  const people = app.findCollectionByNameOrId("people");
  people.fields.removeByName("pronouns");
  app.save(people);
});
