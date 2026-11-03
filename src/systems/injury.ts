/**
 * Injury (Systems, 2026-11-03 — the feral build's runway;
 * Adam's pins 2026-11-03, the finalized claim).
 *
 * THE MODEL: there is no health pool and no HP death.
 * A landed feral strike past the warning wounds her
 * ONE STAGE on a short ladder — sound / hurt / wounded
 * / critical — and at critical, one further landed
 * strike is the DOWN: she crawls back, narratively, to
 * her last encampment, missing stuff at random (the
 * crawl-back planning lives in crawl-back.ts). The
 * ladder is the whole runway; salves and rest walk it
 * back. The fairness machines (sight, telegraph, the
 * first-contact warning, escape, safe country, the
 * companion intercept) live in companions.ts — this
 * module is only the ladder and its facts.
 *
 * STAGE EFFECTS are capability prices, never a
 * countdown: slowed movement, a carrying cut, and at
 * critical a refusal of heavy work (the too-hungry
 * gate's shape). INJURY_EFFECTS is the one table;
 * Background and UI consume stage() and the table —
 * they do not duplicate this state.
 *
 * Every number is DRAFT for Adam's pin pass (the
 * narrative staging itself is delegated — Adam,
 * 2026-11-03: 'i trust you with the narrative
 * stages').
 */

import { ITEMS, type ItemId } from './recipes';
import type { PersonalInventory } from './inventory';

export type InjuryStage = 'sound' | 'hurt' | 'wounded' | 'critical';

export const INJURY_STAGES: readonly InjuryStage[] = [
  'sound',
  'hurt',
  'wounded',
  'critical',
];

export interface InjuryEffects {
  /** Movement speed multiplier while at this stage. */
  movementMultiplier: number;
  /** Carrying-capacity multiplier while at this stage. */
  carryMultiplier: number;
  /** Heavy work (harvest / build) refused at this stage. */
  workRefused: boolean;
}

/** DRAFT stage prices — one table, pin-pass editable. */
export const INJURY_EFFECTS: Readonly<Record<InjuryStage, InjuryEffects>> = {
  sound: { movementMultiplier: 1, carryMultiplier: 1, workRefused: false },
  hurt: { movementMultiplier: 0.9, carryMultiplier: 1, workRefused: false },
  wounded: { movementMultiplier: 0.75, carryMultiplier: 0.75, workRefused: false },
  critical: { movementMultiplier: 0.55, carryMultiplier: 0.5, workRefused: true },
};

export interface InjurySnapshot {
  stage: InjuryStage;
}

function stageIndex(stage: InjuryStage): number {
  return INJURY_STAGES.indexOf(stage);
}

export class InjuryState {
  private index = 0;

  stage(): InjuryStage {
    return INJURY_STAGES[this.index];
  }

  /** The gate query (the isCold / isTooHungry shape):
   * at critical, heavy work is refused. */
  isBadlyHurt(): boolean {
    return INJURY_EFFECTS[this.stage()].workRefused;
  }

  effects(): InjuryEffects {
    return INJURY_EFFECTS[this.stage()];
  }

  /**
   * A landed strike: wounds one stage — or, at
   * critical, IS the down (the stage stays critical;
   * the crawl-back and the waking are the shell's,
   * priced in crawl-back.ts). Returns what happened.
   */
  strike(): 'wounded' | 'down' {
    if (this.index >= INJURY_STAGES.length - 1) return 'down';
    this.index += 1;
    return 'wounded';
  }

  /** One stage eased (a salve's tending, or a full
   * sleep's rest). False when already sound. */
  ease(): boolean {
    if (this.index <= 0) return false;
    this.index -= 1;
    return true;
  }

  /** Waking from a crawl-back: hurt, never sound —
   * the crawl is the recovery's beginning, not its
   * end (the finalized claim's waking price). */
  wakeFromDown(): void {
    this.index = stageIndex('hurt');
  }

  snapshot(): InjurySnapshot {
    return { stage: this.stage() };
  }

  /** Lenient: an unknown stage reads as sound. */
  restore(snapshot: InjurySnapshot | null | undefined): void {
    if (snapshot && INJURY_STAGES.includes(snapshot.stage)) {
      this.index = stageIndex(snapshot.stage);
    } else {
      this.index = 0;
    }
  }
}

export type TendResult =
  | { ok: true }
  | { ok: false; code: 'not-hurt' | 'no-salve' };

export const SALVE_ITEM: ItemId = ITEMS.salve;

/**
 * Tend her hurt with a salve: consumes one salve and
 * eases one stage — the eat() posture (checks before
 * removing anything, so a refused tend costs nothing).
 * Never gated by stage: tending IS the recovery. The
 * exercised door for the item card rides the shell
 * (recordItemUse on a successful tend).
 */
export function tendWithSalve(
  inventory: PersonalInventory,
  injury: InjuryState,
): TendResult {
  if (injury.stage() === 'sound') return { ok: false, code: 'not-hurt' };
  if (inventory.count(SALVE_ITEM) <= 0) return { ok: false, code: 'no-salve' };
  inventory.remove(SALVE_ITEM, 1);
  injury.ease();
  return { ok: true };
}
