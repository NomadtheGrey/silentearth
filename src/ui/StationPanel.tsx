/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — station panel (UI lane, presentation only).
 *
 * The panel that appears when she is AT a station — a tree stump,
 * a workstation, a Stumpy — listing what she can do there. It is
 * a capability list, not a fixed menu: the caller passes the
 * station kind and the actions available there, and the panel
 * renders one button per action. Later actions join as further
 * entries in the same list, without restructuring.
 *
 * STATION UI V1 (Adam, 2026-10-26): exactly one action — Craft,
 * which opens the crafting menu. Move is NOT built here: it
 * joins later, when she has the right tool (the Trundle-Tool /
 * dolly, the tool that moves stations), and this landing does
 * not gate on tools she does not have yet. No disabled Move
 * entry, no placeholder — one action means one button.
 *
 * TRIGGER: presence, not USE. The caller renders this panel
 * when station presence says she is at one (stump in range =
 * workstation today) and hides it when she walks away. Harvest
 * USE is never involved, so it cannot swallow a harvest press
 * — the panel and the USE button live on separate paths.
 *
 * KIND NAMES, AS PRESENCE ALLOWS: presence today is booleans
 * only (workstation / loom), and workstation presence comes
 * solely from stumps (felled or world-grown, within range) —
 * so 'stump' is the only kind reachable now, and the shell
 * passes it. The full kind map (stump / workstation / Stumpy)
 * is here so that when presence learns kinds, the title
 * follows from a prop change, not a rewrite. The panel itself
 * never guesses a kind from a boolean.
 *
 * CRAFT AND "THAT STATION ACTIVE": the Craft action opens the
 * crafting menu; the menu itself is already station-aware
 * (craftability ORs over every present station), so opening it
 * at a stump IS opening it with the stump active. This panel
 * adds no filtering — it does not hide loom or hand recipes
 * at a stump — and it owns no crafting state of its own.
 */

import { UI_THEMES, type UiThemeName } from './themes';

/** Kind of station the panel names. Only 'stump' is reachable today. */
export type StationKind = 'stump' | 'workstation' | 'stumpy';

const STATION_KIND_NAMES: Record<StationKind, string> = {
  stump: 'Tree stump',
  workstation: 'Workstation',
  stumpy: 'Stumpy',
};

/** One thing she can do at this station. Later actions join this list. */
export interface StationAction {
  /** Stable id for the action (e.g. 'craft'). */
  id: string;
  /** Button label (e.g. 'Craft'). */
  label: string;
  /** Called when the action button is pressed. */
  onSelect: () => void;
}

export interface StationPanelProps {
  /** Kind of station she is at; drives the panel title only. */
  stationKind: StationKind;
  /** Actions available here. V1: exactly one (Craft). */
  actions: StationAction[];
  /** Thumb-sized targets. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function StationPanel({
  stationKind,
  actions,
  comfortable = false,
  theme = 'mire',
}: StationPanelProps) {
  const t = UI_THEMES[theme];
  const name = STATION_KIND_NAMES[stationKind];
  const actionBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.primary
    : 'rounded px-3 py-1 text-sm ' + t.primary;
  return (
    <section aria-label={`Station: ${name}`} className={'rounded-2xl p-3 ' + t.panel}>
      <h2 className="font-medium">{name}</h2>
      <div className="mt-2 flex flex-col gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onSelect}
            aria-label={`${action.label} at the ${name}`}
            className={actionBtn}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
