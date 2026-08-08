/* AQcredix Workspace — data layer.
 *
 * One API, two backends:
 *   local     — IndexedDB-backed, single user, works with zero setup. Data lives in
 *               this browser only, which is exactly the limitation the workspace exists
 *               to remove, so the UI says so plainly.
 *   supabase  — real accounts, real persistence, real team seats with row-level
 *               security. Activated by filling in workspace/config.js.
 *
 * Everything above this layer (workspace.js, capa.js, documents.js, team.js) is
 * backend-agnostic and does not change when you switch.
 */
(function () {
  "use strict";

  var CFG = window.AQ_CONFIG || {};
  var MODE = (CFG.supabaseUrl && CFG.supabaseAnonKey) ? "supabase" : "local";

  /* ============================ LOCAL ADAPTER ============================ */
  // IndexedDB rather than localStorage: evidence notes and long CAPA text blow past
  // the 5MB localStorage ceiling quickly once a hospital is a few months in.
  var DB_NAME = "aqcredix-workspace", DB_VER = 3;
  // v2 adds "audits". createObjectStore is additive inside onupgradeneeded, so the
  // bump creates the new store and leaves existing element/CAPA data untouched.
  var STORES = ["elements", "capa", "documents", "members", "audits", "incidents", "meta"];
  var _db = null;

  function openDB() {
    return new Promise(function (res, rej) {
      if (_db) return res(_db);
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        STORES.forEach(function (s) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
        });
      };
      req.onsuccess = function () { _db = req.result; res(_db); };
      req.onerror = function () { rej(req.error); };
    });
  }

  function tx(store, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, mode), s = t.objectStore(store), out;
        out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }

  var localAdapter = {
    mode: "local",
    async currentUser() {
      var m = await tx("meta", "readonly", function (s) { return s.get("profile"); });
      return m ? m.value : null;
    },
    async signIn(profile) {
      await tx("meta", "readwrite", function (s) {
        s.put({ id: "profile", value: profile });
      });
      return profile;
    },
    async signOut() {
      await tx("meta", "readwrite", function (s) { s.delete("profile"); });
    },
    async list(store) {
      return await tx(store, "readonly", function (s) { return s.getAll(); });
    },
    async put(store, row) {
      row.updated_at = new Date().toISOString();
      await tx(store, "readwrite", function (s) { s.put(row); });
      return row;
    },
    async remove(store, id) {
      await tx(store, "readwrite", function (s) { s.delete(id); });
    },
    async clearAll() {
      for (var i = 0; i < STORES.length; i++) {
        await tx(STORES[i], "readwrite", function (s) { s.clear(); });
      }
      _db = null;
    }
  };

  /* =========================== SUPABASE ADAPTER =========================== */
  // Talks to PostgREST directly over fetch — no SDK, so nothing to bundle and the
  // no-build-step architecture is preserved.
  function sbAdapter() {
    var url = CFG.supabaseUrl.replace(/\/$/, "");
    var key = CFG.supabaseAnonKey;
    var TOKEN_KEY = "aq-sb-session";

    function session() {
      try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); } catch (e) { return null; }
    }
    function setSession(s) {
      if (s) localStorage.setItem(TOKEN_KEY, JSON.stringify(s));
      else localStorage.removeItem(TOKEN_KEY);
    }
    function headers(auth) {
      var h = { "apikey": key, "Content-Type": "application/json" };
      var s = session();
      h["Authorization"] = "Bearer " + ((auth !== false && s && s.access_token) ? s.access_token : key);
      return h;
    }
    async function req(path, opts) {
      var r = await fetch(url + path, opts);
      if (r.status === 401) {                       // token expired — try one refresh
        var s = session();
        if (s && s.refresh_token) {
          var rr = await fetch(url + "/auth/v1/token?grant_type=refresh_token", {
            method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: s.refresh_token })
          });
          if (rr.ok) {
            setSession(await rr.json());
            opts.headers = headers();
            r = await fetch(url + path, opts);
          } else { setSession(null); }
        }
      }
      if (!r.ok) throw new Error((await r.text()) || r.statusText);
      var t = await r.text();
      return t ? JSON.parse(t) : null;
    }

    return {
      mode: "supabase",
      async currentUser() {
        var s = session();
        if (!s || !s.access_token) return null;
        try {
          var u = await req("/auth/v1/user", { headers: headers() });
          var rows = await req("/rest/v1/members?select=*&user_id=eq." + u.id, { headers: headers() });
          var m = rows && rows[0];
          return { id: u.id, email: u.email, name: (m && m.name) || u.email,
                   role: (m && m.role) || "viewer", org_id: m && m.org_id };
        } catch (e) { return null; }
      },
      async signUp(email, password, name, orgName) {
        var s = await req("/auth/v1/signup", {
          method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password,
            data: { name: name, org_name: orgName } })
        });
        if (s && s.access_token) setSession(s);
        return s;
      },
      async signInPassword(email, password) {
        var s = await req("/auth/v1/token?grant_type=password", {
          method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password })
        });
        setSession(s);
        return s;
      },
      async signOut() {
        try { await req("/auth/v1/logout", { method: "POST", headers: headers() }); } catch (e) {}
        setSession(null);
      },
      async list(store) {
        return await req("/rest/v1/" + store + "?select=*", { headers: headers() }) || [];
      },
      async put(store, row) {
        row.updated_at = new Date().toISOString();
        var h = headers(); h["Prefer"] = "resolution=merge-duplicates,return=representation";
        var out = await req("/rest/v1/" + store, {
          method: "POST", headers: h, body: JSON.stringify(row)
        });
        return (out && out[0]) || row;
      },
      async remove(store, id) {
        await req("/rest/v1/" + store + "?id=eq." + encodeURIComponent(id),
          { method: "DELETE", headers: headers() });
      },
      async invite(email, name, role) {
        return await this.put("members", {
          id: "inv_" + Math.random().toString(36).slice(2, 11),
          email: email, name: name, role: role, status: "invited"
        });
      }
    };
  }

  var A = MODE === "supabase" ? sbAdapter() : localAdapter;

  /* ============================= PUBLIC API ============================= */

  // Element ids are the NABH code, so a status row is addressable and stable.
  function elementId(code) { return code; }

  var Store = {
    mode: MODE,
    adapter: A,

    isConfigured: function () { return MODE === "supabase"; },

    currentUser: function () { return A.currentUser(); },
    signOut: function () { return A.signOut(); },

    /* ---- element readiness ---- */
    async elements() {
      var rows = await A.list("elements");
      var map = {};
      rows.forEach(function (r) { map[r.id] = r; });
      return map;
    },
    async setElement(code, patch) {
      var rows = await A.list("elements");
      var cur = rows.filter(function (r) { return r.id === code; })[0] || { id: elementId(code) };
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      return A.put("elements", cur);
    },

    /* ---- CAPA ---- */
    capaList: function () { return A.list("capa"); },
    saveCapa: function (row) {
      if (!row.id) row.id = "capa_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (!row.created_at) row.created_at = new Date().toISOString();
      return A.put("capa", row);
    },
    deleteCapa: function (id) { return A.remove("capa", id); },

    /* ---- documents ---- */
    documents: function () { return A.list("documents"); },
    saveDocument: function (row) {
      if (!row.id) row.id = "doc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (!row.created_at) row.created_at = new Date().toISOString();
      return A.put("documents", row);
    },
    deleteDocument: function (id) { return A.remove("documents", id); },

    /* ---- team ---- */
    members: function () { return A.list("members"); },
    saveMember: function (row) {
      if (!row.id) row.id = "mem_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return A.put("members", row);
    },
    deleteMember: function (id) { return A.remove("members", id); },

    /* ---- readiness maths ---- */
    // Weighted by category: a Core failure is not equivalent to an Excellence gap,
    // and a readiness score that pretends otherwise misleads the user.
    // nabh-data.js spells the top category "CORE"; normalise so a future spelling
    // change cannot silently drop the 105 most important elements to weight 1.
    WEIGHTS: { core: 3, commitment: 2, achievement: 1.5, excellence: 1 },
    weightOf: function (cat) { return Store.WEIGHTS[String(cat || "").toLowerCase()] || 1; },
    isCore: function (cat) { return String(cat || "").toLowerCase() === "core"; },

    readiness: function (statusMap) {
      var D = window.NABH_DATA;
      var out = { total: 0, scored: 0, weight: 0, gained: 0,
                  byStatus: { compliant: 0, partial: 0, nc: 0, na: 0, unassessed: 0 },
                  byChapter: {}, coreOpen: 0, sopOpen: 0 };
      if (!D) return out;

      Object.keys(D.chapters).forEach(function (ck) {
        var ch = D.chapters[ck], cw = 0, cg = 0, ct = 0, cdone = 0;
        ch.standards.forEach(function (st) {
          st.elements.forEach(function (el) {
            var code = st.code + "." + el.letter;
            var row = statusMap[code];
            var s = (row && row.status) || "unassessed";
            var w = Store.weightOf(el.category);

            out.total++; ct++;
            out.byStatus[s] = (out.byStatus[s] || 0) + 1;

            if (s === "na") return;                  // excluded from the denominator
            out.weight += w; cw += w;
            var gain = s === "compliant" ? 1 : s === "partial" ? 0.5 : 0;
            out.gained += w * gain; cg += w * gain;
            if (s !== "unassessed") { out.scored++; cdone++; }
            if (s !== "compliant" && Store.isCore(el.category)) out.coreOpen++;
            if (s !== "compliant" && el.sop) out.sopOpen++;
          });
        });
        out.byChapter[ck] = {
          name: ch.name, code: ch.code,
          pct: cw ? Math.round((cg / cw) * 100) : 0,
          assessed: cdone, total: ct
        };
      });
      out.pct = out.weight ? Math.round((out.gained / out.weight) * 100) : 0;
      out.assessedPct = out.total ? Math.round((out.scored / out.total) * 100) : 0;
      return out;
    },

    /* ---- portability: the user's data is theirs ---- */
    async exportAll() {
      return {
        exported_at: new Date().toISOString(),
        version: 1,
        elements: await A.list("elements"),
        capa: await A.list("capa"),
        documents: await A.list("documents"),
        members: await A.list("members"),
        audits: await A.list("audits"),
        incidents: await A.list("incidents")
      };
    },
    async importAll(data) {
      var stores = ["elements", "capa", "documents", "members", "audits", "incidents"];
      for (var i = 0; i < stores.length; i++) {
        var rows = data[stores[i]] || [];
        for (var j = 0; j < rows.length; j++) await A.put(stores[i], rows[j]);
      }
    },
    clearAll: function () { return A.clearAll ? A.clearAll() : Promise.resolve(); }
  };

  window.AQStore = Store;
})();
