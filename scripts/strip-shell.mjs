// The artifact host supplies its own <html>/<head>/<body>, so unwrap the built page.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-preview/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync('dist-preview/cabinet-studio.html', head.trim() + '\n' + body.trim() + '\n');
