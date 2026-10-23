// The artifact host supplies its own <html>/<head>/<body>, so unwrap the built page.
// The page's real <head> is the first one and its real <body> the last one: the bundled code
// itself contains HTML documents (the quote template), with tags of their own.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-preview/index.html', 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.lastIndexOf('</head>')).replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '');
const body = html.slice(html.lastIndexOf('<body>') + 6, html.lastIndexOf('</body>'));
writeFileSync('dist-preview/cabinet-studio.html', head.trim() + '\n' + body.trim() + '\n');
