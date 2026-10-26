// portal/src/store.ts
var emptyShop = { company: [], about: "", terms: "", docs: [] };
async function getShop(env) {
  return { ...emptyShop, ...await env.PORTAL.get("shop", "json") };
}
var putShop = (env, s) => env.PORTAL.put("shop", JSON.stringify(s));
var getJob = async (env, jobId) => await env.PORTAL.get(`job:${jobId}`, "json");
var putJob = (env, j) => env.PORTAL.put(`job:${j.jobId}`, JSON.stringify(j));
async function jobByToken(env, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const id = await env.PORTAL.get(`tok:${token}`, "json");
  return id ? getJob(env, id) : null;
}
function randomToken(bytes = 18) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(text2) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text2));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function b64ToBytes(b64) {
  const bin = atob(b64.replace(/^data:[^,]+,/, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// portal/src/calendar.ts
var apptLabel = { measure: "Measure", design: "Design meeting", review: "Review & sign", install: "Install", delivery: "Delivery", other: "Appointment" };
async function listAppts(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.PORTAL.list({ prefix: "appt:", cursor });
    for (const k of page.keys) {
      const a = await env.PORTAL.get(k.name, "json");
      if (a) out.push(a);
    }
    cursor = page.list_complete ? void 0 : page.cursor;
  } while (cursor);
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
async function saveAppt(env, a) {
  const old = a.id ? await env.PORTAL.get(`appt:${a.id}`, "json") : null;
  if (Number.isNaN(Date.parse(a.start))) throw new Error("The appointment needs a date and time.");
  const appt = {
    id: old?.id ?? randomToken(9),
    jobId: a.jobId ?? old?.jobId,
    who: String(a.who ?? old?.who ?? "").slice(0, 120) || "Appointment",
    kind: a.kind ?? old?.kind ?? "other",
    start: new Date(a.start).toISOString(),
    minutes: Math.max(5, Math.min(24 * 60, Number(a.minutes ?? old?.minutes ?? 60))),
    location: a.location ?? old?.location,
    phone: a.phone ?? old?.phone,
    notes: a.notes ?? old?.notes,
    remind: (a.remind ?? old?.remind ?? [60]).filter((m) => Number.isFinite(m) && m >= 0).slice(0, 3),
    share: a.share ?? old?.share ?? false,
    cancelled: a.cancelled ?? old?.cancelled,
    updatedAt: Date.now()
  };
  await env.PORTAL.put(`appt:${appt.id}`, JSON.stringify(appt));
  return appt;
}
var deleteAppt = (env, id) => env.PORTAL.delete(`appt:${id}`);
var feedCode = async (key) => (await sha256(`cjc-portal-calendar:${key}`)).slice(0, 32);
var stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
var text = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}
function vevent(a, forClient, shop) {
  const end = new Date(Date.parse(a.start) + a.minutes * 6e4).toISOString();
  const summary = forClient ? `${apptLabel[a.kind]} with ${shop}` : `${a.who} \u2013 ${apptLabel[a.kind]}`;
  const desc = forClient ? [a.notes].filter(Boolean).join("\n") : [a.phone && `Phone: ${a.phone}`, a.notes].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VEVENT",
    `UID:${a.id}@cjc-portal`,
    `DTSTAMP:${stamp(a.updatedAt)}`,
    `LAST-MODIFIED:${stamp(a.updatedAt)}`,
    `DTSTART:${stamp(a.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(summary)}`,
    ...a.location ? [`LOCATION:${text(a.location)}`] : [],
    ...desc ? [`DESCRIPTION:${text(desc)}`] : [],
    ...a.cancelled ? ["STATUS:CANCELLED"] : ["STATUS:CONFIRMED"]
  ];
  for (const m of forClient ? [24 * 60] : a.remind) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${text(summary)}`, `TRIGGER:-PT${m}M`, "END:VALARM");
  }
  lines.push("END:VEVENT");
  return lines;
}
function calendar(appts, name, forClient = false, shop = "CJC Custom Carpentry") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CJC Custom Carpentry//Client portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${text(name)}`,
    "X-WR-TIMEZONE:America/New_York",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    ...appts.flatMap((a) => vevent(a, forClient, shop)),
    "END:VCALENDAR"
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
var whenEastern = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

// portal/src/cancel.ts
var nth = (y, m, weekday, n) => {
  const d = new Date(Date.UTC(y, m, 1));
  const shift = (weekday - d.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(y, m, 1 + shift + 7 * (n - 1)));
};
var last = (y, m, weekday) => {
  const d = new Date(Date.UTC(y, m + 1, 0));
  return new Date(Date.UTC(y, m, d.getUTCDate() - (d.getUTCDay() - weekday + 7) % 7));
};
var fixed = (y, m, day) => {
  const d = new Date(Date.UTC(y, m, day));
  const wd = d.getUTCDay();
  return wd === 0 ? [new Date(Date.UTC(y, m, day + 1))] : wd === 6 ? [d, new Date(Date.UTC(y, m, day - 1))] : [d];
};
function holidays(y) {
  return [
    ...fixed(y, 0, 1),
    nth(y, 0, 1, 3),
    nth(y, 1, 1, 3),
    nth(y, 3, 1, 3),
    last(y, 4, 1),
    ...fixed(y, 5, 19),
    ...fixed(y, 6, 4),
    nth(y, 8, 1, 1),
    nth(y, 9, 1, 2),
    ...fixed(y, 10, 11),
    nth(y, 10, 4, 4),
    ...fixed(y, 11, 25)
  ].map((d) => d.toISOString().slice(0, 10));
}
function cancelDeadline(signedYmd) {
  const [y, m, d] = signedYmd.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  let count = 0;
  while (count < 3) {
    day.setUTCDate(day.getUTCDate() + 1);
    const ymd = day.toISOString().slice(0, 10);
    if (day.getUTCDay() !== 0 && !holidays(day.getUTCFullYear()).includes(ymd)) count++;
  }
  return day.toISOString().slice(0, 10);
}
var easternYmd = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
var longDate = (ymd) => (/* @__PURE__ */ new Date(`${ymd}T12:00:00Z`)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
var canCancel = (signedAt, now = Date.now()) => easternYmd(now) <= cancelDeadline(easternYmd(signedAt));
function noticeOfCancellation(signedYmd, seller, address) {
  const deadline = longDate(cancelDeadline(signedYmd));
  return `<section class="notice"><h3>NOTICE OF CANCELLATION</h3>
<p><b>${longDate(signedYmd)}</b><br><span class="muted">(date of transaction)</span></p>
<p>YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.</p>
<p>IF YOU CANCEL, ANY PROPERTY TRADED IN, ANY PAYMENTS MADE BY YOU UNDER THE CONTRACT OR SALE, AND ANY NEGOTIABLE INSTRUMENT EXECUTED BY YOU WILL BE RETURNED WITHIN 10 BUSINESS DAYS FOLLOWING RECEIPT BY THE SELLER OF YOUR CANCELLATION NOTICE, AND ANY SECURITY INTEREST ARISING OUT OF THE TRANSACTION WILL BE CANCELLED.</p>
<p>IF YOU CANCEL, YOU MUST MAKE AVAILABLE TO THE SELLER AT YOUR RESIDENCE, IN SUBSTANTIALLY AS GOOD CONDITION AS WHEN RECEIVED, ANY GOODS DELIVERED TO YOU UNDER THIS CONTRACT OR SALE, OR YOU MAY, IF YOU WISH, COMPLY WITH THE INSTRUCTIONS OF THE SELLER REGARDING THE RETURN SHIPMENT OF THE GOODS AT THE SELLER'S EXPENSE AND RISK.</p>
<p>IF YOU DO MAKE THE GOODS AVAILABLE TO THE SELLER AND THE SELLER DOES NOT PICK THEM UP WITHIN 20 DAYS OF THE DATE OF YOUR NOTICE OF CANCELLATION, YOU MAY RETAIN OR DISPOSE OF THE GOODS WITHOUT ANY FURTHER OBLIGATION. IF YOU FAIL TO MAKE THE GOODS AVAILABLE TO THE SELLER, OR IF YOU AGREE TO RETURN THE GOODS TO THE SELLER AND FAIL TO DO SO, THEN YOU REMAIN LIABLE FOR PERFORMANCE OF ALL OBLIGATIONS UNDER THE CONTRACT.</p>
<p>TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS CANCELLATION NOTICE, OR ANY OTHER WRITTEN NOTICE, TO <b>${seller.toUpperCase()}</b>, AT <b>${address.toUpperCase()}</b>, NOT LATER THAN MIDNIGHT OF <b>${deadline.toUpperCase()}</b>. YOU MAY ALSO USE THE CANCEL BUTTON ON YOUR PROJECT PAGE BEFORE THEN.</p>
<p>I HEREBY CANCEL THIS TRANSACTION.</p>
<p class="sigline">(Date) ____________________ &nbsp; (Buyer's signature) ______________________________</p></section>`;
}

// src/drawings/logo.ts
var LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA4QAAAEWAQAAAAAWBGT3AAAUL0lEQVR42r2dTW/kyHmAnyIZNQ/KNBM4SBuZbNNBzrFg5DAHZ5t7CXzMMUf9gyiID4tgYdV6DGMOATzI2YiVf5Af4GQ5kw12AgSIcnMAB+DsDgxdglCzAkzJbL45FIssssmWZlclAqORutl86/3+rGpkdFVKmo1sxNdVRoyuZ5JchpfneLuUDP++jgFYlr4AXgYDcJpn5rfqgXB8vfmvxPwW1g+DY/E6wfs1wFH1vzUPgeOlA1z84ehALH/gvK4vY/8Qi586r+fnvmTHtQAXzu//kyn/OObu62+8sTKYf0s/OMT8wSGePxDEhUjt1baOIaoKQsNBX+rRucoCgI2ISD566149co/jWSsuOajCo7COqJohGnjsrMEfRA0szmiAwHCy9AvxNcCHQAZw7FFYLUcBQimkFpGnRkFCr5IjdOyDyCqIzxhAAkC4XIq6jhcVr1NPgUAXAzTAAkC9iLnOOnT9SU4NrABeZ8BLQm+hh4VYAQWwTQEkobBi6wnidQIhEIdGJd6yapfgC2IFHFrfIT9B0sUoDLlviCVwBJJarl6Qe/IeLcTC+Py3xrAlob7mCLZ+7WoInH+j/eOY7NCT9wi6mOYQJGupymPOA0+hTo9jAjfKgEgJuVLaj7D2EI/h4qAP0Lcce/JXnecQEb1uRERkI1KxKY2q+PEd1xCC6ONuIQecH/pRDwPxGURwo7SNPVC6Cox990LVBjgUKRbSmL82IoUS7SOcM1RtgD+GsxUKeAkvYSU686OQIiIV8NfScNqJ0VoaNkUbvt4vjpif8IXUiEi9FKkhFNHLCtb+4hz1Da5CIDqBIGWrOa4iPwrZJgCLX0uxFClM/KZZSxk2PhTS4FhAHHGWQHoI53DCBYdbP3m5pWoSoY+55gQqWHJDgM69mABDRDZSK5E87BKtU9GbwkOQ3ElORh1gnCICK87IisSL0enseLmU2mhkcyoNSymXFcqTPkIoUqylNABqEdGhVIvaB8SgKySdHXN+0BUEjxuiOjDJwf1TtYGlCCJs5NSWyzkVxENqbnFMkJAtn5z21bMcrT1GVilNRB1CjlIxEFJwnGeeIDaQUcdcHDYff6LgWgN5SULqM7KqEoojxedtSJClV8RF4ikGqECk2Ahy3Wr8qawrJf+wrDxIDiJSokTy00aJlHxbpGDRLGtkvag9QSwIRbT8ciGSL0VEappQOF08bTxBzFmIqGa1bAOPn0m9PBW9CV+LJ4iwkCZsjtZShSIin4n8RiRfb0rR9w8xAoGaJuJozcVjo5xEkJb5tf7AS2W+gYY65njD2TG2AsGqIiIlqu9fOyrgtFo3ShrXVdShNJv7F1ZrV/MqJaA5cG1Dg8pDEQ82p4LjosyaiKvVRDVr96rvwcqtyuKkXlEeD7oPc56j+roQS/jx1YtfVCnf0m7vwUv9yOKofhDUZYbLxpjUU/1RpEBJsfgil9rNMi7lck7cvvz6shqwih+/oHbd4UL7ageK5IRSryWUUuTXvTrOp1X3gGMEJRGX8B89g0t8Sg71X8qKX7k9B+UVYkz19/+S8goO4WKu5igjdSm/moUITCns8uCXGRqO4HtsvzkZUb18Ofhz+7vGzcgxbFUCV/zZtQY+/i2rVtP5oElPX8u5NH/VMjdnafn8umd5g60TfNlmtRspWLf/lGl8bURMnluxbn/MWPLP+RbN87aenHHVrkatlbLR3sthW0l016BMKUzzCQp425K13MfHlIi3tpq6jWFrPv9D+vr86wzeOB9s4IqElISMHM5s2fActm1HvJoKeANTs3lFwY155Q3Aj1yL3iJiy/bmuoJtFpMRg2iLUmnK+dme3m1g0tXnHFpSpmCRdAzrNQwL5+d0fV8NcOkWY89RVFBOeYMu7zhvHyddiXfCQ924voVumqBxbpPb/FlgUraMMxL30+cjHEsrLi6tp5KEG6uR9T6qajSZ4Xxed2waXGeD/yZUXqGB2qDX9PX+GaoK6Lbx2LJqO6KfHtkZ6VjeEjFwiSHMV0oDGlzLUJ4NJLQzMIxQHz3vsC93oyr76Xwex16Wv7SQfvTKvc1C2v5h5tjOrMPrb4oIYHFFznsLyOf7bMHomX/SYfVdulKPM//wprCEXLqioZMYyVnFwHHHPz0NsTZQ/9fc8k/TC5vQqyTsn6g4TOCIFLTSJPvaFoEVhMJAnL51l0IlKS+cp4SFXVgA8TyGRocjaJ4Gm3lmu5qf9mh/Z3RXDAgRRL3ETuFo7EMejFU82hsTF2h2O1vawA32LL6TnPMfjYU+nnb3Wce6SdI1JKBuizpiQPbGisXYk9zWQ6uYtQGBWX9YJuMQJblrw2vw7JrULqvY/8FmZ0WuM+0xUlNs3pWRev9SE4D0N3dKm4Ip5R4Ut4xHFijrvU+oM/S0iHCXXus79LiDltyV5mxSREaOxBJzkJXERmGjEUeqeRxbNjybE8EJ8uiJ6LkevlPN8yUFLlkUH33VzljUm/pqLGETEHMLWQYypxxBrabtgrvsq93363IGoobGxIxRqyHLaqRv5qOnc6ENyrA6unOm00plExtOhOXCvrvMwUZAa30y0tIBV9O9lsqFKKaQ8qrnQgRFu+CTo94ApCyZG2fJHL3S1ibMBDpBA9QmDks6VqwMQzJXB7I9xvQIqh2RlunVBTVAo5/3FDuChWFY2LJGA0rDkzlhPrwTPXs+aiOYVUuaHMhJR6JwABzMCX24g+Ae7aiAKiCtLY9Cg2cGPHEkdgUoHcy6s8YSI79rL6DjfTRFppbkx9FMWPB4ZIkiYbUPYmC47MRVTpxG3tuFJJ4xf2FvPIoez8f7+x1mDtFajaeT8eNhZwB0PUQ2H1h6Hc/bgyA29OzDdqOCH408vBnACHeEMN/x32VvLNO9OEb21+z2IKMLNKLp2LDZK6tRFzbkc9pWTzw7a6PYYqfCUAMkwh/NS46iIDgriQw19N0quAKfEQCFgueOHja9I5kkV9CPr+l9qhtP2NJMY6bc+P647JLO09Xy5wnEZj6XiRxj10ul/NsWFDU6QBrXjZyRtdjpWYgRPJljGGTFpNjVf0oO2y1wI7roUX9jwqJC7/EdP6cknm8zTNmtBM4p0EREwMfdVomUbdQ6TLVf6guSfdFqNs3XzFQux9zYl3gEY0resVYd9ZY4GShI4tSlbtPsdF+6McOUtPtcdNcVB9WtLnSSTEGPUTaAdMAtMVbQI5DN2cLZILYkBjTvOXcq60y7avEYouVB3uh3mXFSOYRwAMpASdz1HQ9TjCHEYm8C2swZ8rYtqgwZczi21vAYlKbZk7FaGVP7XMfu9Z5hXU5sPJyGkty44QBqyKdBBpbrZXBrWjwm6wlwxBHwyERH9omPISLLCNUEVSNbz0puV7/htVlo4JHKsb3KtQCoIi0glKm8e0DVk1aj755dVTA5yb+Wu8Ry+p0o+rWuQN8aSsvdbd9dcyt7vXoYHJ3fvzevk5UfiOV8AH/fVE16J6gehKoN0gW1M6lM4oeq89U7X5LDvDMuHxSiZxzlHRzy/UB8AFnVLVrlLI5+qFqR8HaP5NynzbGRWOlpK+A8ju9O0GdfC2IMrN/tk9d/C8BlBvCxigBMY10B17/dJqcvVMRWqdZoSagpoF43i2bZ7l8ddu9ts3S5O0mi2z2vYbuxYNPObDcAUnIqwrIBlOSgROBUSluz2kuCaSPRzQM0nXfdaviUrtgxYJNkLZgk2G+jm33vXHUxfNTVdmz/NOodgJAC520elgZWF6tZCzBNgitbsJeWDFsCg7pTKkubDrCdRsiCtrH1zrbmfMeHaTUT3WuTfxu42lRX1D67etfEOW+js8yJ0WqHC7G5o905Vt9Cw2py4QmmLehSqNy7uFJ11ZX5qhaKiY6HTFU8nScH45UKkbkjUO3rH+0pM8zJbDqAXw5hjB+kA0qKwCpbc0uUPL+EvHt05XCu2kU+b38Epqqqb6kBTLX7jsl6vi8aMPnNrq0oYFNixlkiAjIUcJbNc35alBY/baEVACula4jIG+xMLAqWrUXID20zvuvO6+b28Gp4rUI9kKDWpLSi1lAggHKmKnQNMQGpaU2m72YASlI+GAhRW5yRkSHWEaBQQNZIb6bN5s543tvnE1Ws7xgJKkfClE6zp8R00vt9OrPVBz1VGrDzAOOwPe6cTuXUFcRU6gRSAhLDpOWOXZpV712TryZurSdSie+3M19VQ5ZPZ/uzPe886G6ohuKlWxJPDTM87/h4XRC3a2v2mJY7GNyou130VEqo2yrhv0PEkStkL7JdvoNE89WPeEDVqQpZ1OlJLX+eFFbjpA0Sih6FpMPl7XZCP+sZK1iMRLtleDvdPRauz8fCXc+YwdL1JHYZ22CoHpVy4sYAIE8plRW5YlI0t72QD4hYGLs20JDt1YxPhcBMkmx1FoNu+1qvDaJVj0JsH3YzwRxl7ZqZIKt7wDcDFudWh4JdmdPtBoyhrl1xh1mKkgjNcK5hQPWogxgBjZi5/Oft8raWupH968whd2L1MpE5Bc4maybOyRJyY+65jHgFDXU2yBRUttWOOMx7tXTWTmXmaQkc5e3QjLl5KxkIFO09LV1fXU0Z3chKU+kAMpr3+a67S6ysGlPzsU4cpDQl4iYB18mkAMYtmGJWQA0nk9alBQDPCgXEB0PLWV3aJHZe3YXYym8WAJwru4rvDjC82akDmAbkqBhmc7Ds9kSk3BJB5UwdDPxyfkEKCZl9vURDVAyM5R2DusTc+fYNoK+bvuz2gWvuz1NnJTF8Cpme2wkQDZyHzASRkhJD2zdTxTg0uoSsZXkwX4ncX5XrROTC3tnfZQTieDo2C4ggqEhzVHWXBuuO1zsb6uEK29JJJmIGDYGD10e3JDduiNXOA9R22B23C5W664xH5AtQUNQkBbw/mVnF+xpfFW+6temReYsGNIoczmkUxCXIQA/q/aXVHTUJexpo94WWXCsH4jFlsz+eCaaV5mYgwVEHRk2xPHUetgJNVEGip4Cmk39mAp+1Au3aITeGPZ5bfgRCUEM8cLeHPVPUVHCekk1w/Yg+907mCVZlqAaiwrlpUU6qxKaD9/ra0rjp+b7OmZlfL0Ys0gBB6RBl5ULr6KPyXp7iHl/FI6Mm5rnqm0mnF+aekz5+CADqFE45U1fOyVkDJjyeLgAXPczf0TzrxfOiVY9O9P+O68wNrkhyMp3ygx6QPRDF8DDcEYzeDC21AGlGbTK3sd+vWjCFu+jGCAJZT8zAGtbh3HQyiK9LNJRZ/1I8kpF8QubNA+MCclj3piEahu7pbAqiSEEgJXYELNnNxAZRkwBJAUk/1/RkSL71SHD6XRoHJLO7SyalPQAFUUlcQqx357+S6RxZAZRNx4YiHsBMx/qbdameWesPIapMUzkcQTh2cX40sASh1bO8gYi0tekayOpRcpIqlzoaKoK6JOhUdWGxszJ7YC2KY1wi6hZqTRlqZCfNKoxbK9oUozIVJIAXQPMLEy2sP3TZaLFSv9EuG+ERrKjMRsYLgJOs6eMSXXU23rwa/hAoKUxdPGf9VIT/E/mJcwyTVHafnD1rwp778mV39kTFWqRgIbnZWfcHIiIrQCpEhLU0KJF6YU862djd+uunIvpU5LP2yJ7J3ZnVxEEzl191z3X5PmR5J6jTZd3FRBzy6Kv1OxKqlDot4PdSvF+taV7yq6SE6M3DQIyp0cQVhM2D4RjzKKqBTx4KYhPlSdAAT/SDQIyQoDASenD2UFT9GJTWoP4xfSCInBiF5LsXDwQxfwJpAYT/PULy2b2DNE3G9RcipbFi5udntgG59HSyRPkI4rZVcQHwcy5TXuvLyBsfFxC16v9TbD/zzNe5ZDUs6tPutLd/NX5Cnwruhu97/r6AOshR+pMuJn0VixZR5B4mvgyOStYi+brftb6pQ6lDuf8T5spux+UJpJ0uviW/OqSO3r3zcjfJCdpgbdUFRsmC8oiLWDyc+mp7yPoxXG27gvGKs5wiaTycTWgnZvNH3RaLLVcU8hTytPYxPdOe2reuRESvzUFo+ULqpTSclvd/wFxpy2hllPV1quwJVyc06JLID44VLJq1PULvZyIiX4hUoQcD0J8QUqvS9hjKNiu+iLwYgH5X6YfwGSnwFzZpWKFnKiRfm6oNIC9E/jN3D0Ji4+EALefUd/1tIHU2CQv5jQ/l6CDmsWb12JTfDZ1DKh8DfN2YUhGdQQiX1shcHfqZ9eqQKIOSFXl7LAhQHlH4UMfA1gWuVAW8D9LS9SzfbQ7cm6yKBiUv7CzXqY2wPJ6/moGYCkoRViZg3D7xeiJ6CmSJkZlFsQK4yrnBx9GEQVe0KQ7PTNFkXQD8Giovp7AHbcIKZXDhBhkrX9+JgD1Lj1BCc8B0dy6Q9nceMixhyz/rDuHpZsq9WoAcsqPn7jufip+J3aAvehXxWyTrcExv/OaPh3BxMNyzXPmZxA76/2+UfuXUOh6f48OsdhCVRvTxte4iVsjxYlZxvvhlXREbm6qVCQzWHrQDp7QYNl1ot+zmbv1FHRFslSYzX8d2YnoWuU+qCrAuUFJhxo41Hs4mdqkq2tQzN1KwbOO7hQ+IvfxncL2AT9v9Uo3bu/IS55gGcM62tQJX4CM8HluVN0rzsusYKI1XySkBVHcYqfbDRin780AvE0A1179fAmwjGwzc8+V8w10MILrtrUa+2OhQ1VT6lx1NvWjjQDuitq5C+wVCvjYNBaPfJLEAJ06XuGeIynL2OujCAs/62Gpfl0Lm3iGOouEQ7xA3w4jY17c/uScCb/efUXXvFmBExyX+qToIwr0dvzqE6MjO+zwIxCezgusL4qLuOwMPA5Gw1XqfLbrRedmXCYBqXmx8AbwcOQhj4Q68fDXBJFWJgA958q679r4GVbcRahv43Og5pmrAyYHyKam7J60H228VXgGOceTHyi9A+H/hYG+7PlJeUAAAAABJRU5ErkJggg==";

// portal/src/pages.ts
var esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
var paras = (text2) => text2.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
var termsOf = (j, shop) => j.proposal.terms ?? shop.terms;
var clientName = (j) => [j.client.first, j.client.last].filter(Boolean).join(" ") || "there";
var noticeCss = `.notice{border:1px solid #999;padding:14px;margin:18px 0;font-size:13px;break-inside:avoid}.notice h3{text-align:center;margin:0 0 8px}.sigline{margin-top:28px}.muted{color:#646b73}`;
var css = `:root{--ink:#1f2328;--muted:#646b73;--line:#e3e0da;--bg:#f7f5f1;--card:#fff;--accent:#2b4a3c;--accent-ink:#fff;--warn:#9a3412}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:760px;margin:0 auto;padding:0 16px 48px}header.top{background:var(--card);border-bottom:1px solid var(--line)}
header.top .in{max-width:760px;margin:0 auto;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
header.top img{height:40px}header.top .who{font-size:13px;color:var(--muted);text-align:right}
h1{font-size:26px;line-height:1.2;margin:28px 0 4px}h2{font-size:19px;margin:0 0 10px}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin:16px 0}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.gallery a{display:block;border-radius:8px;overflow:hidden;background:#ddd}
.gallery img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover}
.price{display:flex;gap:24px;flex-wrap:wrap;margin:6px 0 12px}.price div{min-width:140px}.price b{display:block;font-size:24px}
iframe.doc{width:100%;height:70vh;border:1px solid var(--line);border-radius:8px;background:#fff}
details{border-top:1px solid var(--line);padding:10px 0}details:first-of-type{border-top:0}summary{cursor:pointer;font-weight:600}
ul.docs{list-style:none;padding:0;margin:0}ul.docs li{padding:10px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px}ul.docs li:first-child{border-top:0}
a{color:var(--accent)}.btn{display:inline-block;padding:11px 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.btn.ghost{background:transparent;color:var(--accent)}.btn:disabled{opacity:.5;cursor:default}
label.chk{display:flex;gap:10px;align-items:flex-start;margin:10px 0}label.chk input{margin-top:5px;width:18px;height:18px;flex:none}
input[type=text]{width:100%;padding:11px;font:inherit;border:1px solid #c9c4ba;border-radius:8px}
canvas.pad{width:100%;height:160px;border:1px dashed #a9a296;border-radius:8px;background:#fffdf8;touch-action:none;display:block}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}.ok{color:#14532d;background:#ecfdf3;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px}
.warn{color:var(--warn)}.pay{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}${noticeCss}footer{font-size:13px;color:var(--muted);text-align:center;margin-top:28px}
@media print{body{background:#fff}header.top,.noprint{display:none}main{max-width:none;padding:0}.card{border:0;padding:0}}`;
function shell(title, body, shop, who = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title><style>${css}</style></head><body>
<header class="top"><div class="in"><img src="${LOGO}" alt="CJC Custom Carpentry"><div class="who">${who}</div></div></header>
<main>${body}<footer>${shop.company.map(esc).join(" \xB7 ")}</footer></main></body></html>`;
}
function payBlock(j, shop) {
  const invs = (j.invoices ?? []).filter((i) => i.amount > 0);
  if (!invs.length) return "";
  const payee = shop.company[0] || "CJC Custom Carpentry LLC";
  const label = { deposit: "Deposit", final: "Final payment", change: "Change order" };
  return `<div class="pay">${invs.map((i) => i.balance <= 0 ? `<p class="ok">${label[i.kind]} of ${money(i.amount)} received. Thank you!</p>` : `<p><b>${label[i.kind]} due: ${money(i.balance)}</b>${i.docNumber ? ` <span class="muted">(invoice ${esc(i.docNumber)})</span>` : ""}</p>
${i.link ? `<div class="row"><a class="btn" href="${esc(i.link)}" target="_blank" rel="noopener">Pay by card or bank transfer</a></div>` : ""}
<p class="muted">${i.link ? "Or pay" : "Pay"} by check to <b>${esc(payee)}</b>${shop.company[1] ? `, ${esc(shop.company[1])}` : ""}, or in person.</p>`).join("")}</div>`;
}
function projectPage(j, shop, token, flash = "", visits = []) {
  const base = `/p/${token}`;
  const s = j.signature;
  const shots = j.renderings.length ? `<section class="card"><h2>Your design</h2><div class="gallery">${j.renderings.map((r) => `<a href="${base}/img/${esc(r.id)}" target="_blank" rel="noopener"><img src="${base}/img/${esc(r.id)}" alt="${esc(r.name)}" loading="lazy"></a>`).join("")}</div><p class="muted">Renderings show the look of the work; the signed scope and the shop drawings that follow set the details.</p></section>` : "";
  const docs = shop.docs.filter((d) => d.kind !== "terms");
  const termsDoc = shop.docs.find((d) => d.kind === "terms");
  const signBlock = j.cancelled ? `<div class="warn">This agreement was cancelled on ${esc(longDate(easternYmd(j.cancelled.at)))}. Any deposit paid will be returned within 10 business days.</div>` : s ? `<div class="ok">Signed by <b>${esc(s.name)}</b> on ${esc(longDate(easternYmd(s.at)))}. Thank you!</div>
<div class="row"><a class="btn" href="${base}/agreement" target="_blank" rel="noopener">Your signed agreement</a></div>
${payBlock(j, shop)}
${canCancel(s.at) ? `<details class="noprint"><summary>Changed your mind?</summary><p>You can cancel without penalty until midnight on ${esc(longDate(cancelDeadline(easternYmd(s.at))))}. The Notice of Cancellation is at the end of your signed agreement, or use this:</p>
<form method="post" action="${base}/cancel" onsubmit="return confirm('Cancel this agreement?')"><input type="text" name="name" placeholder="Type your full name to cancel" required><div class="row"><button class="btn ghost">Cancel the agreement</button></div></form></details>` : ""}` : `<p>Read the scope, price and terms above. When you\u2019re ready, sign below; your signed copy, with your Notice of Cancellation, opens right away to save or print.</p>
<form id="sign" method="post" action="${base}/sign">
<label class="chk"><input type="checkbox" name="consent" required> <span>I agree to sign and receive this agreement electronically. I can save or print it, and I can ask CJC Custom Carpentry for a paper copy at any time.</span></label>
<label class="chk"><input type="checkbox" name="agree" required> <span>I have read the Project Scope of Work, the Purchase Agreement and the Terms and Conditions, and I agree to them.</span></label>
<p><input type="text" name="name" placeholder="Your full name" autocomplete="name" required></p>
<p class="muted" style="margin:0 0 6px">Sign with your finger or mouse:</p>
<canvas class="pad" id="pad"></canvas><input type="hidden" name="image" id="image">
<div class="row"><button class="btn" id="go" disabled>Sign the agreement</button><button type="button" class="btn ghost" id="clear">Clear</button></div>
</form>
<script>(()=>{const c=document.getElementById('pad'),x=c.getContext('2d');let drawn=false,down=false;
const fit=()=>{const r=c.getBoundingClientRect(),k=devicePixelRatio||1;c.width=r.width*k;c.height=r.height*k;x.scale(k,k);x.lineWidth=2.2;x.lineCap='round';x.strokeStyle='#111'};fit();
const p=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
const go=document.getElementById('go'),f=document.getElementById('sign');const ready=()=>{go.disabled=!(drawn&&f.checkValidity())};f.addEventListener('input',ready);f.addEventListener('change',ready);
c.addEventListener('pointerdown',e=>{down=true;c.setPointerCapture(e.pointerId);x.beginPath();x.moveTo(...p(e))});
c.addEventListener('pointermove',e=>{if(!down)return;x.lineTo(...p(e));x.stroke();drawn=true});
c.addEventListener('pointerup',()=>{down=false;ready()});
document.getElementById('clear').onclick=()=>{x.clearRect(0,0,c.width,c.height);drawn=false;ready()};
f.addEventListener('submit',()=>{document.getElementById('image').value=c.toDataURL('image/png');go.disabled=true;go.textContent='Signing\u2026'});})();</script>`;
  const body = `${flash ? `<p class="ok">${esc(flash)}</p>` : ""}
<h1>${esc(j.project)}</h1><p class="muted">Prepared for ${esc(clientName(j))}${j.client.address ? ` \xB7 ${esc(j.client.address)}` : ""}</p>
${visits.length ? `<section class="card"><h2>Coming up</h2>${visits.map((v) => `<p><b>${esc(apptLabel[v.kind])}</b> \xB7 ${esc(whenEastern(v.start))}${v.location ? `<br><span class="muted">${esc(v.location)}</span>` : ""}${v.notes ? `<br>${esc(v.notes)}` : ""}</p><p><a class="btn ghost" href="${base}/visit/${esc(v.id)}.ics">Add to my calendar</a></p>`).join("")}</section>` : ""}
${shots}
<section class="card"><h2>Your proposal</h2>
<div class="price"><div><span class="muted">Total project investment</span><b>${money(j.proposal.total)}</b></div><div><span class="muted">Deposit at signing (30%)</span><b>${money(j.proposal.deposit)}</b></div></div>
<iframe class="doc" title="Project scope and purchase agreement" sandbox srcdoc="${esc(j.proposal.agreementHtml)}"></iframe>
<p class="row"><a href="${base}/agreement" target="_blank" rel="noopener">Open the full agreement to print or save</a></p></section>
<section class="card"><h2>Terms and conditions</h2>${termsOf(j, shop) ? `<details><summary>Read the terms</summary>${paras(termsOf(j, shop))}</details>` : '<p class="muted">Terms are attached to the agreement.</p>'}${termsDoc ? `<p><a href="${base}/doc/${esc(termsDoc.id)}" target="_blank" rel="noopener">${esc(termsDoc.title)} (PDF)</a></p>` : ""}</section>
${docs.length ? `<section class="card"><h2>Licenses and insurance</h2><ul class="docs">${docs.map((d) => `<li><a href="${base}/doc/${esc(d.id)}" target="_blank" rel="noopener">${esc(d.title)}</a>${d.expires ? `<span class="muted">valid through ${esc((/* @__PURE__ */ new Date(`${d.expires}T12:00:00Z`)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }))}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
${shop.about ? `<section class="card"><h2>About CJC Custom Carpentry</h2>${paras(shop.about)}</section>` : ""}
<section class="card" id="signing"><h2>${s ? "Signed" : "Sign the agreement"}</h2>${signBlock}</section>`;
  return shell(`${j.project} \xB7 CJC Custom Carpentry`, body, shop, esc(clientName(j)));
}
function agreementPage(j, shop) {
  const html2 = j.proposal.agreementHtml;
  const style = (html2.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "").replace(/body\s*\{[^}]*\}/, "");
  const inner = html2.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html2;
  const s = j.signature;
  const seller = shop.company[0] || "CJC Custom Carpentry LLC";
  const address = shop.company[1] || "";
  const signed = s ? `<section style="page-break-before:always"><h2>Electronic signature</h2>
<p>Signed by <b>${esc(s.name)}</b> on ${esc(new Date(s.at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }))} (Eastern), from ${esc(s.ip)}.</p>
<p><img src="${esc(s.image)}" alt="Signature of ${esc(s.name)}" style="max-width:360px;border-bottom:1px solid #111"></p>
<p class="muted" style="font-size:12px">The signer agreed to sign electronically and confirmed reading the Project Scope of Work, Purchase Agreement and Terms and Conditions. Document fingerprint (SHA-256) ${esc(s.hash.slice(0, 32))}, version ${s.version}.</p>
${noticeOfCancellation(easternYmd(s.at), seller, address)}${noticeOfCancellation(easternYmd(s.at), seller, address)}</section>` : '<p class="muted">Not signed yet.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(j.project)} agreement</title><style>body{font:11pt/1.45 Georgia,serif;max-width:7.5in;margin:.5in auto;padding:0 16px;color:#111}${style}${noticeCss}
.terms p{font-size:10pt}</style></head><body>${inner}
${termsOf(j, shop) ? `<section class="terms" style="page-break-before:always"><h2>Terms and Conditions</h2>${paras(termsOf(j, shop))}</section>` : ""}
${signed}</body></html>`;
}
var simplePage = (title, text2, shop) => shell(title, `<h1>${esc(title)}</h1><p>${esc(text2)}</p>`, shop);

// portal/src/qb.ts
var defaultQbSettings = { autoDeposit: true, email: true };
var qbReady = (env) => Boolean(env.QB_CLIENT_ID && env.QB_CLIENT_SECRET);
var sandbox = (env) => String(env.QB_ENV || "").toLowerCase() === "sandbox";
var apiBase = (env) => sandbox(env) ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
var TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
var REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
var MINOR = "75";
var redirectUri = (origin) => `${origin}/qb/callback`;
var getConn = async (env) => await env.PORTAL.get("qb", "json");
async function getQbSettings(env) {
  return { ...defaultQbSettings, ...await env.PORTAL.get("qb-settings", "json") };
}
var putQbSettings = (env, s) => env.PORTAL.put("qb-settings", JSON.stringify(s));
async function connectUrl(env, origin) {
  const state = randomToken(18);
  await env.PORTAL.put(`qbstate:${state}`, JSON.stringify(Date.now() + 10 * 6e4));
  const q = new URLSearchParams({ client_id: env.QB_CLIENT_ID, response_type: "code", scope: "com.intuit.quickbooks.accounting", redirect_uri: redirectUri(origin), state });
  return `https://appcenter.intuit.com/connect/oauth2?${q}`;
}
var basic = (env) => `Basic ${btoa(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`)}`;
async function tokenCall(env, body) {
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { authorization: basic(env), accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`QuickBooks sign-in failed: ${j.error_description || j.error || res.status}`);
  return j;
}
async function finishConnect(env, url) {
  const state = url.searchParams.get("state") || "";
  const exp = await env.PORTAL.get(`qbstate:${state}`, "json");
  await env.PORTAL.delete(`qbstate:${state}`);
  if (!exp || exp < Date.now()) throw new Error("That connect link expired. Start again from the QuickBooks page.");
  if (url.searchParams.get("error")) throw new Error(`QuickBooks said: ${url.searchParams.get("error")}`);
  const code = url.searchParams.get("code") || "";
  const realmId = url.searchParams.get("realmId") || "";
  if (!code || !realmId) throw new Error("QuickBooks didn\u2019t send the company back. Try again.");
  const t = await tokenCall(env, { grant_type: "authorization_code", code, redirect_uri: redirectUri(url.origin) });
  const now = Date.now();
  const conn = { realmId, access: t.access_token, accessExp: now + t.expires_in * 1e3, refresh: t.refresh_token, refreshExp: now + t.x_refresh_token_expires_in * 1e3, connectedAt: now };
  await env.PORTAL.put("qb", JSON.stringify(conn));
  try {
    const info = await qb(env, "GET", `companyinfo/${realmId}`);
    conn.companyName = info.CompanyInfo?.CompanyName;
    await env.PORTAL.put("qb", JSON.stringify(conn));
  } catch {
  }
  return conn.companyName || "your company";
}
async function disconnect(env) {
  const c = await getConn(env);
  if (c) await fetch(REVOKE_URL, { method: "POST", headers: { authorization: basic(env), accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ token: c.refresh }) }).catch(() => void 0);
  await env.PORTAL.delete("qb");
}
async function access(env) {
  const c = await getConn(env);
  if (!c) throw new Error("QuickBooks isn\u2019t connected. Connect it from the portal\u2019s QuickBooks page.");
  if (c.accessExp - Date.now() > 6e4) return c;
  if (c.refreshExp < Date.now()) throw new Error("The QuickBooks connection expired. Connect it again from the portal\u2019s QuickBooks page.");
  const t = await tokenCall(env, { grant_type: "refresh_token", refresh_token: c.refresh });
  const now = Date.now();
  const next = { ...c, access: t.access_token, accessExp: now + t.expires_in * 1e3, refresh: t.refresh_token, refreshExp: now + t.x_refresh_token_expires_in * 1e3 };
  await env.PORTAL.put("qb", JSON.stringify(next));
  return next;
}
async function qb(env, method, path, body, query = {}) {
  const c = await access(env);
  const q = new URLSearchParams({ minorversion: MINOR, ...query });
  const res = await fetch(`${apiBase(env)}/v3/company/${c.realmId}/${path}?${q}`, {
    method,
    headers: { authorization: `Bearer ${c.access}`, accept: "application/json", ...body !== void 0 ? { "content-type": typeof body === "string" ? "application/octet-stream" : "application/json" } : {} },
    body: body === void 0 ? void 0 : typeof body === "string" ? body : JSON.stringify(body)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.Fault) {
    const e = j.Fault?.Error?.[0] ?? j.fault?.error?.[0];
    throw Object.assign(new Error(`QuickBooks: ${e?.Message || e?.message || res.status}${e?.Detail || e?.detail ? ` (${e.Detail || e.detail})` : ""}`), { qbCode: e?.code });
  }
  return j;
}
var quote = (s) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
var select = async (env, sql) => (await qb(env, "GET", "query", void 0, { query: sql })).QueryResponse ?? {};
async function listItems(env) {
  const r = await select(env, "select Id, Name, Type, Active from Item where Type = 'Service' maxresults 200");
  return (r.Item ?? []).filter((i) => i.Active !== false).map((i) => ({ id: String(i.Id), name: String(i.Name) }));
}
async function customerFor(env, j) {
  const name = [j.client.first, j.client.last].filter(Boolean).join(" ").trim() || j.project;
  const byName = await select(env, `select Id, DisplayName from Customer where DisplayName = ${quote(name)}`);
  if (byName.Customer?.[0]) return { id: String(byName.Customer[0].Id), name };
  if (j.client.email) {
    const byEmail = await select(env, `select Id, DisplayName, PrimaryEmailAddr from Customer where PrimaryEmailAddr = ${quote(j.client.email)}`);
    if (byEmail.Customer?.[0]) return { id: String(byEmail.Customer[0].Id), name: String(byEmail.Customer[0].DisplayName) };
  }
  const addr = parseAddress(j.client.address || "");
  const body = (display) => ({
    DisplayName: display,
    GivenName: j.client.first || void 0,
    FamilyName: j.client.last || void 0,
    PrimaryEmailAddr: j.client.email ? { Address: j.client.email } : void 0,
    PrimaryPhone: j.client.phone ? { FreeFormNumber: j.client.phone } : void 0,
    BillAddr: addr,
    ShipAddr: addr
  });
  try {
    const r = await qb(env, "POST", "customer", body(name));
    return { id: String(r.Customer.Id), name };
  } catch (e) {
    if (e.qbCode !== "6240") throw e;
    const r = await qb(env, "POST", "customer", body(`${name} (client)`));
    return { id: String(r.Customer.Id), name: `${name} (client)` };
  }
}
function parseAddress(s) {
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return void 0;
  const out = { Line1: parts[0] };
  const tail = parts.slice(1).join(" ");
  const m = tail.match(/^(.*?)\s*,?\s*\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) Object.assign(out, { City: m[1].replace(/,$/, "").trim() || void 0, CountrySubDivisionCode: m[2], PostalCode: m[3] });
  else if (parts[1]) Object.assign(out, { City: parts[1], CountrySubDivisionCode: "MA" });
  return out;
}
var due = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
async function makeInvoice(env, j, kind, amount, description) {
  const s = await getQbSettings(env);
  if (!s.itemId) throw new Error("Pick the QuickBooks product/service for invoices first (Portal settings \u2192 QuickBooks).");
  if (!(amount > 0)) throw new Error("The invoice amount is $0.");
  const cust = await customerFor(env, j);
  const r = await qb(env, "POST", "invoice", {
    CustomerRef: { value: cust.id },
    Line: [{ Amount: round2(amount), DetailType: "SalesItemLineDetail", Description: description, SalesItemLineDetail: { ItemRef: { value: s.itemId }, Qty: 1, UnitPrice: round2(amount), TaxCodeRef: { value: "NON" } } }],
    BillEmail: j.client.email ? { Address: j.client.email } : void 0,
    AllowOnlineCreditCardPayment: true,
    AllowOnlineACHPayment: true,
    DueDate: due(kind === "deposit" ? 3 : 10),
    CustomerMemo: { value: `${j.project}. Thank you!` },
    PrivateNote: `Client portal job ${j.jobId}, agreement version ${j.proposal.version}.`
  });
  const inv = { kind, id: String(r.Invoice.Id), docNumber: r.Invoice.DocNumber, amount: round2(amount), balance: Number(r.Invoice.Balance ?? amount), createdAt: Date.now(), checkedAt: Date.now() };
  if (s.email && j.client.email) {
    await qb(env, "POST", `invoice/${inv.id}/send`, "", { sendTo: j.client.email }).then(() => {
      inv.emailed = true;
    }, () => void 0);
  }
  await refreshInvoice(env, inv);
  return inv;
}
async function refreshInvoice(env, inv) {
  const r = await qb(env, "GET", `invoice/${inv.id}`, void 0, { include: "invoiceLink" });
  inv.balance = Number(r.Invoice?.Balance ?? inv.balance);
  if (r.Invoice?.InvoiceLink) inv.link = String(r.Invoice.InvoiceLink);
  inv.checkedAt = Date.now();
  return inv;
}
async function recordPayment(env, j, inv, method, amount, ref) {
  if (!(amount > 0)) throw new Error("The payment amount is $0.");
  const cust = await customerFor(env, j);
  const pm = method === "other" ? null : (await select(env, `select Id, Name from PaymentMethod where Name = ${quote(method === "check" ? "Check" : "Cash")}`)).PaymentMethod?.[0];
  const r = await qb(env, "POST", "payment", {
    CustomerRef: { value: cust.id },
    TotalAmt: round2(amount),
    PaymentMethodRef: pm ? { value: String(pm.Id) } : void 0,
    PaymentRefNum: ref ? ref.slice(0, 21) : void 0,
    Line: [{ Amount: round2(amount), LinkedTxn: [{ TxnId: inv.id, TxnType: "Invoice" }] }],
    PrivateNote: `Recorded from Cabinet Studio (${method}${ref ? ` #${ref}` : ""}).`
  });
  inv.payments = [...inv.payments ?? [], { method, amount: round2(amount), ref, at: Date.now(), id: String(r.Payment?.Id ?? "") }];
  return refreshInvoice(env, inv);
}
var round2 = (v) => Math.round(v * 100) / 100;

// portal/src/worker.ts
var html = (body, status2 = 200) => new Response(body, { status: status2, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
var json = (body) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!env.PORTAL) return setupPage("Almost there", "<p>The portal is running, but its storage isn\u2019t connected. In Cloudflare open this worker\u2019s <b>Settings \u2192 Bindings</b>, add a <b>KV namespace</b> binding named <code>PORTAL</code> (create a namespace called <b>cjc-portal</b> if you don\u2019t have one), then reload this page.</p>");
    const m = path.match(/^\/p\/([A-Za-z0-9_-]+)(?:\/(img|doc|visit)\/([A-Za-z0-9_-]+)(?:\.ics)?|\/(agreement|sign|cancel))?$/);
    if (m) return client(request, env, m[1], m[2] ?? m[4] ?? "", m[3] ?? "");
    const key = String(env.SHOP_KEY || "").trim();
    const cal = path.match(/^\/cal\/([a-f0-9]{32})\.ics$/);
    if (cal) {
      if (!key || cal[1] !== await feedCode(key)) return new Response("Not found", { status: 404 });
      const since = new Date(Date.now() - 90 * 864e5).toISOString();
      const appts = (await listAppts(env)).filter((a) => a.start >= since);
      return new Response(calendar(appts, "CJC Jobs"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
    }
    if (path === "/" || path === "/setup") return setup(request, url, key);
    if (path === "/qb" || path === "/qb/connect" || path === "/qb/callback") return qbPage(request, env, url, key, path);
    if (path === "/legal/eula" || path === "/legal/privacy") return html(legalPage(path.endsWith("eula")));
    const code = key ? await shopCode(key) : "";
    let p = path;
    try {
      p = decodeURIComponent(p);
    } catch {
    }
    if (!code || p !== `/${code}`) return new Response("Not found", { status: 404 });
    if (request.method === "GET") return new Response("CJC client portal connector is running.\n", { headers: { "content-type": "text/plain" } });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let msg;
    try {
      msg = await request.json();
    } catch {
      return json(rpcErr(null, -32700, "Parse error"));
    }
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map((x) => rpc(x, env, url)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const res = await rpc(msg, env, url);
    return res ? json(res) : new Response(null, { status: 202 });
  }
};
async function client(request, env, token, what, id) {
  const job = await jobByToken(env, token);
  const shop = await getShop(env);
  if (!job) return html(simplePage("Link not found", "This project link isn\u2019t active. Contact CJC Custom Carpentry for a new one.", shop), 404);
  if (what === "img" || what === "doc") {
    const key = what === "img" ? `img:${job.jobId}:${id}` : `doc:${id}`;
    const known = what === "img" ? job.renderings.some((r) => r.id === id) : shop.docs.some((d) => d.id === id);
    const got = known ? await env.PORTAL.getWithMetadata(key, "arrayBuffer") : { value: null, metadata: null };
    if (!got.value) return new Response("Not found", { status: 404 });
    const meta = got.metadata ?? {};
    return new Response(got.value, { headers: { "content-type": meta.mimeType || "application/octet-stream", "cache-control": "private, max-age=3600", "x-robots-tag": "noindex" } });
  }
  if (what === "visit") {
    const a = (await listAppts(env)).find((x) => x.id === id && x.jobId === job.jobId && x.share && !x.cancelled);
    if (!a) return new Response("Not found", { status: 404 });
    return new Response(calendar([a], shop.company[0] || "CJC Custom Carpentry", true, shop.company[0] || "CJC Custom Carpentry"), { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${apptLabel[a.kind]}.ics"`, "cache-control": "no-store" } });
  }
  if (what === "agreement") {
    await freshInvoices(env, job, 5 * 6e4);
    return html(agreementPage(job, shop));
  }
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (what === "sign" && request.method === "POST") {
    if (job.signature || job.cancelled) return Response.redirect(new URL(`/p/${token}`, request.url).href, 303);
    const f = await request.formData();
    const name = String(f.get("name") || "").trim().slice(0, 120);
    const image = String(f.get("image") || "");
    if (!name || f.get("consent") !== "on" || f.get("agree") !== "on" || !/^data:image\/png;base64,/.test(image) || image.length > 4e5) {
      return html(projectPage(job, shop, token, "Please check both boxes, type your name and sign in the box."), 400);
    }
    job.signature = { name, image, at: Date.now(), ip, ua: (request.headers.get("user-agent") || "").slice(0, 200), hash: job.proposal.hash, version: job.proposal.version, consent: true };
    await putJob(env, job);
    await autoDeposit(env, job);
    return Response.redirect(new URL(`/p/${token}/agreement`, request.url).href, 303);
  }
  if (what === "cancel" && request.method === "POST") {
    const s = job.signature;
    if (s && !job.cancelled && canCancel(s.at)) {
      const f = await request.formData();
      if (String(f.get("name") || "").trim()) {
        job.cancelled = { at: Date.now(), ip };
        await putJob(env, job);
      }
    }
    return Response.redirect(new URL(`/p/${token}`, request.url).href, 303);
  }
  job.views = [...job.views ?? [], Date.now()].slice(-50);
  await freshInvoices(env, job, 5 * 6e4);
  await putJob(env, job);
  return html(projectPage(job, shop, token, "", await visitsFor(env, job.jobId)));
}
var visitsFor = async (env, jobId) => {
  const now = new Date(Date.now() - 2 * 36e5).toISOString();
  return (await listAppts(env)).filter((a) => a.jobId === jobId && a.share && !a.cancelled && a.start >= now);
};
async function autoDeposit(env, job) {
  if (!qbReady(env) || !(job.proposal.deposit > 0) || job.invoices?.some((i) => i.kind === "deposit")) return;
  const [conn, s] = [await getConn(env), await getQbSettings(env)];
  if (!conn || !s.autoDeposit) return;
  try {
    const inv = await makeInvoice(env, job, "deposit", job.proposal.deposit, depositLine(job));
    job.invoices = [...job.invoices ?? [], inv];
    job.invoiceError = void 0;
  } catch (e) {
    job.invoiceError = String(e.message || e).slice(0, 300);
  }
  await putJob(env, job);
}
var depositLine = (j) => `Deposit (${Math.round(j.proposal.deposit / (j.proposal.total || 1) * 100)}%) on ${j.project}, per the signed agreement (version ${j.proposal.version}). Project total $${j.proposal.total.toLocaleString("en-US")}.`;
async function freshInvoices(env, job, age) {
  const open = (job.invoices ?? []).filter((i) => i.balance > 0 && Date.now() - i.checkedAt > age);
  if (!open.length || !await getConn(env)) return;
  for (const inv of open) await refreshInvoice(env, inv).catch(() => void 0);
  await putJob(env, job);
}
async function qbPage(request, env, url, key, path) {
  if (!qbReady(env)) {
    return setupPage("Connect QuickBooks", `<p>First make an app at <b>developer.intuit.com</b> (it\u2019s free), then add its keys to this worker as <b>Secrets</b> in <b>Settings \u2192 Variables and Secrets</b>: <code>QB_CLIENT_ID</code> and <code>QB_CLIENT_SECRET</code>. In the Intuit app, add this Redirect URI:</p><input readonly value="${url.origin}/qb/callback" onclick="this.select()"><p>Then reload this page.</p>`);
  }
  if (path === "/qb/callback") {
    try {
      const name = await finishConnect(env, url);
      return setupPage("QuickBooks connected", `<p>The portal is connected to <b>${esc(name)}</b>${String(env.QB_ENV).toLowerCase() === "sandbox" ? " (Intuit\u2019s test company)" : ""}. Go back to Cabinet Studio and pick the product/service for invoices under <b>Portal settings \u2192 QuickBooks</b>.</p>`);
    } catch (e) {
      return setupPage("QuickBooks didn\u2019t connect", `<p>${esc(e.message)}</p><p><a href="/qb">Try again</a></p>`);
    }
  }
  if (request.method === "POST") {
    const f = await request.formData();
    const pasted = String(f.get("key") || "").trim();
    if (!key || !pasted || await shopCode(pasted) !== await shopCode(key)) return setupPage("That key doesn\u2019t match", "<p>Paste the same SHOP_KEY you saved in Cloudflare.</p>" + qbForm());
    if (f.get("action") === "disconnect") {
      await disconnect(env);
      return setupPage("QuickBooks disconnected", '<p>The portal no longer has access to QuickBooks. Invoices already made stay in QuickBooks.</p><p><a href="/qb">Connect again</a></p>');
    }
    return Response.redirect(await connectUrl(env, url.origin), 302);
  }
  const conn = await getConn(env);
  return setupPage("QuickBooks", `<p>${conn ? `Connected to <b>${esc(conn.companyName || "your company")}</b> since ${esc(new Date(conn.connectedAt).toLocaleDateString("en-US"))}.` : "Not connected yet."}${String(env.QB_ENV).toLowerCase() === "sandbox" ? " <b>Test mode</b> (QB_ENV is sandbox)." : ""}</p><p>Paste your SHOP_KEY to ${conn ? "reconnect or disconnect" : "connect"}. QuickBooks then asks you to sign in and pick the company.</p>${qbForm(!!conn)}`);
}
var qbForm = (connected = false) => `<form method="post" action="/qb"><input name="key" type="password" placeholder="SHOP_KEY" autocomplete="off" required><p><button name="action" value="connect">${connected ? "Reconnect" : "Connect to QuickBooks"}</button>${connected ? ' <button name="action" value="disconnect" style="background:#8a2a1e">Disconnect</button>' : ""}</p></form>`;
function legalPage(eula) {
  const body = eula ? "<p>This portal is used only by CJC Custom Carpentry LLC to share proposals, agreements and invoices with its own clients. It is provided as is. Clients use it to view and sign their own project documents and to reach QuickBooks\u2019 payment page for their invoices.</p>" : "<p>The portal keeps what CJC Custom Carpentry LLC publishes for each client (proposal, renderings, documents), the client\u2019s signature with its time, IP address and browser, and page view times. QuickBooks is used only to make and track the shop\u2019s own invoices; no QuickBooks data is shared with anyone else. Data is stored with Cloudflare. Contact the shop to have a record removed where the law allows.</p>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${eula ? "End-user agreement" : "Privacy"}</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:640px;margin:8vh auto;padding:0 16px}</style></head><body><h1>${eula ? "End-user license agreement" : "Privacy policy"}</h1>${body}</body></html>`;
}
async function setup(request, url, key) {
  if (!key) {
    const suggestion = randomToken(24);
    return setupPage("Almost there", `<p>Storage is connected. Now add a <b>Secret</b> named <code>SHOP_KEY</code> in this worker\u2019s <b>Settings \u2192 Variables and Secrets</b>. Make up a long password, or use this one (copy it somewhere safe first):</p><input readonly value="${suggestion}" onclick="this.select()"><p>Save and deploy, then reload this page.</p>`);
  }
  if (request.method === "POST") {
    const pasted = String((await request.formData()).get("key") || "").trim();
    if (pasted && await shopCode(pasted) === await shopCode(key)) {
      const address = `${url.origin}/${await shopCode(key)}`;
      return setupPage("Your connector address", `<p>In claude.ai go to <b>Settings \u2192 Connectors \u2192 Add custom connector</b>, name it <b>CJC Portal</b> and paste this address:</p><input readonly value="${address}" onclick="this.select()"><p><button onclick="navigator.clipboard.writeText('${address}');this.textContent='Copied'">Copy</button></p><p class="note">Keep it private: it can publish and read your client pages.</p>`);
    }
    return setupPage("That key doesn\u2019t match", "<p>Paste the same SHOP_KEY you saved in Cloudflare.</p>" + keyForm());
  }
  return setupPage("CJC client portal is running", "<p>Storage: <b>connected</b>. SHOP_KEY: <b>saved</b>. Paste the same SHOP_KEY below to get the connector address for Cabinet Studio.</p>" + keyForm());
}
var keyForm = () => '<form method="post" action="/setup"><input name="key" type="password" placeholder="SHOP_KEY" autocomplete="off" required><button>Get the connector address</button></form>';
async function shopCode(key) {
  return (await sha256(`cjc-portal-connector:${key}`)).slice(0, 40);
}
function setupPage(title, body) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:10vh auto;padding:0 16px;color:#1d2127;background:#fbfbfc}input{width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid #c9ced6;border-radius:6px;margin:6px 0}button{padding:9px 16px;font:inherit;border:0;border-radius:6px;background:#2b4a3c;color:#fff;cursor:pointer}.note{color:#646d78;font-size:14px}code{background:#eef0f2;padding:1px 4px;border-radius:4px}</style>
</head><body><h1>${title}</h1>${body}</body></html>`);
}
var TOOLS = [
  { name: "get_shop", description: "The portal\u2019s shop profile: company lines, about blurb, terms, and the documents (licenses, insurance) with their expiration dates.", inputSchema: { type: "object", properties: {} } },
  {
    name: "update_shop",
    description: "Change the shop profile shown on every client page. Only the fields sent change.",
    inputSchema: { type: "object", properties: { company: { type: "array", items: { type: "string" } }, about: { type: "string" }, terms: { type: "string" }, contactEmail: { type: "string" } } }
  },
  {
    name: "upload_shop_doc",
    description: "Add or replace a shop document shown to every client (license, insurance certificate, terms PDF). Send base64 bytes, or a Dropbox temporary link; up to about 20 MB.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Replace this document; omit for a new one." }, title: { type: "string" }, kind: { type: "string", enum: ["license", "insurance", "terms", "other"] }, mimeType: { type: "string" }, expires: { type: "string", description: "YYYY-MM-DD, for reminders." }, data: { type: "string", description: "Base64 bytes." }, source_url: { type: "string", description: "Or: a Dropbox temporary download link for the portal to fetch." } }, required: ["title", "kind"] }
  },
  { name: "delete_shop_doc", description: "Remove a shop document.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "publish_proposal",
    description: "Create or update a client\u2019s project page with the proposal: the scope and purchase agreement (HTML), price, and renderings. Returns the private link. A signed proposal is not replaced unless replace_signed is true.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        project: { type: "string" },
        client: { type: "object", properties: { first: { type: "string" }, last: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, address: { type: "string" } } },
        agreement_html: { type: "string" },
        total: { type: "number" },
        deposit: { type: "number" },
        renderings: { type: "array", items: { type: "object", properties: { name: { type: "string" }, mimeType: { type: "string" }, data: { type: "string" } }, required: ["data"] } },
        keep_renderings: { type: "boolean", description: "Leave the renderings already published as they are." },
        replace_signed: { type: "boolean" }
      },
      required: ["job_id", "project", "agreement_html", "total", "deposit"]
    }
  },
  { name: "job_status", description: "Where a client\u2019s page stands: link, views, signature (who, when), cancellation and its deadline.", inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] } },
  { name: "list_jobs", description: "Every job on the portal with its status.", inputSchema: { type: "object", properties: {} } },
  { name: "list_appointments", description: "Appointments on the portal calendar, soonest first. By default from yesterday on; pass from (ISO date) for older.", inputSchema: { type: "object", properties: { from: { type: "string" }, job_id: { type: "string" } } } },
  {
    name: "save_appointment",
    description: "Add an appointment, or change one (pass its id). Times are ISO with an offset or Z.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, job_id: { type: "string" }, who: { type: "string" }, kind: { type: "string", enum: ["measure", "design", "review", "install", "delivery", "other"] }, start: { type: "string" }, minutes: { type: "number" }, location: { type: "string" }, phone: { type: "string" }, notes: { type: "string" }, remind: { type: "array", items: { type: "number" }, description: "Alerts, minutes before." }, share: { type: "boolean", description: "Show on the client\u2019s project page." }, cancelled: { type: "boolean" } }, required: ["start"] }
  },
  { name: "delete_appointment", description: "Remove an appointment from the calendar.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "calendar_feed", description: "The private calendar address for Cody\u2019s phone to subscribe to.", inputSchema: { type: "object", properties: {} } },
  { name: "qb_status", description: "Whether QuickBooks Online is set up and connected, to which company, the invoice settings, and the address of the page for connecting it.", inputSchema: { type: "object", properties: {} } },
  { name: "qb_items", description: "The QuickBooks products/services (type Service) an invoice line can use.", inputSchema: { type: "object", properties: {} } },
  {
    name: "qb_settings",
    description: "Change the invoice settings. Only the fields sent change.",
    inputSchema: { type: "object", properties: { item_id: { type: "string" }, item_name: { type: "string" }, auto_deposit: { type: "boolean", description: "Make and send the deposit invoice when the client signs." }, email: { type: "boolean", description: "Have QuickBooks email invoices to the client." } } }
  },
  {
    name: "create_invoice",
    description: "Make a QuickBooks invoice for a job (with card/ACH payment on), and email it when that is on. Deposit defaults to the proposal deposit; final defaults to the total less what was invoiced before.",
    inputSchema: { type: "object", properties: { job_id: { type: "string" }, kind: { type: "string", enum: ["deposit", "final", "change"] }, amount: { type: "number" }, description: { type: "string" } }, required: ["job_id", "kind"] }
  },
  {
    name: "record_payment",
    description: "Record a check or cash payment against one of the job\u2019s invoices in QuickBooks.",
    inputSchema: { type: "object", properties: { job_id: { type: "string" }, invoice_id: { type: "string" }, method: { type: "string", enum: ["check", "cash", "other"] }, amount: { type: "number" }, ref: { type: "string", description: "Check number." } }, required: ["job_id", "invoice_id", "method", "amount"] }
  }
];
var rpcOk = (id, result) => ({ jsonrpc: "2.0", id, result });
var rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
async function rpc(raw, env, url) {
  const { id, method, params } = raw || {};
  if (id === void 0 || id === null) return null;
  try {
    switch (method) {
      case "initialize":
        return rpcOk(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "cjc-portal", version: "1.0.0" } });
      case "ping":
        return rpcOk(id, {});
      case "tools/list":
        return rpcOk(id, { tools: TOOLS });
      case "tools/call": {
        const out = await tool(String(params?.name), params?.arguments || {}, env, url);
        return rpcOk(id, { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out });
      }
      default:
        return rpcErr(id, -32601, `Unknown method ${method}`);
    }
  } catch (e) {
    return rpcOk(id, { isError: true, content: [{ type: "text", text: String(e?.message || e) }] });
  }
}
var status = (j, url) => ({
  job_id: j.jobId,
  project: j.project,
  url: `${url.origin}/p/${j.token}`,
  version: j.proposal.version,
  publishedAt: j.proposal.publishedAt,
  views: (j.views ?? []).length,
  lastViewed: j.views?.length ? j.views[j.views.length - 1] : null,
  signed: j.signature ? { name: j.signature.name, at: j.signature.at, version: j.signature.version, current: j.signature.hash === j.proposal.hash } : null,
  cancelDeadline: j.signature ? cancelDeadline(easternYmd(j.signature.at)) : null,
  cancelled: j.cancelled ? { at: j.cancelled.at } : null,
  invoices: (j.invoices ?? []).map((i) => ({ id: i.id, kind: i.kind, number: i.docNumber ?? null, amount: i.amount, balance: i.balance, paid: i.balance <= 0, emailed: !!i.emailed, payLink: !!i.link, createdAt: i.createdAt, payments: i.payments ?? [] })),
  invoiceError: j.invoiceError ?? null
});
async function fetchDropbox(src) {
  const u = new URL(src);
  if (u.protocol !== "https:" || !/(^|\.)dropboxusercontent\.com$/.test(u.hostname)) throw new Error("Only Dropbox download links can be fetched.");
  const res = await fetch(u.href, { redirect: "follow" });
  if (!res.ok) throw new Error(`Dropbox answered ${res.status}; the link may have expired.`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 24e6) throw new Error("That file is over the portal\u2019s 24 MB limit.");
  return buf;
}
async function tool(name, a, env, url) {
  const str = (k) => typeof a[k] === "string" ? a[k] : void 0;
  switch (name) {
    case "get_shop":
      return { shop: await getShop(env) };
    case "update_shop": {
      const s = await getShop(env);
      if (Array.isArray(a.company)) s.company = a.company.map(String);
      for (const k of ["about", "terms", "contactEmail"]) if (str(k) !== void 0) s[k] = str(k);
      await putShop(env, s);
      return { shop: s };
    }
    case "upload_shop_doc": {
      const s = await getShop(env);
      const bytes = str("source_url") ? await fetchDropbox(str("source_url")) : b64ToBytes(String(a.data || ""));
      if (!bytes.byteLength) throw new Error("The document is empty.");
      const id = str("id") && s.docs.some((d) => d.id === str("id")) ? str("id") : randomToken(9);
      const doc = { id, title: str("title") || "Document", kind: str("kind") || "other", mimeType: str("mimeType") || "application/pdf", size: bytes.byteLength, expires: str("expires") || void 0, uploadedAt: Date.now() };
      await env.PORTAL.put(`doc:${id}`, bytes, { metadata: { mimeType: doc.mimeType } });
      s.docs = [...s.docs.filter((d) => d.id !== id), doc];
      await putShop(env, s);
      return { doc };
    }
    case "delete_shop_doc": {
      const s = await getShop(env);
      s.docs = s.docs.filter((d) => d.id !== str("id"));
      await env.PORTAL.delete(`doc:${str("id")}`);
      await putShop(env, s);
      return { ok: true };
    }
    case "publish_proposal": {
      const jobId = String(a.job_id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
      if (!jobId) throw new Error("job_id is needed.");
      const old = await getJob(env, jobId);
      if (old?.signature && !old.cancelled && !a.replace_signed) throw new Error("This proposal is already signed. Publish with replace_signed to put up a new version for signing.");
      const shop = await getShop(env);
      const agreementHtml = String(a.agreement_html || "");
      const version = (old?.proposal.version ?? 0) + 1;
      const hash = await sha256(`${agreementHtml}
--terms--
${shop.terms}`);
      let renderings = old?.renderings ?? [];
      if (!a.keep_renderings && Array.isArray(a.renderings)) {
        for (const r of renderings) await env.PORTAL.delete(`img:${jobId}:${r.id}`);
        renderings = [];
        for (const r of a.renderings.slice(0, 12)) {
          const rid = randomToken(9);
          await env.PORTAL.put(`img:${jobId}:${rid}`, b64ToBytes(r.data), { metadata: { mimeType: r.mimeType || "image/jpeg" } });
          renderings.push({ id: rid, name: r.name || "Rendering", mimeType: r.mimeType || "image/jpeg" });
        }
      }
      const token = old?.token ?? randomToken(18);
      const job = {
        jobId,
        token,
        client: a.client ?? old?.client ?? {},
        project: String(a.project || old?.project || "Your project"),
        stage: "proposal",
        proposal: { agreementHtml, total: Number(a.total) || 0, deposit: Number(a.deposit) || 0, publishedAt: Date.now(), version, hash, terms: shop.terms },
        renderings,
        views: old?.views ?? [],
        history: old?.history ?? [],
        invoices: old?.invoices ?? []
      };
      if (old?.signature) job.history.push({ ...old.signature, ...old.cancelled ? { cancelled: old.cancelled } : {} });
      await putJob(env, job);
      await env.PORTAL.put(`tok:${token}`, JSON.stringify(jobId));
      return status(job, url);
    }
    case "job_status": {
      const j = await getJob(env, String(a.job_id || ""));
      if (!j) throw new Error("No portal page for that job yet.");
      await freshInvoices(env, j, 0);
      return status(j, url);
    }
    case "list_appointments": {
      const from = str("from") ?? new Date(Date.now() - 864e5).toISOString();
      return { appointments: (await listAppts(env)).filter((a2) => a2.start >= from && (!str("job_id") || a2.jobId === str("job_id"))) };
    }
    case "save_appointment": {
      const { job_id, ...rest } = a;
      return { appointment: await saveAppt(env, { ...rest, ...job_id !== void 0 ? { jobId: String(job_id) || void 0 } : {}, start: String(a.start) }) };
    }
    case "delete_appointment": {
      await deleteAppt(env, String(a.id || ""));
      return { ok: true };
    }
    case "calendar_feed": {
      const key = String(env.SHOP_KEY || "").trim();
      if (!key) throw new Error("SHOP_KEY isn\u2019t set.");
      const url2 = `${url.origin}/cal/${await feedCode(key)}.ics`;
      return { url: url2, webcal: url2.replace(/^https:/, "webcal:") };
    }
    case "qb_status": {
      const conn = qbReady(env) ? await getConn(env) : null;
      return { configured: qbReady(env), connected: !!conn, company: conn?.companyName ?? null, sandbox: String(env.QB_ENV || "").toLowerCase() === "sandbox", connectPage: `${url.origin}/qb`, redirectUri: `${url.origin}/qb/callback`, settings: await getQbSettings(env), expiresAt: conn?.refreshExp ?? null };
    }
    case "qb_items":
      return { items: await listItems(env) };
    case "qb_settings": {
      const st = await getQbSettings(env);
      if (str("item_id") !== void 0) {
        st.itemId = str("item_id");
        st.itemName = str("item_name");
      }
      if (typeof a.auto_deposit === "boolean") st.autoDeposit = a.auto_deposit;
      if (typeof a.email === "boolean") st.email = a.email;
      await putQbSettings(env, st);
      return { settings: st };
    }
    case "create_invoice": {
      const j = await getJob(env, String(a.job_id || ""));
      if (!j) throw new Error("No portal page for that job yet.");
      const kind = str("kind") || "deposit";
      const before = (j.invoices ?? []).filter((i) => i.kind !== "change").reduce((t, i) => t + i.amount, 0);
      const amount = typeof a.amount === "number" ? a.amount : kind === "deposit" ? j.proposal.deposit : kind === "final" ? j.proposal.total - before : 0;
      const description = str("description") || (kind === "deposit" ? depositLine(j) : kind === "final" ? `Final payment on ${j.project}: project total $${j.proposal.total.toLocaleString("en-US")} less $${before.toLocaleString("en-US")} invoiced before.` : `Change order on ${j.project}.`);
      const inv = await makeInvoice(env, j, kind, amount, description);
      j.invoices = [...j.invoices ?? [], inv];
      if (kind === "deposit") j.invoiceError = void 0;
      await putJob(env, j);
      return status(j, url);
    }
    case "record_payment": {
      const j = await getJob(env, String(a.job_id || ""));
      const inv = j?.invoices?.find((i) => i.id === str("invoice_id"));
      if (!j || !inv) throw new Error("That invoice isn\u2019t on this job.");
      await recordPayment(env, j, inv, str("method") || "check", Number(a.amount), str("ref"));
      await putJob(env, j);
      return status(j, url);
    }
    case "list_jobs": {
      const out = [];
      let cursor;
      do {
        const page = await env.PORTAL.list({ prefix: "job:", cursor });
        for (const k of page.keys) {
          const j = await env.PORTAL.get(k.name, "json");
          if (j) out.push(status(j, url));
        }
        cursor = page.list_complete ? void 0 : page.cursor;
      } while (cursor);
      return { jobs: out };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
export {
  worker_default as default
};
