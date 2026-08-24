/* The presigned video link.
 *
 * The signature is the part worth testing. If it is wrong, R2 answers a bare 403 and
 * nothing in our own logs explains it — the request never reaches us. So it is checked
 * here against Amazon's published worked example for a presigned GET, which pins every
 * step of the algorithm: the canonical request, the scope, the derived signing key and
 * the final HMAC. R2 implements the same Signature Version 4, differing only in host and
 * in using the literal region "auto".
 */
const path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '\n      got ', g, '\n      want', w); } };

const mod = require(path.join(__dirname, '../api/video-url.js'));
const { signedUrl, safeKey } = mod;

// --- Amazon's own example -------------------------------------------------
// From the AWS documentation for a Signature Version 4 presigned GET: bucket
// "examplebucket", key "test.txt", 24 hours, the well-known example credentials, signed
// at 2013-05-24T00:00:00Z in us-east-1. The expected signature is published with it.
const url = signedUrl({
  host: 'examplebucket.s3.amazonaws.com',
  region: 'us-east-1',
  bucket: 'examplebucket',
  key: 'test.txt',
  bucketInPath: false,          // that example addresses the bucket by hostname
  keyId: 'AKIAIOSFODNN7EXAMPLE',
  secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  expires: 86400,
  date: new Date(Date.UTC(2013, 4, 24, 0, 0, 0))
});
const sig = /X-Amz-Signature=([0-9a-f]+)/.exec(url);
eq(!!sig, true, 'a signature is present in the url');
eq(sig && sig[1],
   'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
   'signature matches the published AWS example');

eq(/X-Amz-Date=20130524T000000Z/.test(url), true, 'timestamp is the basic ISO8601 form');
eq(/X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request/.test(url),
   true, 'credential scope is date/region/s3/aws4_request, url-encoded');
eq(/X-Amz-SignedHeaders=host/.test(url), true, 'only host is signed');

// --- the R2 shape ---------------------------------------------------------
const r2 = signedUrl({
  host: '29abccd656b29b5cd5edc1074992b6d3.r2.cloudflarestorage.com',
  region: 'auto', bucket: 'aqcredix-videos', key: 'john-felix-web.mp4',
  keyId: 'k', secret: 's', expires: 7200,
  date: new Date(Date.UTC(2026, 7, 24, 12, 0, 0))
});
eq(/\/aqcredix-videos\/john-felix-web\.mp4\?/.test(r2), true,
   'r2 addresses the bucket in the path, not the hostname');
eq(/\/auto\/s3\/aws4_request/.test(decodeURIComponent(r2)), true, 'r2 region is "auto"');
eq(/X-Amz-Expires=7200/.test(r2), true, 'expiry is carried in the link');

// Tampering must break it: the signature covers the path, so a link edited to point at a
// different file is no longer valid. This is what stops one subscriber's link being edited
// into a key for every other video in the bucket.
const other = signedUrl({
  host: '29abccd656b29b5cd5edc1074992b6d3.r2.cloudflarestorage.com',
  region: 'auto', bucket: 'aqcredix-videos', key: 'someone-else.mp4',
  keyId: 'k', secret: 's', expires: 7200,
  date: new Date(Date.UTC(2026, 7, 24, 12, 0, 0))
});
eq(/X-Amz-Signature=([0-9a-f]+)/.exec(r2)[1] !==
   /X-Amz-Signature=([0-9a-f]+)/.exec(other)[1], true,
   'a different key produces a different signature');

// --- key validation -------------------------------------------------------
eq(safeKey('john-felix-web.mp4'), 'john-felix-web.mp4', 'an ordinary name is accepted');
eq(safeKey('talks/2026/intro.mp4'), 'talks/2026/intro.mp4', 'folders are allowed');
eq(safeKey('/leading-slash.mp4'), 'leading-slash.mp4', 'a leading slash is trimmed');
eq(safeKey('../../etc/passwd'), null, 'parent-directory hops are refused');
eq(safeKey('a/../../b.mp4'), null, 'a hop in the middle is refused too');
eq(safeKey('file name.mp4'), null, 'spaces are refused');
eq(safeKey('drop;table.mp4'), null, 'punctuation outside the allowed set is refused');
eq(safeKey(''), null, 'empty is refused');
eq(safeKey(null), null, 'missing is refused');
eq(safeKey('x'.repeat(201)), null, 'absurdly long is refused');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
