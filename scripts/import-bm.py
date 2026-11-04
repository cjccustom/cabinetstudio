#!/usr/bin/env python3
"""Pull Benjamin Moore's color catalog (name, number, screen color, light reflectance) from the
Color Families page on benjaminmoore.com and write src/model/benjaminMoore.ts.

Usage: python3 -I scripts/import-bm.py [saved-color-families.html]
With no file it downloads the page (needs benjaminmoore.com on the network allowlist).
"""
import datetime, json, os, re, sys, urllib.request

URL = 'https://www.benjaminmoore.com/en-us/paint-colors/color-families'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'model', 'benjaminMoore.ts')


def page():
    files = [a for a in sys.argv[1:] if not a.startswith('--')]
    if files:
        return open(files[0], encoding='utf-8').read()
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (Cabinet Studio color import)'})
    return urllib.request.urlopen(req, timeout=60).read().decode('utf-8')


def colors(html):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        sys.exit('No page data found; the page layout may have changed.')
    found = {}

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get('hex'), str) and o.get('number') and o.get('name') and re.fullmatch(r'[0-9A-Fa-f]{6}', o['hex']):
                found.setdefault(o['number'], o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(json.loads(m.group(1)))
    return sorted(found.values(), key=lambda c: c['number'])


SITEMAP = 'https://www.benjaminmoore.com/sitemaps/colors.xml'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Cabinet Studio color import)'})
    return urllib.request.urlopen(req, timeout=60).read().decode('utf-8')


def missing(have):
    """Colors on the color sitemap that the families page leaves out, read from their own pages."""
    import time
    urls = [u for u in re.findall(r'<loc>([^<]+)</loc>', get(SITEMAP)) if '/en-us/paint-colors/color/' in u]
    todo = {}
    for u in urls:
        code = re.search(r'/color/([^/]+)', u).group(1).upper()
        if code not in have and code not in todo:
            todo[code] = u
    out = []
    for i, (code, u) in enumerate(todo.items()):
        try:
            html = get(u)
        except Exception as e:  # skip a page that won't load; the rest still import
            print(f'  {code}: {e}', file=sys.stderr)
            continue
        m = re.search(r'"color":\{"name":"([^"]+)","number":"([^"]+)","hex":"([0-9A-Fa-f]{6})".*?"lrv":([\d.]+)', html)
        if m:
            out.append({'name': json.loads('"' + m.group(1) + '"'), 'number': m.group(2), 'hex': m.group(3), 'lrv': float(m.group(4))})
        if i % 50 == 49:
            print(f'  {i + 1} of {len(todo)} extra color pages', file=sys.stderr)
        time.sleep(0.25)  # gently
    return out


def main():
    cs = colors(page())
    if '--no-extra' not in sys.argv:
        have = {c['number'].upper() for c in cs}
        cs = sorted(cs + missing(have), key=lambda c: c['number'])
    if len(cs) < 1000:
        sys.exit(f'Only {len(cs)} colors found; not writing.')
    rows = ',\n'.join(json.dumps([c['number'], c['name'], '#' + c['hex'].upper(), round(c.get('lrv') or 0, 1)], ensure_ascii=True) for c in cs)
    today = datetime.date.today().isoformat()
    ts = f"""// Benjamin Moore's color catalog: number, name, screen color and LRV (light reflectance), from
// the Color Families page at benjaminmoore.com, pulled {today} by scripts/import-bm.py.
// {len(cs)} colors. Screen colors are Benjamin Moore's own on-screen values; actual paint varies.
import type {{ PaintColor }} from './paintColors';

export const bmPulled = '{today}';
const raw: [string, string, string, number][] = [
{rows},
];
export const bmColors: PaintColor[] = raw.map(([code, name, hex, lrv]) => ({{ brand: 'Benjamin Moore', code, name, hex, lrv }}));
"""
    open(OUT, 'w', encoding='ascii').write(ts)
    print(f'{len(cs)} colors written to {OUT}')


main()
