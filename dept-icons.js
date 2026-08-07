/* AQcredix — department icon set.
 *
 * Extracted from departments.html so more than one page can use it. The department cards,
 * the About page orbit and the hero orbit all draw from this single map; duplicating the
 * paths would guarantee they drift apart the first time one is edited.
 *
 * Each value is the inner markup of a 24x24 stroke icon. Wrap in:
 *   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
 *        stroke-linecap="round" stroke-linejoin="round"> ... </svg>
 */
window.DEPT_ICONS = {
    pill:'<path d="M4.5 15.5 15.5 4.5a5 5 0 1 1 7 7L11.5 22.5a5 5 0 1 1-7-7Z"/><path d="M9 9l6 6" stroke-linecap="round"/>',
    heart:'<path d="M12 21s-7-4.5-9.5-9C.7 8.3 2.5 4.5 6.3 4.5c2 0 3.4 1 5.7 3.5C14.3 5.5 15.7 4.5 17.7 4.5c3.8 0 5.6 3.8 3.8 7.5C19 16.5 12 21 12 21Z"/>',
    zap:'<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" stroke-linejoin="round"/>',
    activity:'<path d="M22 12h-4l-3 8-6-16-3 8H2" stroke-linecap="round" stroke-linejoin="round"/>',
    scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.5 15.5M8.5 8.5 20 20"/>',
    flask:'<path d="M9 2h6M10 2v6l-6 12a1 1 0 0 0 1 1.5h14a1 1 0 0 0 1-1.5l-6-12V2" stroke-linejoin="round"/>',
    droplet:'<path d="M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13Z" stroke-linejoin="round"/>',
    scan:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke-linecap="round"/><path d="M7 12h10"/>',
    spray:'<path d="M9 2v3M6 5h6l1 3H5l1-3Z" stroke-linejoin="round"/><path d="M8 8v13M4 13h1M4 17h1M20 8h1M20 12h1"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>',
    cpu:'<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    package:'<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" stroke-linejoin="round"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    file:'<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke-linejoin="round"/><path d="M14 2v5h5"/>',
    utensils:'<path d="M6 2v7a2 2 0 0 0 4 0V2M8 9v13M18 2c-2 0-3 3-3 6s1 3 3 3 0 8 0 11" stroke-linecap="round" stroke-linejoin="round"/>',
    tool:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8Z" stroke-linejoin="round"/>',
    briefcase:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20"/>',
    shirt:'<path d="M8 2 4 6l3 3 2-1v12h6V8l2 1 3-3-4-4-2 2h-4L8 2Z" stroke-linejoin="round"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
    server:'<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    shield:'<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>',
    shieldlock:'<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke-linejoin="round"/><rect x="9.2" y="11" width="5.6" height="4.6" rx="1"/><path d="M10.4 11V9.6a1.6 1.6 0 0 1 3.2 0V11"/>',
    megaphone:'<path d="M3 11v2a2 2 0 0 0 2 2h1l3 6h2l-1-6h4l6 4V5l-6 4H5a2 2 0 0 0-2 2Z" stroke-linejoin="round"/>'
  };
