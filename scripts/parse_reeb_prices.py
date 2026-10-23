"""Reeb interior price catalog pages (text from reeb.cld.bz) -> per design, height and width:
door-only and prehung single-unit prices for standard 1-3/8" doors."""
import json, re, sys
pages = json.load(open(sys.argv[1]))
CODE = re.compile(r'^((?:M?PR|PRN|IP|KA|KP|MP|O|P|F|PN)?\d{1,5}[A-Z]{0,4})\b')
WIDTH = re.compile(r'^(\d/\d{1,2})$')
PRICE = re.compile(r'\$[\d,]+\.\d\d|—|-')
out = {}
problems = []
for pno, lines in pages.items():
    if 'Size' not in lines: continue
    si = lines.index('Size')
    # Heights between the last design line and 'Size'
    heights = []
    j = si - 1
    while j >= 0 and re.fullmatch(r'\d/\d{1,2}', lines[j]): heights.insert(0, lines[j]); j -= 1
    if not heights: continue
    designs = [CODE.match(l).group(1) for l in lines[:j + 1] if CODE.match(l) and ('Panel' in l or 'Sticking' in l or 'Glass' in l or 'Louver' in l or 'Lite' in l or 'French' in l)]
    # A real design code has letters or at least three digits (not a stray '1' from 1-3/8")
    designs = [d for d in designs if re.search(r'[A-Z]', d) or len(d) >= 3]
    # Column kinds after 'Size'
    cols = []
    k = si + 1
    while k < len(lines) and re.match(r'(Door Only|Single Unit|Bifold.*|\d Door)$', lines[k]): cols.append(lines[k]); k += 1
    # Walk columns into groups: Door Only + Single Unit pairs, bifolds alone
    groups = []
    c = 0
    while c < len(cols):
        if cols[c] == 'Door Only' and c + 1 < len(cols) and cols[c + 1] == 'Single Unit': groups.append(('pair', 2)); c += 2
        else: groups.append(('single', 1)); c += 1
    if len(groups) != len(heights): problems.append((pno, 'groups', len(groups), len(heights))); continue
    ncols = sum(n for _, n in groups)
    # Which design each group belongs to: designs list in order, one per group when counts match
    gdes = designs if len(designs) == len(groups) else [designs[0]] * len(groups) if designs and len(set(designs)) == 1 else None
    if not gdes: problems.append((pno, 'designs', designs, heights)); continue
    seen = set()
    meta = []
    for (kind, n), h, dcode in zip(groups, heights, gdes):
        thick = '1-3/4' if (dcode, h, kind) in seen else '1-3/8'
        seen.add((dcode, h, kind))
        meta.append((kind, n, h, dcode, thick))
    text = ' '.join(lines[k:])
    # Double units (pairs) follow the single doors; leave them out
    text = text.split('Double Unit')[0]
    for m in re.finditer(r'(?<![\d/])(\d/\d{1,2})\s+((?:(?:\$[\d,]+\.\d\d|—|-)\s*){%d})' % ncols, text):
        w = m.group(1)
        vals = PRICE.findall(m.group(2))
        if len(vals) != ncols: continue
        pos = 0
        for kind, n, h, dcode, thick in meta:
            v = vals[pos:pos + n]; pos += n
            if kind != 'pair' or thick != '1-3/8': continue
            num = lambda s: float(s[1:].replace(',', '')) if s.startswith('$') else None
            d = out.setdefault(dcode, {}).setdefault(h, {})
            d.setdefault(w, {'door': num(v[0]), 'unit': num(v[1]), 'page': int(pno)})
json.dump(out, open(sys.argv[2], 'w'), indent=0)
print(len(out), 'designs priced;', len(problems), 'pages skipped', file=sys.stderr)
for p in problems[:12]: print('  skipped', p, file=sys.stderr)
