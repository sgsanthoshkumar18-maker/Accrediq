/* A minimal DOM, enough to exercise Split.splitNode without a dependency.
 *
 * The environment has no network, so jsdom is not installable, and the split is the one
 * piece of the motion layer with real logic worth testing: it walks text nodes and must
 * leave <br> and <span class="em"> intact. Everything else in that file is wiring and is
 * asserted against the source.
 */
const TEXT = 3, ELEM = 1, FRAG = 11;

class Node {
  constructor(type) { this.nodeType = type; this.childNodes = []; this.parentNode = null; }
  appendChild(c) {
    if (c.nodeType === FRAG) { c.childNodes.slice().forEach(x => this.appendChild(x)); return c; }
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this; this.childNodes.push(c); return c;
  }
  removeChild(c) {
    const i = this.childNodes.indexOf(c);
    if (i >= 0) { this.childNodes.splice(i, 1); c.parentNode = null; }
    return c;
  }
  replaceChild(nw, old) {
    const i = this.childNodes.indexOf(old);
    if (i < 0) throw new Error('replaceChild: node not found');
    const list = nw.nodeType === FRAG ? nw.childNodes.slice() : [nw];
    list.forEach(n => { n.parentNode = this; });
    this.childNodes.splice(i, 1, ...list);
    old.parentNode = null;
    return old;
  }
  get textContent() {
    if (this.nodeType === TEXT) return this.nodeValue;
    return this.childNodes.map(c => c.textContent).join('');
  }
  /* A setter is required, not optional: without it `el.textContent = x` on an object
     with a getter-only accessor fails silently, which is exactly how a real browser
     would NOT behave and would have made this harness lie. */
  set textContent(v) {
    if (this.nodeType === TEXT) { this.nodeValue = String(v); return; }
    this.childNodes.slice().forEach(c => this.removeChild(c));
    this.appendChild(new Text(String(v)));
  }
}

class Text extends Node {
  constructor(v) { super(TEXT); this.nodeValue = v; }
}

class Element extends Node {
  constructor(tag) {
    super(ELEM);
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this._classes = new Set();
    this.style = {
      props: {},
      setProperty: (k, v) => { this.style.props[k] = String(v); }
    };
    const self = this;
    this.classList = {
      add: (...c) => c.forEach(x => self._classes.add(x)),
      remove: (...c) => c.forEach(x => self._classes.delete(x)),
      contains: c => self._classes.has(c)
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  querySelectorAll(sel) {
    // Only the forms the tests need: '.cls' and 'tag'.
    const out = [];
    const want = sel.startsWith('.') ? { cls: sel.slice(1) } : { tag: sel.toUpperCase() };
    (function walk(n) {
      n.childNodes.forEach(c => {
        if (c.nodeType !== ELEM) return;
        if (want.cls ? c._classes.has(want.cls) : c.tagName === want.tag) out.push(c);
        walk(c);
      });
    })(this);
    return out;
  }
  /* Serialise back to HTML so a test can assert the structure survived. */
  get outerHTML() {
    const attrs = Object.keys(this.attrs).map(k => ` ${k}="${this.attrs[k]}"`).join('');
    const cls = this._classes.size ? ` class="${this.className}"` : '';
    const tag = this.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    return `<${tag}${cls}${attrs}>` + this.childNodes.map(c =>
      c.nodeType === TEXT ? c.nodeValue : c.outerHTML).join('') + `</${tag}>`;
  }
}

function makeDocument() {
  return {
    createElement: t => new Element(t),
    createTextNode: v => new Text(v),
    createDocumentFragment: () => new Node(FRAG)
  };
}

module.exports = { Node, Text, Element, makeDocument, TEXT, ELEM, FRAG };
