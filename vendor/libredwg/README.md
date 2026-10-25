# LibreDWG for the Chief plan importer

`@mlightcad/libredwg-web` 0.7.14 (LibreDWG compiled to WebAssembly), copied from npm unchanged.
Cabinet Studio loads it only when someone opens a `.dwg` file (`src/import/cad.ts`); DXF files
are read without it. It's published next to the page as `libredwg/dist/libredwg-web.js`,
`libredwg/wasm/libredwg-web.js` and `libredwg/wasm/libredwg-web.wasm`.

License: GPL-3.0 (LibreDWG and the JavaScript bindings). Using it for CJC's own work carries no
obligations; if Cabinet Studio is ever given or sold to others with DWG support included, the
GPL's terms (offering this source) apply to it. https://github.com/mlightcad/libredwg-web
