# Open questions for Cody

Things the app is guessing at until Cody answers. Each one says what the app does now.

## Answered

- **Drop with the #9554 bead:** measured from the ceiling to the bottom of the soffit.
- **Blocking in beaded beams:** 16" apart.
- **Coffer labor:** install only; beam stock comes prepped from the millwork supplier. Rates
  come from the Pope worksheet (74 hours for that ceiling).
- **Perimeter fascia over full-height cabinets:** proud of the face frame by the fascia's
  thickness, fastened to the cabinets' extended top rail. The cabinet top closes it off, so no
  perimeter soffit, nailer or blocking over the cabinets; the rest of that wall keeps them.

## Coffered ceilings

- **Prepped stock and blocking prices.** $16 and $4.40 per foot of beam, worked back from the
  Pope worksheet allowances. Cody is getting the millwork supplier's price per foot; enter it
  under Quote (Coffer stock, prepped).

## Mantels and fireplaces

- **Mantel labor.** Legs, frieze and shelf 20 h; pilaster legs +6 h; 1.5 h per corbel; 4 h per
  pediment; firebox layout and framing 8 h; install 10 h. These are worked back from the Pope
  worksheet's fireplace wall; adjust them under Quote → Standards.
- **Massachusetts amendments.** The clearance checks follow the 2021 IRC sections (R1001.9–.11,
  R1004) as adopted in 780 CMR 51.00. I couldn't open the state's Chapter 10 amendment PDF from
  here; what I could see of it changes only R1001.1 and a figure note. Worth a look if your
  inspector reads it differently.
- **Insert manuals.** Gas and electric inserts are checked against the mantel chart you type
  in from each manual; until then the drawings say the clearances are unchecked.

## Cabinets

- **Appliance sizes.** Named models come from maker and retailer listings; "typical" sizes are
  class averages. Check the installation manual before building the opening.
- **Manufacturer 3D blocks.** In: import a downloaded model file (glb, gltf, obj, fbx, dae, stl,
  usdz) on an appliance. Not yet tried with storage on claude.ai.

## Waiting on you

- **Pope heights not in the plan.** Imported from Chief's DWG plus the elevations: ceiling
  104 1/4, bookcases 98 3/4 (36" bases), 6" ladder top rail, doors 33 1/2 x 79 7/8, both windows
  32 x 60 1/4 on a 24 7/8 sill. Still assumed: the 7" base band, and where the fireplace goes (the
  door wall elevation doesn't show it; it's centered between the doors for now).
- **Pope notes from Cody (to do).** The bookcases are built one piece, not a separate base and
  upper: the app needs a single full-height cabinet with doors below and open shelves above.
  The tops are painted, not wood (Cody will change it). The coffers aren't yet centered on the
  windows; Cody is checking his notes for whether the windows are truly symmetrical first.
- **Old Chief jobs.** The importer reads Chief's DWG/DXF floor plan exports (walls, doors,
  windows, cabinets, pilasters). Heights still come from each job's elevations.

## Not yet tried on a real job

- **A full Gemini render** from the Rendering tab or "Render this view".

## Client portal

- **Cloudflare setup.** The portal is built and tested here; it goes live once you do the
  setup in `portal/README.md` (Worker, KV storage, SHOP_KEY, then the CJC Portal connector).
- **Your terms.** The portal starts from your current terms doc. Things to fix before clients
  sign online:
  - Sections 6 and 8 are missing (5 jumps to 7, 7 to 9).
  - #15 gives the old Consumer Affairs address (Ten Park Plaza). Your HIC card has the current
    one: 1 Federal St., Suite 0720, Boston, MA 02110-2012.
  - #14 promises the 3-day cancellation; the law also wants the Notice of Cancellation form
    itself given to the client. The portal now does that (two filled-in copies with the
    agreement), so #14 can point to it.
  - #20 says approval is "by your signature on the first page" and #17 says "executed in
    duplicate". Online, the signature is on the project page and the client gets the signed
    copy right away; reword both to cover electronic signing.
  - #4: the "no consequential damages" limit is fine, but under MA c.106 §2-316A you can't
    disclaim the implied warranties on consumer goods. Worth a sentence saying so.
  - Your own additions from past jobs: waiting on your list.
- **Proposal tracking.** The portal already counts when the client opens the page. Say if you
  want reminders when a proposal sits unopened or unsigned.
- **Deposit.** 30% of the total, as on your agreement (Massachusetts caps a home improvement
  deposit at one third, or the cost of special-order materials, c.142A §2).
- **QuickBooks setup.** Built and tested against a stand-in for QuickBooks; not yet run against
  Intuit. Steps are in `portal/README.md` (sandbox company first).
- **Sales tax on invoices.** Lines go in marked non-taxable, since you pay the tax on materials.
  If your company has QuickBooks' automated sales tax on, check the first invoice shows no tax.
- **Product/service for invoice lines.** Pick one in Portal settings → QuickBooks (e.g. a
  "Custom cabinetry" service). Deposits, final and change orders all use it for now.
- **Cancellations after a deposit.** The portal shows the cancellation; refund or void the
  deposit invoice in QuickBooks yourself (within 10 business days).
