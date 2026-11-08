/**
 * THE SIGN ART (UI, 2026-11-08 — the portion cutting):
 * the settled signs drawn as CANVAS PATHS, so any
 * surface can paint them — the journal's Marks picture
 * here, and the renderer's fragment-stone face by the
 * same call (the consumption contract: paint into a
 * per-(mark, sector) canvas, cache it by key — the
 * trustMarkerTexture pattern — NEVER a texture file;
 * a portion is derived from its copy, so no finite
 * atlas could hold them).
 *
 * THE MODEL (Adam, 2026-11-07 — the portion law in its
 * final form): a fragment shows ONE CONTIGUOUS ARC of
 * the WHOLE sign — ring and centre sliced together by
 * angle, clock-style — drawn SOLID, and the rest of the
 * sign drawn FADED, so the player can see what the
 * entire sign is supposed to look like. Every carrier
 * DEALS its arc: a random start hour (0–11) and a
 * random integer length of 4–6 hours on the 12-segment
 * clock, ONE dealing range for every family. Collecting
 * UNIONS arcs per mark; a filled clock is a tier.
 *
 * drawSign(ctx, mark, sectors): sectors is a LIST of
 * dealt arcs {startHour, lengthHours} — one arc for a
 * stone in the world, the per-mark UNION (the current
 * clock's arcs) for the journal page. The drawing box
 * is the lab's 240 square, centred (120, 120); the
 * caller scales/translates the context. Hours measure
 * CLOCKWISE FROM 12:00 (hour h begins at h × 30°).
 *
 * THE SIGNS are the settled glyphs, ported stroke for
 * stroke from the glyph lab (~/workspace/silent-earth/
 * glyphs-2026-11-05/glyph-lab.html — the construction
 * notes there carry each figure's reasoning): Movement,
 * Naming (the Name Stone centre, kept by Adam's eye),
 * Returning, HearthHome, Hedge — the Home set settled
 * WHOLE by Adam's verdicts 2026-11-07, Movement from
 * the 2026-11-05 pass. CIRCLE IS NOT CUT — its sign
 * isn't drawn (a whole category, Adam's word); an
 * uncut or unknown mark draws NOTHING.
 *
 * HearthHome's ring is a SQUARE: its portion follows
 * the model in the square's own terms — a contiguous
 * stretch of the PERIMETER from the top-centre of the
 * top wall, sweeping clockwise, the clip widened into
 * a band along the walls (the lab's squareWedgePath,
 * carried over whole).
 *
 * COLOURS: the caller sets the stroke/fill posture —
 * `ink` paints the solid sector, `ghost` the faded
 * rest (default weight ~7%, the lab's standing ghost —
 * a drawing constant, DRAFT, tuned at the stone-face
 * eye-check). The one FILLED element in the set —
 * Returning's fire dot — paints in `ink` in both
 * passes (the lab draws it in its own amber; on a
 * stone it is the carving's filled heart).
 */

// ---------------------------------------------------------------------------
// The contract types
// ---------------------------------------------------------------------------

/** One dealt arc on the 12-segment clock. */
export interface SignSector {
  /** The hour the arc starts (0–11), clockwise from 12:00. */
  startHour: number;
  /** The arc's length in hours (dealt copies carry 4–6; a union list may carry any cover). */
  lengthHours: number;
}

/** Drawing posture for one drawSign call. */
export interface SignArtStyle {
  /** Stroke/fill colour of the SOLID sector (and of filled elements). */
  ink: string;
  /** Stroke colour of the FADED rest. Defaults to `ink` at the ghost weight. */
  ghost?: string;
  /** The faded rest's weight (0–1). DRAFT ~0.07, the lab's ghost. */
  ghostAlpha?: number;
}

/** The marks whose signs are CUT (Circle is not — its sign isn't drawn). */
export const CUT_MARKS: readonly string[] = [
  'travel',
  'naming',
  'returning',
  'hearthhome',
  'hedge',
];

// ---------------------------------------------------------------------------
// Geometry helpers (the lab's, carried over)
// ---------------------------------------------------------------------------

const CX = 120;
const CY = 120;

/** Point at radius r, `deg` clockwise from the top. */
function P(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

type Ctx = CanvasRenderingContext2D;

function strokePath(ctx: Ctx, build: () => void, width: number): void {
  ctx.beginPath();
  build();
  ctx.lineWidth = width;
  ctx.stroke();
}

function line(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): void {
  strokePath(
    ctx,
    () => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    },
    width,
  );
}

/** Clockwise arc at radius r from `fromDeg` to `toDeg` (degrees, top = 0). */
function arcStroke(ctx: Ctx, r: number, fromDeg: number, toDeg: number, width: number): void {
  const [x1, y1] = P(r, fromDeg);
  strokePath(
    ctx,
    () => {
      ctx.moveTo(x1, y1);
      ctx.arc(CX, CY, r, ((fromDeg - 90) * Math.PI) / 180, ((toDeg - 90) * Math.PI) / 180, false);
    },
    width,
  );
}

function circleStroke(ctx: Ctx, cx: number, cy: number, r: number, width: number): void {
  strokePath(
    ctx,
    () => {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    },
    width,
  );
}

function diamondPath(ctx: Ctx, cx: number, cy: number, hd: number, vd: number): void {
  ctx.moveTo(cx, cy - vd);
  ctx.lineTo(cx + hd, cy);
  ctx.lineTo(cx, cy + vd);
  ctx.lineTo(cx - hd, cy);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// The signs (ported stroke for stroke from the glyph lab)
// ---------------------------------------------------------------------------

/** The roofline — the Home family's crown (Adam's ∧, one seat for all four). */
function roofline(ctx: Ctx, y = 48): void {
  line(ctx, 96, y + 18, CX, y, 7);
  line(ctx, CX, y, 144, y + 18, 7);
}

function movementSign(ctx: Ctx): void {
  // The ring, broken at the top by the GATE (40° opening).
  arcStroke(ctx, 96, 20, 340, 8);
  // Gate posts at both gap ends.
  for (const a of [20, 340]) {
    const [x1, y1] = P(85, a);
    const [x2, y2] = P(107, a);
    line(ctx, x1, y1, x2, y2, 6.5);
  }
  // Stride ticks: groups of three slanted strokes marching clockwise.
  for (let k = 0; k < 8; k++) {
    const base = 42 + k * 40;
    for (let j = 0; j < 3; j++) {
      const a = base + j * 5.2;
      const [x1, y1] = P(72, a);
      const [x2, y2] = P(83, a);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const rad = ((a - 90) * Math.PI) / 180;
      const tx = Math.cos(rad);
      const ty = Math.sin(rad);
      const sx = -ty;
      const sy = tx;
      const L = 6.4;
      const sl = 0.47;
      const dx = tx * (1 - sl) + sx * sl;
      const dy = ty * (1 - sl) + sy * sl;
      const n = Math.hypot(dx, dy);
      line(ctx, mx - (dx / n) * L, my - (dy / n) * L, mx + (dx / n) * L, my + (dy / n) * L, 4.4);
    }
  }
  // The road: an Archimedean spiral from the gate to the centre.
  strokePath(
    ctx,
    () => {
      const turns = 1.75;
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = t * turns * 360;
        const r = 74 - (74 - 20) * t;
        const [x, y] = P(r, ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    },
    7,
  );
  // THE NAME SEAT: waypoint diamond + hollow socket at its heart.
  strokePath(ctx, () => diamondPath(ctx, CX, CY, 13, 13), 5);
  circleStroke(ctx, CX, CY, 3.4, 3.2);
}

function namingCentreStone(ctx: Ctx): void {
  // The ground the stone stands in.
  line(ctx, 84, 152, 156, 152, 7);
  // The stone: a bold upright slab, slightly domed.
  strokePath(
    ctx,
    () => {
      ctx.moveTo(104, 152);
      ctx.lineTo(104, 104);
      ctx.quadraticCurveTo(104, 92, 120, 92);
      ctx.quadraticCurveTo(136, 92, 136, 104);
      ctx.lineTo(136, 152);
    },
    7,
  );
  // The name: ONE carved stroke down the stone's heart, the knot in miniature at its head.
  line(ctx, CX, 108, CX, 138, 5.5);
  strokePath(ctx, () => diamondPath(ctx, CX, 100, 5.5, 4.5), 4);
}

function namingSign(ctx: Ctx): void {
  // The ring, CLOSED — a seal.
  circleStroke(ctx, CX, CY, 96, 8);
  // Letter ticks standing on the ring's inner edge (the knot owns the top).
  for (let k = 0; k < 12; k++) {
    const a = 15 + k * 30;
    if (a === 345 || a === 15) continue;
    const [x1, y1] = P(80, a);
    const [x2, y2] = P(90, a);
    line(ctx, x1, y1, x2, y2, 5);
  }
  // THE KNOT: a lozenge bead woven on the ring at the top (filled in the lab).
  strokePath(ctx, () => diamondPath(ctx, CX, 24, 14, 11), 6);
  ctx.fill();
  // The crown over the stone.
  roofline(ctx);
  namingCentreStone(ctx);
}

function returningSign(ctx: Ctx): void {
  // The ring closes by CURLING: a full circle whose end hooks inward at the top.
  arcStroke(ctx, 96, 10, 350, 8);
  strokePath(
    ctx,
    () => {
      const lipSteps = 30;
      for (let i = 0; i <= lipSteps; i++) {
        const t = i / lipSteps;
        const ang = 350 + t * 72;
        const r = 96 - (96 - 71) * t;
        const [x, y] = P(r, ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    },
    8,
  );
  // Back-chevrons: pairs meeting in a point aimed AGAINST the march.
  for (let k = 0; k < 9; k++) {
    const a = 55 + k * 36;
    if (a > 340) continue;
    const rad = ((a - 90) * Math.PI) / 180;
    const tx = -Math.sin(rad);
    const ty = Math.cos(rad);
    const rx = Math.cos(rad);
    const ry = Math.sin(rad);
    const [cx, cy] = P(80, a);
    const L = 6.2;
    const W = 4.6;
    const vx = cx - tx * L;
    const vy = cy - ty * L;
    const w1x = cx + tx * 1.5 + rx * W;
    const w1y = cy + ty * 1.5 + ry * W;
    const w2x = cx + tx * 1.5 - rx * W;
    const w2y = cy + ty * 1.5 - ry * W;
    line(ctx, w1x, w1y, vx, vy, 4.4);
    line(ctx, vx, vy, w2x, w2y, 4.4);
  }
  // THE HOMEWARD TURN: one bold road, bottom → right → top → down at the hearth's shoulder.
  strokePath(
    ctx,
    () => {
      const roadSteps = 90;
      for (let i = 0; i <= roadSteps; i++) {
        const t = i / roadSteps;
        const ang = 192 - t * 258;
        const r = 53 - 26 * t;
        const [x, y] = P(r, ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    },
    7,
  );
  // THE HEARTH-POINT: a roofline over the fire — the sign's one filled stroke.
  line(ctx, 101, 127, CX, 108, 7);
  line(ctx, CX, 108, 139, 127, 7);
  ctx.beginPath();
  ctx.arc(CX, 136, 5, 0, Math.PI * 2);
  ctx.fill();
  // THE CROWN above the hearth-point (the Home feature at the family's seat).
  roofline(ctx);
}

function hearthhomeSign(ctx: Ctx): void {
  // The ring — a FOUR-SIDED SEAL: the house's own walls.
  strokePath(
    ctx,
    () => {
      ctx.rect(34, 34, 172, 172);
    },
    8,
  );
  // Post ticks marching the inner walls.
  for (const [x1, y1, x2, y2] of [
    [64, 46, 64, 34], [96, 46, 96, 34], [128, 46, 128, 34], [160, 46, 160, 34],
    [64, 206, 64, 194], [96, 206, 96, 194], [128, 206, 128, 194], [160, 206, 160, 194],
    [46, 64, 34, 64], [46, 96, 34, 96], [46, 128, 34, 128], [46, 160, 34, 160],
    [206, 64, 194, 64], [206, 96, 194, 96], [206, 128, 194, 128], [206, 160, 194, 160],
  ] as const) {
    line(ctx, x1, y1, x2, y2, 5);
  }
  // The crown, worn LARGEST — it is this sign's own centre.
  roofline(ctx);
  // THE HOUSE: two posts and the ground it stands on.
  line(ctx, 101, 96, 101, 152, 7);
  line(ctx, 139, 96, 139, 152, 7);
  line(ctx, 84, 152, 156, 152, 7);
  // THE DOOR at the ground's centre — the seat of the Refusing.
  line(ctx, CX - 7, 152, CX - 7, 124, 5.5);
  line(ctx, CX + 7, 124, CX + 7, 152, 5.5);
  line(ctx, CX - 7, 124, CX + 7, 124, 5.5);
}

function hedgeSign(ctx: Ctx): void {
  // The ring — A LIVING THICKET: rooted stems leaning into their neighbours.
  for (let k = 0; k < 20; k++) {
    const a = 6 + k * 18;
    const [x1, y1] = P(88, a);
    const [x2, y2] = P(103, a + 7);
    line(ctx, x1, y1, x2, y2, 6);
  }
  // Leaf ticks: branching pairs off the stems' outer edge.
  for (let k = 0; k < 12; k++) {
    const a = 18 + k * 30;
    const [bx, by] = P(106, a);
    for (const da of [-11, 11]) {
      const [x2, y2] = P(115, a + da);
      line(ctx, bx, by, x2, y2, 4);
    }
  }
  // The crown at the thicket's heart.
  roofline(ctx);
  // THE MOTHER SHRUB: one bold forked stem on the ground line.
  line(ctx, CX, 96, CX, 152, 7);
  line(ctx, CX, 118, 102, 100, 6);
  line(ctx, CX, 118, 138, 100, 6);
  line(ctx, 88, 152, 152, 152, 7);
}

const SIGNS: Readonly<Record<string, (ctx: Ctx) => void>> = {
  travel: movementSign,
  naming: namingSign,
  returning: returningSign,
  hearthhome: hearthhomeSign,
  hedge: hedgeSign,
};

// ---------------------------------------------------------------------------
// The portion clips (the lab's wedges, carried over)
// ---------------------------------------------------------------------------

/** The round signs' wedge: a clock slice from the top, sweeping clockwise. */
function wedgeClip(ctx: Ctx, startHour: number, lengthHours: number): void {
  const fromDeg = startHour * 30;
  const sweep = lengthHours * 30;
  const [x1, y1] = P(150, fromDeg);
  ctx.beginPath();
  ctx.moveTo(CX, CY);
  ctx.lineTo(x1, y1);
  ctx.arc(CX, CY, 150, ((fromDeg - 90) * Math.PI) / 180, ((fromDeg + sweep - 90) * Math.PI) / 180, false);
  ctx.closePath();
  ctx.clip();
}

/**
 * HearthHome's portion in the square's own terms (the lab's
 * squareWedgePath, generalized to a dealt start): a contiguous
 * stretch of the PERIMETER measured from the top-centre of
 * the top wall, sweeping clockwise, widened inward into a
 * band along the walls. Walks are measured in HOURS around
 * the perimeter — 12 hours = the full perimeter (688 units),
 * so one hour = 57⅓ units. The clip stacks one quad per
 * walk step (see the ribbon note at its foot) — the caller
 * clips this whole band under ONE save/restore per run.
 */
function squareBandClip(ctx: Ctx, startHour: number, lengthHours: number): void {
  const per = 172 * 4;
  const perHour = per / 12;
  // The perimeter as a closed loop of waypoints, starting at
  // the top-centre of the top wall and sweeping clockwise;
  // the loop closes back on its start.
  const loop: ReadonlyArray<readonly [number, number]> = [
    [120, 34], [206, 34], [206, 206], [34, 206], [34, 34], [120, 34],
  ];
  /** The point `units` along the loop from its start (wraps). */
  const pointAt = (units: number): [number, number] => {
    let left = ((units % per) + per) % per;
    for (let i = 0; i + 1 < loop.length; i++) {
      const [x1, y1] = loop[i];
      const [x2, y2] = loop[i + 1];
      const d = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      if (left <= d) {
        return [x1 + Math.sign(x2 - x1) * left, y1 + Math.sign(y2 - y1) * left];
      }
      left -= d;
    }
    return [120, 34];
  };
  /** The walk's polyline: start point, every corner passed, end point. */
  const walkPoints = (fromUnits: number, walkUnits: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [pointAt(fromUnits)];
    let acc = 0;
    for (let i = 0; i + 1 < loop.length; i++) {
      const d = Math.abs(loop[i + 1][0] - loop[i][0]) + Math.abs(loop[i + 1][1] - loop[i][1]);
      const cornerAt = acc + d;
      // Corners strictly inside this lap's walk window.
      for (let lapStart = 0; lapStart <= walkUnits + fromUnits; lapStart += per) {
        const at = lapStart + cornerAt;
        if (at > fromUnits && at < fromUnits + walkUnits) {
          pts.push([loop[i + 1][0], loop[i + 1][1]]);
        }
      }
      acc = cornerAt;
    }
    pts.push(pointAt(fromUnits + walkUnits));
    return pts;
  };
  const pts = walkPoints(startHour * perHour, lengthHours * perHour);
  if (pts.length < 2) return;
  const inward = ([px, py]: [number, number]): [number, number] => {
    const dx = 120 - px;
    const dy = 120 - py;
    const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    return [px + (dx / m) * 80, py + (dy / m) * 80];
  };
  // THE BAND AS ONE PATH — with NONZERO winding, read
  // plainly: the polygon runs out along the wall and back
  // along the inward twins. Where a long walk bends past
  // the square's middle, the inward offsets cross the
  // centre and the polygon's returning leg retraces
  // ground — under the nonzero rule those retraced lobes
  // wind AGAINST the out-leg and cancel (the lab's SVG
  // clip, an even-odd shape, keeps them; canvas's default
  // rule drops them — a long walk painted nothing until
  // this band was cut as ONE STEP PER CLIP). Each step of
  // the walk clips as its own quad — wall point to wall
  // point, back through their own inward twins, out and
  // back (a twin pairs with its OWN point, never a
  // neighbour's, so offsets can't swap sides mid-step).
  // The quads tile the same band the lab's polygon
  // bounds; stepped, no lobe can ever cancel.
  ctx.beginPath();
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ai = inward(a);
    const bi = inward(b);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(bi[0], bi[1]);
    ctx.lineTo(ai[0], ai[1]);
    ctx.closePath();
  }
  ctx.clip();
}

// ---------------------------------------------------------------------------
// drawSign — the one entry point
// ---------------------------------------------------------------------------

/**
 * Draw `mark`'s sign into `ctx`: the union of `sectors`
 * SOLID in `style.ink`, the rest of the sign FADED
 * behind it. An empty sector list draws the whole sign
 * faded (a mark begun, nothing yet kept); a list
 * covering all 12 hours draws it whole and solid.
 * Uncut/unknown marks draw nothing.
 *
 * The context is expected to carry the caller's own
 * transform (scale/translate); the sign's box is the
 * 240 square centred (120, 120), strokes included.
 */
export function drawSign(
  ctx: CanvasRenderingContext2D,
  mark: string,
  sectors: readonly SignSector[],
  style: SignArtStyle,
): void {
  const sign = SIGNS[mark];
  if (!sign) return;
  const ghostAlpha = style.ghostAlpha ?? 0.07;
  const ghostColour = style.ghost ?? style.ink;
  const covered = new Array<boolean>(12).fill(false);
  for (const sector of sectors) {
    const start = ((Math.floor(sector.startHour) % 12) + 12) % 12;
    const length = Math.max(0, Math.min(12, Math.floor(sector.lengthHours)));
    for (let i = 0; i < length; i++) covered[(start + i) % 12] = true;
  }
  const full = covered.every(Boolean);
  const paint = (colour: string, alpha: number): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    sign(ctx);
    ctx.restore();
  };
  if (full) {
    paint(style.ink, 1);
    return;
  }
  // The faded rest first, the solid sector over it.
  paint(ghostColour, ghostAlpha);
  if (sectors.length === 0) return;
  // EACH SECTOR PAINTS UNDER ITS OWN SAVE/RESTORE: canvas
  // clips INTERSECT — left stacked, sector two's clip would
  // narrow sector one's paint to their overlap, and the
  // union would draw as an intersection (the round signs'
  // first sheet showed exactly that failure; the square's
  // band quads stack the same way, so no clip may outlive
  // its own sector's paint).
  const paintSector = (clip: () => void): void => {
    ctx.save();
    clip();
    paint(style.ink, 1);
    ctx.restore();
  };
  if (mark === 'hearthhome') {
    // The square's portions are perimeter walks: merge
    // contiguous covered hours into runs first.
    const runs: Array<{ start: number; length: number }> = [];
    for (let h = 0; h < 12; h++) {
      if (!covered[h]) continue;
      const prev = runs[runs.length - 1];
      if (prev && prev.start + prev.length === h) prev.length += 1;
      else runs.push({ start: h, length: 1 });
    }
    // A run wrapping past hour 11 into hour 0 stays two
    // walks (the perimeter walk wraps itself).
    for (const run of runs) {
      paintSector(() => squareBandClip(ctx, run.start, run.length));
    }
  } else {
    for (const sector of sectors) {
      const start = ((Math.floor(sector.startHour) % 12) + 12) % 12;
      const length = Math.max(0, Math.min(12, Math.floor(sector.lengthHours)));
      if (length > 0) paintSector(() => wedgeClip(ctx, start, length));
    }
  }
}
