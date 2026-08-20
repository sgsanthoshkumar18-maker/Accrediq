/* AQcredix — which departments must maintain the SOP for a given Objective Element.
 *
 * Derived by INVERTING audit/scope-data.js, which is itself generated from the NABH
 * assessor checklist. That direction matters: the checklist publishes, per department,
 * the element codes an assessor will examine there. Turning that around gives, per
 * element, the departments answerable for it — a published fact rather than a keyword
 * guess. Nothing here is hand-authored, so it stays correct when the scope is
 * regenerated with `node build/build-scope.js`.
 *
 * Built once, lazily, on first use. The map is ~640 elements against 45 departments;
 * doing it at load time on every standards page view would be wasted work for the many
 * visitors who never open an SOP element.
 */
window.AQSopDepts = (function () {
  "use strict";

  var map = null;

  function build() {
    var scope = window.AUDIT_SCOPE || {};
    var out = {};
    Object.keys(scope).forEach(function (key) {
      var d = scope[key];
      if (!d || !d.codes) return;
      d.codes.forEach(function (code) {
        if (!out[code]) out[code] = [];
        /* A department can appear once per element only. Codes are listed per area in
           the checklist and an area may inherit another's scope, so duplicates are
           possible and would otherwise show the same department twice in the panel. */
        if (out[code].indexOf(d.name) < 0) out[code].push(d.name);
      });
    });
    Object.keys(out).forEach(function (c) { out[c].sort(); });
    return out;
  }

  /* Departments answerable for one element code, e.g. "AAC.1.c". Always an array. */
  function forCode(code) {
    if (!map) map = build();
    return map[code] || [];
  }

  /* Eight of the 188 asterisked elements are not scoped to any area in the checklist —
     they are organisation-wide (governance, policy, management commitment). Saying so
     plainly is correct; inventing a department for them would be worse than a blank,
     because a hospital would then file the SOP in the wrong place and an assessor would
     find nobody accountable for it. */
  var UNSCOPED = "Hospital-wide — not scoped to a single department";

  function labelFor(code) {
    var d = forCode(code);
    return d.length ? d.join(", ") : UNSCOPED;
  }

  function countFor(code) { return forCode(code).length; }

  return { forCode: forCode, labelFor: labelFor, countFor: countFor, UNSCOPED: UNSCOPED };
})();
