// Apply the environment on first install, after custom auth collection migrations.
function googleOAuth(app) {
  const clientId = String($os.getenv("DEALCONTEXT_GOOGLE_CLIENT_ID") || "");
  const clientSecret = String($os.getenv("DEALCONTEXT_GOOGLE_CLIENT_SECRET") || "");
  if (!clientId && !clientSecret) return;
  if (!clientId.trim() || !clientSecret.trim()) {
    throw new Error("DEALCONTEXT_GOOGLE_CLIENT_ID and DEALCONTEXT_GOOGLE_CLIENT_SECRET must be set together");
  }
  if (/\s/.test(clientId) || /\s/.test(clientSecret)) {
    throw new Error("DealContext Google OAuth credentials must not contain whitespace");
  }
  // A fresh database receives its custom agents collection in app migrations.
  // The OAuth migration applies these same settings during that first pass.
  try { app.findCollectionByNameOrId("agents"); } catch (_) { return; }
  try {
    // Do not run app migrations here: maintenance commands control their own passes.
    const agents = app.findCollectionByNameOrId("agents");
    // Clone the native provider slice before changing it; retain all other providers,
    // custom Google options, field mappings, password settings, and access rules.
    const providers = JSON.parse(JSON.stringify(agents.oauth2.providers || []));
    let google = providers.find(provider => provider.name === "google");
    if (google && agents.oauth2.enabled && google.clientId === clientId && google.clientSecret === clientSecret) return;
    if (!google) {
      google = {name: "google"};
      providers.push(google);
    }
    google.clientId = clientId;
    google.clientSecret = clientSecret;
    agents.oauth2.providers = providers;
    agents.oauth2.enabled = true;
    app.save(agents);
    console.log("deploy: applied Google OAuth from the environment");
  } catch (_) {
    // Collection validation errors can include provider values. Never expose them.
    throw new Error("Could not apply DealContext Google OAuth configuration; server startup stopped");
  }
}


migrate((app) => googleOAuth(app), () => {});
