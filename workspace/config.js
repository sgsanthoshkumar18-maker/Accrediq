/* AQcredix — backend configuration.
 *
 * LEAVE THIS FILE AS-IS and the workspace runs in LOCAL mode: everything works,
 * but data is stored in the visitor's own browser only. That is fine for trying it
 * out, and useless as a product — one cleared browser and the work is gone.
 *
 * To switch on real accounts, persistence and team seats:
 *
 *   1. Create a free project at supabase.com
 *   2. Open the SQL Editor and run the whole of workspace/schema.sql
 *   3. Settings -> API. Copy the Project URL and the anon/public key
 *   4. Paste them below, redeploy
 *
 * The anon key is designed to be public — it is safe in client-side code. Every
 * table is protected by row-level security so a signed-in user can only ever read
 * and write rows belonging to their own organisation. NEVER put the service_role
 * key in this file; it bypasses all of that.
 */
window.AQ_CONFIG = {
  supabaseUrl: "",        // e.g. "https://abcdefghijkl.supabase.co"
  supabaseAnonKey: "",    // the anon / public key, not service_role

  // Shown in the workspace header.
  productName: "AQcredix Workspace",

  // Seats included before the UI suggests upgrading. Presentational only —
  // real enforcement belongs on the server, not in the browser.
  includedSeats: 5
};
