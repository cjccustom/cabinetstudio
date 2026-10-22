# Cabinet Studio

Design, quote and cutlist software for face-frame cabinets.

One cabinet model drives everything: the 3D view, elevations, parts list and (next) the sheet
optimizer and quote all read the same parts, so a dimension is only ever entered once.

## Run it

    npm install
    npm run dev          # opens at http://localhost:5173
    npm test             # cabinet model checks
    npm run build:preview  # single-file HTML preview

## Layout

- `src/model/` – the cabinet model. `parts.ts` turns a cabinet + shop standards into parts.
- `src/three/` – 3D, plan and elevation views.
- `src/ui/` – panels and editors.
