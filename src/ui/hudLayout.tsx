/**
 * HUD LAYOUT (Adam, 2026-11-02 — his SE Notes plus his
 * hand-drawn, color-coded diagram): the HUD's elements
 * get NEW DEFAULT SEATS that clear the center of the
 * screen — on desktop the location chip, the status
 * bars, and the quest card stand in a right-hand
 * column; health, the SILENT EARTH readout, the
 * controls, and the wardrobe stand up the left — and
 * every element is MOVEABLE and CLOSABLE from there:
 *
 * - Each element carries a small grip (drag to move,
 *   free-pointer, clamped to the viewport) and an [X]
 *   (hide; the Options HUD tab brings it back).
 * - Offsets and hidden flags persist per pointer class
 *   (localStorage 'silent-earth-hud-layout', 'fine' and
 *   'coarse' stored apart) — a dragged desktop layout
 *   never disturbs the phone's, and the save file is
 *   never touched: this is the device's furniture, not
 *   the world's.
 * - The Options HUD tab lists every element with a
 *   show/hide switch and a reset for the layout in use.
 *
 * Default seats are the callers' business (App seats
 * the elements); this module owns only the per-element
 * offset/hidden state and the drag/hide chrome.
 */

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

export type HudElementId =
  | 'chip'
  | 'health'
  | 'bars'
  | 'quest'
  | 'meta'
  | 'controls'
  | 'wardrobe';

export const HUD_ELEMENT_LABELS: Record<HudElementId, string> = {
  chip: 'Location chip',
  health: 'Health',
  bars: 'Status bars (hunger, cold, wet)',
  quest: 'Quest card',
  meta: 'Debug (SILENT EARTH)',
  controls: 'Controls',
  wardrobe: 'Wardrobe',
};

export interface HudSlot {
  dx: number;
  dy: number;
  hidden: boolean;
}

type HudSlotMap = Partial<Record<HudElementId, HudSlot>>;

interface HudLayoutStore {
  fine: HudSlotMap;
  coarse: HudSlotMap;
}

const STORAGE_KEY = 'silent-earth-hud-layout';
const DEFAULT_SLOT: HudSlot = { dx: 0, dy: 0, hidden: false };

function readStore(): HudLayoutStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<HudLayoutStore>;
      return {
        fine: parsed.fine ?? {},
        coarse: parsed.coarse ?? {},
      };
    }
  } catch {
    // Storage unavailable or corrupt: defaults stand.
  }
  return { fine: {}, coarse: {} };
}

export interface HudLayout {
  slot: (id: HudElementId) => HudSlot;
  move: (id: HudElementId, dx: number, dy: number) => void;
  setHidden: (id: HudElementId, hidden: boolean) => void;
  reset: () => void;
}

/** The layout state for one pointer class ('fine' = mouse, 'coarse' = touch). */
export function useHudLayout(kind: 'fine' | 'coarse'): HudLayout {
  const [store, setStore] = useState<HudLayoutStore>(readStore);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Best-effort: an unsaved layout is a nuisance, not an error.
    }
  }, [store]);

  const patch = (id: HudElementId, part: Partial<HudSlot>) =>
    setStore((s) => ({
      ...s,
      [kind]: {
        ...s[kind],
        [id]: { ...DEFAULT_SLOT, ...(s[kind][id] ?? {}), ...part },
      },
    }));

  return {
    slot: (id) => ({ ...DEFAULT_SLOT, ...(store[kind][id] ?? {}) }),
    move: (id, dx, dy) => patch(id, { dx, dy }),
    setHidden: (id, hidden) => patch(id, { hidden }),
    reset: () => setStore((s) => ({ ...s, [kind]: {} })),
  };
}

/**
 * One moveable, closable HUD element. The wrapper is a
 * plain relative block (the caller's seat decides the
 * flow); the offset is a transform, so dragging never
 * reflows its neighbours. The grip and the [X] float
 * at the element's top-right corner and add no layout
 * height — the seats were measured without them.
 */
export function HudElement(props: {
  hud: HudLayout;
  id: HudElementId;
  children: ReactNode;
  className?: string;
}) {
  const { hud, id } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const slot = hud.slot(id);
  if (slot.hidden) return null;

  const onGripDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    // The element's untransformed box: where it would
    // sit at offset (0,0). Offsets clamp so the whole
    // element stays inside the viewport.
    const baseLeft = rect.left - slot.dx;
    const baseTop = rect.top - slot.dy;
    const startX = e.clientX;
    const startY = e.clientY;
    const startDx = slot.dx;
    const startDy = slot.dy;
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      let dx = startDx + (ev.clientX - startX);
      let dy = startDy + (ev.clientY - startY);
      dx = Math.min(
        Math.max(dx, -baseLeft),
        window.innerWidth - (baseLeft + rect.width),
      );
      dy = Math.min(
        Math.max(dy, -baseTop),
        window.innerHeight - (baseTop + rect.height),
      );
      hud.move(id, Math.round(dx), Math.round(dy));
    };
    const onUp = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onUp);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
  };

  const label = HUD_ELEMENT_LABELS[id];
  return (
    <div
      ref={ref}
      className={'relative ' + (props.className ?? '')}
      style={{ transform: `translate(${slot.dx}px, ${slot.dy}px)` }}
    >
      <div className="pointer-events-auto absolute right-0 top-0 z-20 flex gap-1 opacity-60 hover:opacity-100">
        <button
          type="button"
          aria-label={`Move ${label}`}
          title="Drag to move"
          onPointerDown={onGripDown}
          className="cursor-grab touch-none rounded bg-black/45 px-1 text-[10px] leading-4 text-white/90"
        >
          ⠿
        </button>
        <button
          type="button"
          aria-label={`Hide ${label}`}
          title="Hide — Options, HUD tab, brings it back"
          onClick={() => hud.setHidden(id, true)}
          className="rounded bg-black/45 px-1 text-[10px] leading-4 text-white/90"
        >
          ✕
        </button>
      </div>
      {props.children}
    </div>
  );
}
