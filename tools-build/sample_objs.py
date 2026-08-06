#!/usr/bin/env python3
"""Sample N uniform surface points from each organ OBJ, plus a k-NN wireframe edge
list, and emit a compact JS data file. Streams the OBJ so the 461MB brain fits in RAM."""
import os, sys, glob, math, random, json

random.seed(7)                      # deterministic output across runs
N = 850                             # must match N_POINTS in face/face.js
RADIUS = 1.55                       # must match the radius face.js passes to buildAll
K = 5                               # neighbours per point for the wireframe

# obj directory -> shape key used by face.js / organs.js
MAP = {
    "Blue_Wireframe_Head":    "face",
    "Prismatic_Brain_Conne":  "brain",
    "Neon_Heart":             "heart",
    "Lungs_of_Light":         "lungs",
    "Neon_Geometric_Kidney":  "kidney",
}

def parse_obj(path):
    """Return (verts, uvs, tris). tris carry (vertIdx, uvIdx) pairs so we can look up
    each sampled point's colour in the texture map."""
    verts, uvs, tris = [], [], []
    with open(path, "r", errors="ignore") as f:
        for line in f:
            if line.startswith("v "):
                p = line.split()
                verts.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith("vt "):
                p = line.split()
                uvs.append((float(p[1]), float(p[2])))
            elif line.startswith("f "):
                idx = []
                for tok in line.split()[1:]:
                    parts = tok.split("/")
                    if not parts[0]:
                        continue
                    i = int(parts[0]); vi = i - 1 if i > 0 else len(verts) + i
                    ti = -1
                    if len(parts) > 1 and parts[1]:
                        t = int(parts[1]); ti = t - 1 if t > 0 else len(uvs) + t
                    idx.append((vi, ti))
                for k in range(1, len(idx) - 1):
                    tris.append((idx[0], idx[k], idx[k + 1]))
    return verts, uvs, tris

def sample_surface(verts, uvs, tris, n, tex):
    """Area-weighted uniform sampling over the triangle soup."""
    areas, cum = [], []
    total = 0.0
    for (A, B, C) in tris:
        pa, pb, pc = verts[A[0]], verts[B[0]], verts[C[0]]
        ux, uy, uz = pb[0]-pa[0], pb[1]-pa[1], pb[2]-pa[2]
        vx, vy, vz = pc[0]-pa[0], pc[1]-pa[1], pc[2]-pa[2]
        cx, cy, cz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
        ar = 0.5 * math.sqrt(cx*cx + cy*cy + cz*cz)
        total += ar
        areas.append(ar); cum.append(total)

    import bisect
    out, cols = [], []
    tw, th, px = tex if tex else (0, 0, None)
    for _ in range(n):
        r = random.random() * total
        t = tris[min(bisect.bisect_left(cum, r), len(tris) - 1)]
        A, B, C = t
        pa, pb, pc = verts[A[0]], verts[B[0]], verts[C[0]]
        u, v = random.random(), random.random()
        if u + v > 1.0:
            u, v = 1.0 - u, 1.0 - v
        w = 1.0 - u - v
        out.append([pa[i]*w + pb[i]*u + pc[i]*v for i in range(3)])

        # Interpolate UV, then read the texture — this is the particle's real colour.
        c = (200, 200, 200)
        if px and A[1] >= 0 and B[1] >= 0 and C[1] >= 0:
            ta, tb, tc = uvs[A[1]], uvs[B[1]], uvs[C[1]]
            uu = ta[0]*w + tb[0]*u + tc[0]*v
            vv = ta[1]*w + tb[1]*u + tc[1]*v
            x = int((uu % 1.0) * (tw - 1)); y = int((1.0 - (vv % 1.0)) * (th - 1))
            try:
                p = px[x, y]
                c = (p[0], p[1], p[2])
            except Exception:
                pass
        cols.append("#%02x%02x%02x" % c)
    return out, cols

def orient(pts, key):
    """Meshy exports are Y-up, facing +Z. face.js expects the lateral profile facing -X
    for the head and an upright anterior view for the organs. Rotate about Y only, so
    proportions are untouched."""
    yaw = {"face": -math.pi / 2, "brain": -math.pi / 2}.get(key, 0.0)
    if not yaw:
        return pts
    ca, sa = math.cos(yaw), math.sin(yaw)
    return [[x*ca + z*sa, y, -x*sa + z*ca] for (x, y, z) in pts]

def normalise(pts, radius):
    """Centre on the bounding-box middle, then scale so the farthest point sits at radius.
    Uniform scale on all three axes — proportions are preserved exactly."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
    cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2; cz = (min(zs) + max(zs)) / 2
    c = [[p[0]-cx, p[1]-cy, p[2]-cz] for p in pts]
    maxr = max(math.sqrt(x*x + y*y + z*z) for (x, y, z) in c) or 1.0
    k = radius / maxr
    return [[round(x*k, 4), round(y*k, 4), round(z*k, 4)] for (x, y, z) in c]

def knn_edges(pts, k):
    """Undirected k-nearest-neighbour edges — the wireframe skin."""
    n = len(pts)
    edges = set()
    for i in range(n):
        xi, yi, zi = pts[i]
        d = []
        for j in range(n):
            if j == i:
                continue
            dx = pts[j][0]-xi; dy = pts[j][1]-yi; dz = pts[j][2]-zi
            d.append((dx*dx + dy*dy + dz*dz, j))
        d.sort()
        for _, j in d[:k]:
            edges.add((i, j) if i < j else (j, i))
    return sorted(edges)

def main():
    src = sys.argv[1]; dest = sys.argv[2]
    shapes, edges, colours = {}, {}, {}
    for d in sorted(glob.glob(os.path.join(src, "*"))):
        base = os.path.basename(d)
        key = next((v for k, v in MAP.items() if k in base), None)
        if not key:
            continue
        objs = glob.glob(os.path.join(d, "**", "*.obj"), recursive=True)
        if not objs:
            continue
        verts, uvs, tris = parse_obj(objs[0])
        tex = None
        import glob as _g
        imgs = _g.glob(os.path.join(d, "**", "*.png"), recursive=True) + \
               _g.glob(os.path.join(d, "**", "*.jpg"), recursive=True)
        if imgs:
            try:
                from PIL import Image
                im = Image.open(imgs[0]).convert("RGB")
                tex = (im.size[0], im.size[1], im.load())
            except Exception as e:
                print("   (texture unreadable:", e, ")")
        raw, cols = sample_surface(verts, uvs, tris, N, tex)
        pts = normalise(orient(raw, key), RADIUS)
        shapes[key] = pts
        colours[key] = cols
        edges[key] = knn_edges(pts, K)
        print(f"  {key:7s} {len(verts):>8,} verts -> {len(pts)} points, {len(edges[key])} edges")

    js = ["/* AQcredix — organ point clouds sampled from the source OBJ meshes.",
          " * Generated by tools-build/sample_objs.py — do not hand-edit.",
          f" * {N} area-weighted surface points per organ (index i maps 1:1 across shapes,",
          " * which is what keeps the morph continuous), plus k-NN wireframe edges.",
          " * Uniform scale only — no per-axis adjustment, so proportions match the source. */",
          "window.ORGAN_MESH = {", '  points: {']
    for k, v in shapes.items():
        js.append(f'    "{k}": {json.dumps(v, separators=(",", ":"))},')
    js.append("  },")
    js.append("  edges: {")
    for k, v in edges.items():
        js.append(f'    "{k}": {json.dumps([list(e) for e in v], separators=(",", ":"))},')
    js.append("  },")
    js.append("  colors: {")
    for k, v in colours.items():
        js.append(f'    "{k}": {json.dumps(v, separators=(",", ":"))},')
    js.append("  }")
    js.append("};")
    open(dest, "w").write("\n".join(js) + "\n")
    print(f"\nwrote {dest} ({os.path.getsize(dest)/1024:.0f} KB)")

if __name__ == "__main__":
    main()
