// Copy this file to env.local.js and adjust for your environment.
// Load this BEFORE any module scripts that import supabaseClient.js.
// Example in HTML:
//   <script src="./env.local.js"></script>
//   <script type="module" src="./admin-panel.js"></script>
//
// IMPORTANT:
// - Supabase anon key is safe to expose in browser but MUST be protected by strict RLS policies.
// - Never put service_role keys here (or any secret). Those belong only on the server.

window.ENV = {
  // Your Supabase project URL, e.g. https://xyzcompany.supabase.co
  SUPABASE_URL: 'https://zoifftmnzfpjttpojmup.supabase.co',
  // Your Supabase anon public key
  SUPABASE_ANON_KEY: 'replace-with-your-anon-key',
  // Marketplace backend base URL (for Trendyol proxy)
  // Dev: 'http://localhost:3002' (or another local port)
  // Prod: 'https://api.your-domain.com' (HTTPS strongly recommended)
  MP_BACKEND_URL: 'http://localhost:3002',
};

// For development overrides, create env.local.js and set:
//   window.ENV.MP_BACKEND_URL = 'http://127.0.0.1:500';
//   window.ENV.SUPABASE_URL = 'https://...supabase.co';
//   window.ENV.SUPABASE_ANON_KEY = '...';
