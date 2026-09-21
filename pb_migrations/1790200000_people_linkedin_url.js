/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const people = app.findCollectionByNameOrId("people");
  people.fields.add(new URLField({name: "linkedin_url"}));
  app.save(people);
}, (app) => {
  const people = app.findCollectionByNameOrId("people");
  people.fields.removeByName("linkedin_url");
  app.save(people);
});
