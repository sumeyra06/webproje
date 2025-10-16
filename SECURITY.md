# Environment and Keys

This project is a static site. There is no server to hide secrets in the frontend bundle.

- Supabase anon key is public by design. Protect your data with strict Row Level Security (RLS) policies.
- Never expose the `service_role` key in the browser.
- For convenience, `supabaseClient.js` can read runtime values from an optional `window.ENV` object.
  - Copy `env.example.js` to `env.local.js` and load it before your module scripts.
  - Example in HTML:
    ```html
    <script src="./env.local.js"></script>
    <script type="module" src="./admin-panel.js"></script>
    ```

## Production Checklist
- [ ] Confirm RLS is enabled for all tables accessed from the browser.
- [ ] Test with an unprivileged anon session that only allowed data is readable/writable.
- [ ] Rotate keys if you ever accidentally exposed a non-anon secret.
- [ ] Consider moving sensitive operations behind a minimal backend (serverless function) when needed.