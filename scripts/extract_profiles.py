"""Pull moulding profile outlines out of Anderson & McQuaid's full-scale PDF books.

Each outline is matched to its "A&M # N" label and kept only if its measured size matches
the printed thickness x width, so a wrong match can't slip through.
"""
import re, sys, json, math
import pymupdf

def frac(s):
    s = s.strip().replace('"', '').replace('”', '').replace('  ', ' ')
    s = re.sub(r'(\d)-(\d+/\d+)', r'\1 \2', s)
    total = 0.0
    for part in s.split():
        if '/' in part:
            a, b = part.split('/'); total += int(a) / int(b)
        else:
            total += float(part)
    return total

LABEL = re.compile(r'A&M\s*#?\s*(\d{2,6}[A-Z]?)\b[^\n]*?\n?\s*((?:\d+(?:[ -]\d+/\d+)?|\d+/\d+))\s*(?:"|”|in)?\s*[Xx]\s*((?:\d+(?:[ -]\d+/\d+)?|\d+/\d+))\s*(?:"|”)?')

def bezier(p0, p1, p2, p3, n=8):
    pts = []
    for i in range(1, n + 1):
        t = i / n; mt = 1 - t
        pts.append((mt**3*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t**3*p3[0],
                    mt**3*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t**3*p3[1]))
    return pts

def segments(d):
    """Polyline segments (list of point lists) for one drawing."""
    out = []
    for it in d['items']:
        k = it[0]
        if k == 'l':
            out.append([(it[1].x, it[1].y), (it[2].x, it[2].y)])
        elif k == 'c':
            p = [(q.x, q.y) for q in it[1:5]]
            out.append([p[0]] + bezier(*p))
        elif k == 're':
            r = it[1]; out.append([(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1), (r.x0, r.y0)])
        elif k == 'qu':
            q = it[1]; out.append([(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y), (q.ul.x, q.ul.y)])
    return out

def outline(segs, tol=0.6):
    """Chain segments end to end and return the largest closed loop (the profile's outside)."""
    segs = [s for s in segs if len(s) >= 2]
    used = [False] * len(segs)
    loops = []
    def close(a, b): return abs(a[0]-b[0]) < tol and abs(a[1]-b[1]) < tol
    for i in range(len(segs)):
        if used[i]: continue
        used[i] = True
        chain = list(segs[i])
        grew = True
        while grew and not close(chain[0], chain[-1]):
            grew = False
            for j in range(len(segs)):
                if used[j]: continue
                s = segs[j]
                if close(chain[-1], s[0]): chain += s[1:]
                elif close(chain[-1], s[-1]): chain += s[::-1][1:]
                elif close(chain[0], s[-1]): chain = s[:-1] + chain
                elif close(chain[0], s[0]): chain = s[::-1][:-1] + chain
                else: continue
                used[j] = True; grew = True; break
        if len(chain) > 3 and close(chain[0], chain[-1]):
            a = 0.5 * abs(sum(chain[k][0]*chain[k+1][1] - chain[k+1][0]*chain[k][1] for k in range(len(chain)-1)))
            loops.append((a, chain))
    return max(loops, key=lambda x: x[0])[1] if loops else None

def run(path, source, out):
    doc = pymupdf.open(path)
    for pno, page in enumerate(doc):
        # Text lines with positions; a label is "A&M # N" with its size on the same or the next line below
        lines = []
        for b in page.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                t = ''.join(sp['text'] for sp in l['spans']).strip()
                if t: lines.append((t, pymupdf.Rect(l['bbox'])))
        NUM = re.compile(r'A&M\s*#?\s*(\d{2,6}[A-Z]?)\b')
        DIM = re.compile(r'((?:\d+(?:[ -]\d+/\d+)?|\d+/\d+))\s*(?:"|”|in)?\s*[Xx]\s*((?:\d+(?:[ -]\d+/\d+)?|\d+/\d+))')
        labels = []
        for b in page.get_text('blocks'):
            for m in LABEL.finditer(b[4]):
                labels.append((m.group(1), frac(m.group(2)), frac(m.group(3)), (b[0] + b[2]) / 2, (b[1] + b[3]) / 2))
        for t, r in lines:
            for m in NUM.finditer(t):
                d = DIM.search(t[m.end():])
                box = r
                if not d:
                    below = [(t2, r2) for t2, r2 in lines if -8 <= r2.y0 - r.y1 < 14 and r2.y0 > r.y0 and r2.x0 < r.x1 + 6 and r2.x1 > r.x0 - 6 and DIM.search(t2) and not NUM.search(t2)]
                    if not below: continue
                    t2, r2 = min(below, key=lambda x: x[1].y0)
                    d = DIM.search(t2); box = r | r2
                labels.append((m.group(1), frac(d.group(1)), frac(d.group(2)), (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2))
        if not labels: continue
        draws = [d for d in page.get_drawings() if d['rect'].height < page.rect.height * 0.9]
        # group drawings that touch into candidate profiles
        n = len(draws); parent = list(range(n))
        def find(a):
            while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
            return a
        # Drawings belong to the same outline when their segment ends meet; neighbouring
        # profiles drawn close together stay apart.
        grid = {}
        for i, d in enumerate(draws):
            for seg in segments(d):
                for x, y in (seg[0], seg[-1]):
                    for gx in (round(x), round(x) - 1, round(x) + 1):
                        for gy in (round(y), round(y) - 1, round(y) + 1):
                            for j, (x2, y2) in grid.get((gx, gy), []):
                                if abs(x - x2) < 0.8 and abs(y - y2) < 0.8: parent[find(i)] = find(j)
                    grid.setdefault((round(x), round(y)), []).append((i, (x, y)))
        groups = {}
        for i in range(n): groups.setdefault(find(i), []).append(i)
        cands = []
        for g in groups.values():
            r = draws[g[0]]['rect']
            for i in g[1:]: r = r | draws[i]['rect']
            cands.append((r, g))
        for num, t, w, lx, ly in labels:
            best = None
            for r, g in cands:
                bw, bh = r.width / 72, r.height / 72
                for ew, eh, rot in ((t, w, False), (w, t, True)):
                    if abs(bw - ew) <= max(0.04, ew * 0.035) and abs(bh - eh) <= max(0.04, eh * 0.035):
                        dist = math.hypot((r.x0 + r.x1) / 2 - lx, (r.y0 + r.y1) / 2 - ly)
                        if best is None or dist < best[0]: best = (dist, r, g)
            angled = False
            if not best:
                # Crowns are drawn sprung at an angle: the outline fits inside the board's width,
                # spans most of it, and the label sits right under it
                for r, g in cands:
                    bw, bh = r.width / 72, r.height / 72
                    diag = math.hypot(bw, bh)
                    if max(bw, bh) <= w + 0.06 and diag >= w * 0.9 and diag <= w * 1.45 and min(bw, bh) >= t * 0.8:
                        dist = math.hypot((r.x0 + r.x1) / 2 - lx, (r.y0 + r.y1) / 2 - ly)
                        if dist < 150 and (best is None or dist < best[0]): best = (dist, r, g)
                angled = best is not None
            if not best: continue
            _, r, g = best
            segs = [s for i in g for s in segments(draws[i])]
            loop = outline(segs)
            if not loop: continue
            # The traced outline must fill the matched drawing, not a dimension arrow or hatch inside it
            xs = [x for x, _ in loop]; ys = [y for _, y in loop]
            if (max(xs) - min(xs)) < r.width * 0.9 or (max(ys) - min(ys)) < r.height * 0.9: continue
            # inches, origin at bottom-left, y up
            pts = [(round((x - r.x0) / 72, 4), round((r.y1 - y) / 72, 4)) for x, y in loop]
            simp = [pts[0]]
            for p in pts[1:]:
                if math.hypot(p[0] - simp[-1][0], p[1] - simp[-1][1]) > 0.01: simp.append(p)
            out.setdefault(num, {'num': num, 'thickness': t, 'width': w, 'w': round(r.width / 72, 4), 'h': round(r.height / 72, 4), 'source': f'{source} p{pno+1}', 'angled': angled, 'pts': simp})

if __name__ == '__main__':
    out = {}
    for arg in sys.argv[2:]:
        path, source = arg.split('=')
        before = len(out); run(path, source, out); print(source, len(out) - before, file=sys.stderr)
    json.dump(out, open(sys.argv[1], 'w'))
    print(len(out), 'profiles', file=sys.stderr)
