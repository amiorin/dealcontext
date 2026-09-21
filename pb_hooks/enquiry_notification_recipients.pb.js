/// <reference path="../pb_data/types.d.ts" />
// Normalize before PocketBase validates the address and its unique index.
onRecordValidate((e) => {
  e.record.set("email", e.record.getString("email").trim().toLowerCase());
  e.next();
}, "enquiry_notification_recipients");
