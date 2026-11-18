# CNC sample files from router manufacturers

Kept for writing Cabinet Studio's post-processors once a machine is chosen. Not used by the app yet.

- `vendor-a-t1t2.nc`: G-code from one manufacturer's machine. Metric. Tool change as `T1M6` then `G43H1`
  (tool length offset from the auto tool-length sensor), spindle `M03S18000`, rapids `G00`, feeds `G01`
  with modal X/Y, `M05` and `M30` at the end. The second tool change is written as `T2` alone.
- `vendor-b-ELE_GCode_ATC_mm.pp`: another manufacturer's Vectric post (ELE G Code ATC, mm). Header and
  tool change: `M5`, `T[T]`, `G43 H[T]`, `[S]M03`; footer returns to home and `M30`. Three-decimal X/Y/Z.

Both use an automatic tool changer with tool length offsets (`G43 H<tool>`).
