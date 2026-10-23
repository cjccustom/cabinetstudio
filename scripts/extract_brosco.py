"""Brosco stock moulding chart: one poster page, profiles drawn to a reduced scale, each labelled
with its Brosco number (and WM number), a name, and thickness x width with superscript fractions."""
import re, sys, json, math, statistics
import pymupdf
sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from extract_profiles import segments, outline

def line_text(spans):
    """Rebuild a line, turning superscript numerator/denominator spans into ' n/d'."""
    out = ''
    i = 0
    while i < len(spans):
        t, sz = spans[i]['text'], spans[i]['size']
        if sz < 9 and i + 2 < len(spans) and spans[i + 1]['text'] == '/' and spans[i + 2]['size'] < 9:
            out += f' {t.strip()}/{spans[i + 2]["text"].strip()}'
            i += 3
            continue
        out += t
        i += 1
    return re.sub(r'\s+', ' ', out).strip()

def val(s):
    tot = 0.0
    for part in s.split():
        if '/' in part:
            a, b = part.split('/'); tot += int(a) / int(b)
        else: tot += float(part)
    return tot

NUMS = r'(?:\d+ \d+/\d+|\d+/\d+|\d+)'
DIM = re.compile(rf'({NUMS})\s*"?\s*x\s*({NUMS})')
LAB = re.compile(r'^\s*(B?\d{2,5}[A-Z]?)\b\s*([A-Z][A-Z .&()/-]*)?')
WM = re.compile(r'\b(L?WM\s?\d{2,4})\b')

doc = pymupdf.open(sys.argv[1]); page = doc[0]
lines = []
for b in page.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        t = line_text(l['spans'])
        if t: lines.append((t, pymupdf.Rect(l['bbox'])))
# Section headings (large, all caps, no digits) name the kind of moulding below them
heads = [(t, r) for t, r in lines if re.fullmatch(r"[A-Z][A-Z ()&,'-]{2,}", t) and r.height > 13]
dimlines = [(t, r) for t, r in lines if DIM.search(t) and not LAB.match(t)]
claimed = set()
labels = []
pending = []
for t, r in lines:
    m = LAB.match(t)
    if not m: continue
    num = m.group(1)
    if DIM.fullmatch(t.strip()) or re.fullmatch(r'\d+/\d+', num): continue
    d = DIM.search(t[m.end():])
    box = r
    if not d:
        pending.append((t, r, m)); continue
    name = (m.group(2) or '').strip()
    wm = WM.search(t)
    labels.append(dict(num=num, name=name, wm=wm.group(1).replace(' ', '') if wm else None, t=val(d.group(1)), w=val(d.group(2)), cx=(box.x0 + box.x1) / 2, cy=(box.y0 + box.y1) / 2, box=box))
# Labels without a size on their line take the nearest free size line, closest pairs first
pairs = []
for i, (t, r, m) in enumerate(pending):
    c = ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
    for j, (t2, r2) in enumerate(dimlines):
        d2 = ((r2.x0 + r2.x1) / 2, (r2.y0 + r2.y1) / 2)
        dist = math.hypot(d2[0] - c[0], (d2[1] - c[1]) * (1 if d2[1] >= c[1] else 2.5))
        if dist < 170: pairs.append((dist, i, j))
used_l, used_d = set(), set()
for dist, i, j in sorted(pairs):
    if i in used_l or j in used_d: continue
    used_l.add(i); used_d.add(j)
    t, r, m = pending[i]; t2, r2 = dimlines[j]
    d = DIM.search(t2); box = r | r2
    wm = WM.search(t)
    labels.append(dict(num=m.group(1), name=(m.group(2) or '').strip(), wm=wm.group(1).replace(' ', '') if wm else None, t=val(d.group(1)), w=val(d.group(2)), cx=(r.x0 + r.x1) / 2, cy=(r.y0 + r.y1) / 2, box=box))
labels = [L for L in labels if 0.1 < L['t'] < 3 and 0.2 < L['w'] < 12]
print(len(labels), 'labels', file=sys.stderr)

draws = [d for d in page.get_drawings() if d['rect'].height < 400 and d['rect'].width < 400]
n = len(draws); parent = list(range(n))
def find(a):
    while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
    return a
grid = {}
for i, d in enumerate(draws):
    for seg in segments(d):
        for x, y in (seg[0], seg[-1]):
            for gx in (round(x) - 1, round(x), round(x) + 1):
                for gy in (round(y) - 1, round(y), round(y) + 1):
                    for j, (x2, y2) in grid.get((gx, gy), []):
                        if abs(x - x2) < 0.8 and abs(y - y2) < 0.8: parent[find(i)] = find(j)
            grid.setdefault((round(x), round(y)), []).append((i, (x, y)))
groups = {}
for i in range(n): groups.setdefault(find(i), []).append(i)
cands = []
for g in groups.values():
    r = draws[g[0]]['rect']
    for i in g[1:]: r = r | draws[i]['rect']
    if r.width > 4 and r.height > 4: cands.append((r, g))
print(len(cands), 'drawn shapes', file=sys.stderr)

# Scale: points per inch, from labels whose nearest shape has the printed aspect ratio
ratios = []
for L in labels:
    for r, g in cands:
        dist = math.hypot((r.x0 + r.x1) / 2 - L['cx'], (r.y0 + r.y1) / 2 - L['cy'])
        if dist > 120: continue
        for a, b in ((L['t'], L['w']), (L['w'], L['t'])):
            sa, sb = r.width / a, r.height / b
            if abs(sa - sb) / sa < 0.04: ratios.append(sa)
scale = statistics.median(ratios)
print('scale pts/in', round(scale, 2), 'from', len(ratios), file=sys.stderr)

out = {}
for L in labels:
    best = None
    for r, g in cands:
        bw, bh = r.width / scale, r.height / scale
        dist = math.hypot((r.x0 + r.x1) / 2 - L['cx'], (r.y0 + r.y1) / 2 - L['cy'])
        if dist > 160: continue
        for ew, eh in ((L['t'], L['w']), (L['w'], L['t'])):
            if abs(bw - ew) <= max(0.06, ew * 0.06) and abs(bh - eh) <= max(0.06, eh * 0.06):
                if best is None or dist < best[0]: best = (dist, r, g)
    angled = False
    crownish = re.search(r'CROWN|BED|COVE|CORNICE', L['name']) or not L['name']
    if not best and crownish:
        # Crowns are drawn sprung: the outline fits inside the board's width and spans most of it
        for r, g in cands:
            bw, bh = r.width / scale, r.height / scale
            diag = math.hypot(bw, bh)
            dist = math.hypot((r.x0 + r.x1) / 2 - L['cx'], (r.y0 + r.y1) / 2 - L['cy'])
            if dist < 170 and max(bw, bh) <= L['w'] + 0.08 and L['w'] * 0.9 <= diag <= L['w'] * 1.45 and min(bw, bh) >= L['t'] * 0.8:
                if best is None or dist < best[0]: best = (dist, r, g)
        angled = best is not None
    if not best: continue
    _, r, g = best
    loop = outline([s for i in g for s in segments(draws[i])])
    if not loop: continue
    xs = [x for x, _ in loop]; ys = [y for _, y in loop]
    if (max(xs) - min(xs)) < r.width * 0.9 or (max(ys) - min(ys)) < r.height * 0.9: continue
    pts = [(round((x - r.x0) / scale, 4), round((r.y1 - y) / scale, 4)) for x, y in loop]
    simp = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - simp[-1][0], p[1] - simp[-1][1]) > 0.01: simp.append(p)
    # The profile's own name says what it is; otherwise the nearest section heading above it
    above = [(t, hr) for t, hr in heads if hr.y1 <= L['box'].y0 + 2 and hr.x0 - 40 <= L['cx'] <= hr.x1 + 40]
    cat = min(above, key=lambda x: L['box'].y0 - x[1].y1)[0] if above else ''
    out.setdefault(L['num'], dict(num=L['num'], name=L['name'], wm=L['wm'], thickness=L['t'], width=L['w'], w=round(r.width / scale, 4), h=round(r.height / scale, 4), heading=cat, angled=angled, pts=simp))
labelled = {L['num']: L for L in labels}
print(len(out), 'profiles with shapes;', len(labelled), 'labelled', file=sys.stderr)
json.dump({'shapes': out, 'labels': {k: dict(num=v['num'], name=v['name'], wm=v['wm'], t=v['t'], w=v['w']) for k, v in labelled.items()}}, open(sys.argv[2], 'w'))
