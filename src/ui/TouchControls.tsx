/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — touch controls (UI lane, presentation +
 * gesture state only).
 *
 * Four pieces, all visible before first use (Adam's phone rule,
 * BioForge 2026-10-14: invisible-until-touched controls are not
 * acceptable):
 * - Left thumbstick: a solid MOVE ring + knob that pulses until
 *   the first stick use, then goes static and drops the label.
 *   The ring and knob stay — they are the control, not a cue.
 * - Right-side drag-look field with a DRAG TO LOOK cue ring at
 *   right-thumb height, shown until the first real look drag,
 *   then retired. The caller may hide the whole field
 *   (lookEnabled); the shell leaves it enabled in both modes
 *   because the engine applies look deltas gateless and keeps
 *   pitch consistent across mode switches.
 * - Right thumbstick: a solid TURN ring + knob even with MOVE
 *   on the bottom row (USE to its left), same size and
 *   pulse-until-first-use pattern as MOVE.
 *   It reports a deflection, not a drag: the shell holds the
 *   deflection and turns continuously while it is held, so a
 *   big turn needs no re-sliding. Added 2026-10-26 after
 *   Adam's playtest found drag-look's travel too short: a
 *   thumb resting near the right edge has only ~half an inch
 *   of right travel, and a center-started drag misses or clips
 *   the right-half look field. The stick is bounded by its own
 *   radius, not by the screen edge.
 * - USE button, centred on the bottom row between the sticks,
 *   thumb-sized (64 px), its centre on the sticks' axis —
 *   symmetrical with MOVE and TURN (19 px clear each side at
 *   390 px), not hugging one stick. When the shell passes
 *   interactLabel, the button shows that label instead of
 *   "USE" (a dropped pile about to be picked up reads
 *   "PICK UP").
 * - JUMP button, same family, stacked above USE on the
 *   centre axis (2026-10-29, Adam's sprint/jump order):
 *   the touch half of Space. No touch sprint button —
 *   sprint on touch is the MOVE stick's double-push
 *   (Background's movement path).
 *
 * GESTURE OWNERSHIP (BioForge v1 lesson, required): a look-drag
 * NEVER fires interact on release. Only two gestures interact:
 * a short still tap on the look field (under 400 ms, under 12 px
 * of travel) or a USE press. A drag that moves past the tap
 * threshold is look only, whatever happens on release.
 *
 * NO SPRINT, NO JUMP: Silent Earth movement is walk only
 * (slowed by hunger/bog). The stick reports a walk vector; it
 * never reports a run or a jump. Multi-touch is tracked by
 * touch identifier, so move stick, turn stick, and look work
 * simultaneously, each under its own touch.
 *
 * No game logic lives here: vectors and interactions are
 * reported through callbacks, and the shell decides what they
 * do (move/look bridges, nearest-target interact).
 */

import { useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';

export interface TouchControlsProps {
  /** Stick vector: x = right positive, y = forward positive, each -1..1. */
  onMove?: (x: number, y: number) => void;
  /** Turn-stick deflection: x = right positive, y = up positive, each -1..1. */
  onTurn?: (x: number, y: number) => void;
  /** Look deltas in CSS pixels (same scale the shell's mouse look uses). */
  onLook?: (dx: number, dy: number) => void;
  /** USE press, or a short still tap on the look field. */
  onInteract?: () => void;
  /** JUMP press (the touch half of Space; added 2026-10-29
    with Background's pressJump seam). */
  onJump?: () => void;
  /** When set, the USE button shows this label instead of "USE"
    (the shell sets it when a dropped pile would win the press). */
  interactLabel?: string;
  /** False hides the look field entirely (third-person has no look). */
  lookEnabled?: boolean;
}

/** Knob travel in px from the ring centre. */
const STICK_TRAVEL = 40;
/** Stick dead zone (engine expects it in this gesture layer). */
const STICK_DEAD_ZONE = 0.25;
/** A tap is short and still: under this duration and travel. */
const TAP_MAX_MS = 400;
const TAP_MAX_MOVE = 12;

export function TouchControls({
  onMove,
  onTurn,
  onLook,
  onInteract,
  interactLabel,
  onJump,
  lookEnabled = true,
}: TouchControlsProps) {
  const [stickUsed, setStickUsed] = useState(false);
  const [turnUsed, setTurnUsed] = useState(false);
  const [lookUsed, setLookUsed] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [turnKnob, setTurnKnob] = useState({ x: 0, y: 0 });

  const stickTouchId = useRef<number | null>(null);
  const stickCenter = useRef({ x: 0, y: 0 });
  const turnTouchId = useRef<number | null>(null);
  const turnCenter = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const lookStart = useRef({ x: 0, y: 0, time: 0, maxMove: 0 });

  const updateStick = (clientX: number, clientY: number): void => {
    let vx = (clientX - stickCenter.current.x) / STICK_TRAVEL;
    let vy = (stickCenter.current.y - clientY) / STICK_TRAVEL;
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    // Dead zone: a nudge inside it reports no movement at all
    // (and the knob stays centred) rather than a creeping walk.
    if (len < STICK_DEAD_ZONE) {
      vx = 0;
      vy = 0;
    }
    setKnob({ x: vx * STICK_TRAVEL, y: -vy * STICK_TRAVEL });
    onMove?.(vx, vy);
  };

  const handleStickStart = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (stickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    stickTouchId.current = touch.identifier;
    stickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setStickUsed(true);
    updateStick(touch.clientX, touch.clientY);
  };

  const handleStickMove = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (stickTouchId.current === null) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      const touch = e.changedTouches[i];
      if (touch.identifier === stickTouchId.current) {
        updateStick(touch.clientX, touch.clientY);
      }
    }
  };

  const handleStickEnd = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (stickTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      if (e.changedTouches[i].identifier === stickTouchId.current) {
        stickTouchId.current = null;
        setKnob({ x: 0, y: 0 });
        onMove?.(0, 0);
      }
    }
  };

  // Turn stick: the move stick's math and touch-id pattern,
  // reporting a deflection the shell holds (see the header).
  // Same travel, same dead zone, same knob behaviour.
  const updateTurn = (clientX: number, clientY: number): void => {
    let vx = (clientX - turnCenter.current.x) / STICK_TRAVEL;
    let vy = (turnCenter.current.y - clientY) / STICK_TRAVEL;
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    if (len < STICK_DEAD_ZONE) {
      vx = 0;
      vy = 0;
    }
    setTurnKnob({ x: vx * STICK_TRAVEL, y: -vy * STICK_TRAVEL });
    onTurn?.(vx, vy);
  };

  const handleTurnStart = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (turnTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    turnTouchId.current = touch.identifier;
    turnCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setTurnUsed(true);
    updateTurn(touch.clientX, touch.clientY);
  };

  const handleTurnMove = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (turnTouchId.current === null) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      const touch = e.changedTouches[i];
      if (touch.identifier === turnTouchId.current) {
        updateTurn(touch.clientX, touch.clientY);
      }
    }
  };

  const handleTurnEnd = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (turnTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      if (e.changedTouches[i].identifier === turnTouchId.current) {
        turnTouchId.current = null;
        setTurnKnob({ x: 0, y: 0 });
        onTurn?.(0, 0);
      }
    }
  };

  const handleLookStart = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lookLast.current = { x: touch.clientX, y: touch.clientY };
    lookStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      maxMove: 0,
    };
  };

  const handleLookMove = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (lookTouchId.current === null) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== lookTouchId.current) continue;
      const dx = touch.clientX - lookLast.current.x;
      const dy = touch.clientY - lookLast.current.y;
      lookLast.current = { x: touch.clientX, y: touch.clientY };
      const moved = Math.hypot(
        touch.clientX - lookStart.current.x,
        touch.clientY - lookStart.current.y,
      );
      lookStart.current.maxMove = Math.max(
        lookStart.current.maxMove,
        moved,
      );
      // Past the tap threshold this is a look drag, not a tap:
      // the cue retires, and nothing will fire on release.
      if (lookStart.current.maxMove > TAP_MAX_MOVE) {
        setLookUsed(true);
      }
      onLook?.(dx, dy);
    }
  };

  const handleLookEnd = (e: ReactTouchEvent<HTMLDivElement>): void => {
    if (lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      if (e.changedTouches[i].identifier !== lookTouchId.current) continue;
      const held = performance.now() - lookStart.current.time;
      const still = lookStart.current.maxMove <= TAP_MAX_MOVE;
      lookTouchId.current = null;
      // Gesture ownership: only a short still tap interacts.
      // A look drag fires nothing on release, ever.
      if (held <= TAP_MAX_MS && still) {
        onInteract?.();
      }
    }
  };

  const handleLookCancel = (e: ReactTouchEvent<HTMLDivElement>): void => {
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 select-none"
      aria-label="Touch controls"
    >
      {lookEnabled ? (
        <div
          className="pointer-events-auto absolute inset-y-0 right-0 w-1/2 touch-none"
          onTouchStart={handleLookStart}
          onTouchMove={handleLookMove}
          onTouchEnd={handleLookEnd}
          onTouchCancel={handleLookCancel}
        >
          {!lookUsed ? (
            <div className="pointer-events-none absolute right-8 top-1/3 flex flex-col items-center gap-1 opacity-80">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#f0ead6]/70 bg-black/30 text-xs text-[#f0ead6]">
                LOOK
              </div>
              <span className="text-xs tracking-widest text-[#f0ead6]">
                DRAG TO LOOK
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="pointer-events-auto absolute bottom-24 left-4 touch-none"
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
        onTouchCancel={handleStickEnd}
      >
        <div
          className={
            'relative flex h-32 w-32 items-center justify-center rounded-full border-2 bg-black/30 ' +
            (stickUsed
              ? 'border-[#f0ead6]/50'
              : 'border-[#f0ead6]/80 animate-pulse')
          }
        >
          {!stickUsed ? (
            <span className="absolute -top-6 text-xs tracking-widest text-[#f0ead6]">
              MOVE
            </span>
          ) : null}
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-[#f0ead6]/90 shadow"
            style={{
              transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
            }}
          />
        </div>
      </div>

      {/* Turn stick: rendered after the look field so its
        touches land on the stick, not the field beneath it
        (same DOM-order rule as the USE button). Level with
        MOVE on the bottom row (Adam 2026-10-26: the stacked
        look was weird) — USE sits centred between the sticks
        on the same axis, clear of the DRAG TO LOOK cue. */}
      <div
        className="pointer-events-auto absolute bottom-24 right-4 touch-none"
        onTouchStart={handleTurnStart}
        onTouchMove={handleTurnMove}
        onTouchEnd={handleTurnEnd}
        onTouchCancel={handleTurnEnd}
      >
        <div
          className={
            'relative flex h-32 w-32 items-center justify-center rounded-full border-2 bg-black/30 ' +
            (turnUsed
              ? 'border-[#f0ead6]/50'
              : 'border-[#f0ead6]/80 animate-pulse')
          }
        >
          {!turnUsed ? (
            <span className="absolute -top-6 text-xs tracking-widest text-[#f0ead6]">
              TURN
            </span>
          ) : null}
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-[#f0ead6]/90 shadow"
            style={{
              transform: `translate(calc(-50% + ${turnKnob.x}px), calc(-50% + ${turnKnob.y}px))`,
            }}
          />
        </div>
      </div>

      {/* USE: centred between MOVE and TURN (left-1/2 +
        -translate-x-1/2), its vertical centre on the sticks'
        axis (bottom-32 lifts the 64 px button so its centre
        meets the 128 px rings' centre, 160 px off the
        bottom). At 390 px: MOVE [16, 144], USE [163, 227],
        TURN [246, 374] — 19 px clear each side, no overlap;
        the centred button straddles the look field's edge
        but renders after it, so its touches land on the
        button (same DOM-order rule as the sticks). */}
      <button
        type="button"
        aria-label={
          interactLabel ??
          'Use: interact with the nearest in-range target'
        }
        className="pointer-events-auto absolute bottom-32 left-1/2 flex h-16 w-16 -translate-x-1/2 touch-none items-center justify-center whitespace-nowrap rounded-full border-2 border-[#f0ead6]/80 bg-moss-deep/90 text-sm font-bold text-[#f0ead6]"
        onTouchStart={(e) => {
          e.preventDefault();
          onInteract?.();
        }}
      >
        {interactLabel ?? 'USE'}
      </button>

      {/* JUMP: same button family as USE, stacked directly
        above it on the centre axis (bottom-56: USE spans
        128-192 px off the bottom, JUMP spans 224-288 —
        32 px clear). Added 2026-10-29 with Adam's
        sprint/jump order; the shell wires it to the
        player's pressJump (mid-air presses no-op there).
        Renders after USE (same DOM-order rule), and there
        is no touch sprint button: the stick double-push
        is Background's movement path. */}
      <button
        type="button"
        aria-label="Jump"
        className="pointer-events-auto absolute bottom-56 left-1/2 flex h-16 w-16 -translate-x-1/2 touch-none items-center justify-center whitespace-nowrap rounded-full border-2 border-[#f0ead6]/80 bg-moss-deep/90 text-sm font-bold text-[#f0ead6]"
        onTouchStart={(e) => {
          e.preventDefault();
          onJump?.();
        }}
      >
        JUMP
      </button>
    </div>
  );
}
