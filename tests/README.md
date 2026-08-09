# Tests

Plain Node, no framework and no install. From the repo root:

    node tests/activity.test.js
    node tests/profile.test.js
    node tests/sync.test.js

Both print a pass/fail count and exit non-zero on failure.

**activity.test.js** covers the activity ledger: guest history migrating to the account on
sign-in, Gmail dot/`+tag` normalisation resolving to one history, distinct-vs-raw counting,
the per-type cap, and the two failure modes that matter — a storage quota error inside a
feature's success path, and a corrupted ledger. Both must degrade quietly rather than throw,
because `record()` is called from inside the success path of a submitted quiz and a saved
incident, where an exception would surface to the user as that feature failing.

**profile.test.js** covers the profile page's pure helpers: rupee formatting from
`amount_paise` (including the ₹1 test plan and Indian lakh grouping), date formatting when
the value is null or unparseable, and the streak calculation — in particular that an empty
today does not break a running streak, which would otherwise read as broken every morning.

**sync.test.js** is the important one. It runs the real ledger against a fake Supabase
adapter and proves the behaviours a subscriber depends on: work done on one device is
readable from a second with an empty browser; signing out and back in loses nothing;
an action taken offline is queued, shown immediately, and lands on reconnect; repeated
syncs do not duplicate rows or spin in a retry loop; and a second account on the same
machine starts from its own history. It also asserts the row-level-security rules in
`workspace/schema.sql` directly — that select and insert are both keyed on
`auth.uid()`, that `user_id` is stamped from the JWT rather than trusted from the client,
and that no update or delete policy exists, so history is append-only.

These are the first tests in the repo. The scoring maths and the scope generator still have
none, and both produce records a hospital may show an assessor.
