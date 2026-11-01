#!/usr/bin/env python3
"""Trace Next Day Moulding's profile drawings into outlines for src/model/nextDay.ts.

Usage: python3 scripts/trace-nextday.py IMAGE_DIR
Reads the catalog in src/model/nextDay.ts, downloads each profile drawing (us.evocdn.io) into
IMAGE_DIR if it isn't there, and writes the traced shapes back into the catalog.
The drawings are full scale at 300 dpi: one line outline, with the logo top left, a dimension
bracket and size text beside it. The outline is the biggest drawn thing below the logo; it's
filled, its edge traced and simplified, and scaled to the listed sizes when the drawing is close.
"""
import json, os, re, sys, urllib.request
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure

DPI = 300.0
src_path = 'src/model/nextDay.ts'
src = open(src_path).read()
m = re.search(r'(export const nextDayCatalog: NextDayProfile\[\] = )(\[.*?\]);\n', src, re.S)
cat = json.loads(m.group(2))
imgdir = sys.argv[1]
os.makedirs(imgdir, exist_ok=True)

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a; n = np.hypot(*ab)
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / n if n else float(np.hypot(p[0] - a[0], p[1] - a[1])) for p in pts]
    i = int(np.argmax(d))
    if d[i] > eps: return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]

def trace(path):
    # Thin or light outlines: a looser threshold and a little more thickening closes the gaps
    return trace_at(path, 160, 2) or trace_at(path, 215, 3) or trace_at(path, 235, 5)

def trace_at(path, level, grow):
    im = Image.open(path).convert('L')
    k = im.width / 2550                     # most drawings are 2550 px wide (300 dpi); a few are small copies
    if k < 0.5:                             # blow the small ones up so the outline traces smoothly
        im = im.resize((2550, round(im.height / k)), Image.LANCZOS); k = 1.0
    g = np.asarray(im) < level
    g[:520, :1000] = False                  # the logo and web address (tall profiles start higher)
    lab, n = ndimage.label(ndimage.binary_dilation(g, iterations=grow))
    if not n: return None
    boxes = ndimage.find_objects(lab)
    area = [(s[0].stop - s[0].start) * (s[1].stop - s[1].start) for s in boxes]
    k = int(np.argmax(area)) + 1
    line = lab == k
    sl = boxes[k - 1]
    sub = line[sl[0].start - 2:sl[0].stop + 2, sl[1].start - 2:sl[1].stop + 2]
    # Inside = what the outside can't reach
    outside = ndimage.binary_fill_holes(sub) & ~sub
    solid = sub | outside
    solid = ndimage.binary_fill_holes(solid)
    if solid.sum() < 1.15 * sub.sum(): return None   # the outline didn't close
    cs = measure.find_contours(solid.astype(float), 0.5)
    c = max(cs, key=len)
    pts = [(float(x), float(y)) for y, x in c]
    pts = rdp(pts, 1.2)
    h, w = solid.shape
    out = [((x - 2) / DPI, (h - 2 - y) / DPI) for x, y in pts]
    xs, ys = [p[0] for p in out], [p[1] for p in out]
    x0, y0 = min(xs), min(ys)
    out = [(round(x - x0, 4), round(y - y0, 4)) for x, y in out]
    return out

done = fail = 0
for p in cat:
    url = p.get('img')
    if not url: continue
    f = os.path.join(imgdir, url.rsplit('/', 1)[1])
    if not os.path.exists(f):
        try: urllib.request.urlretrieve(url, f)
        except Exception as e: print('download failed', p['num'], e); fail += 1; continue
    try: shape = trace(f)
    except Exception as e: shape = None; print('trace failed', p['num'], e)
    if not shape: fail += 1; p.pop('shape', None); continue
    sw = max(x for x, _ in shape); sh = max(y for _, y in shape)
    # Snap to the listed size when the drawing is within 15% of it (either way up)
    want = sorted([p['w'], p['t']]) if p['category'] != 'Crown' else None
    if p['category'] == 'Crown' and p.get('fit'): want = None
    have = sorted([sw, sh])
    # Crowns are drawn as installed: snap the box to the listed projection and drop
    if p['category'] == 'Crown' and p.get('fit') and abs(sw / p['fit']['depth'] - 1) < 0.2 and abs(sh / p['fit']['height'] - 1) < 0.2:
        fx, fy = p['fit']['depth'] / sw, p['fit']['height'] / sh
        shape = [(round(x * fx, 4), round(y * fy, 4)) for x, y in shape]
        sw, sh = sw * fx, sh * fy
    elif want and all(abs(a / b - 1) < 0.15 for a, b in zip(have, want)):
        fx = (want[1] if sw >= sh else want[0]) / sw; fy = (want[1] if sh > sw else want[0]) / sh
        shape = [(round(x * fx, 4), round(y * fy, 4)) for x, y in shape]
        sw, sh = sw * fx, sh * fy
    p['shape'] = shape; p['sw'] = round(sw, 4); p['sh'] = round(sh, 4)
    if p['category'] == 'Crown': p['angled'] = True
    done += 1
src = src[:m.start(2)] + json.dumps(cat, separators=(',', ':')) + src[m.end(2):]
open(src_path, 'w').write(src)
print(done, 'traced,', fail, 'without a shape')
