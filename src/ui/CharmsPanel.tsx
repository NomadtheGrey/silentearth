// CharmsPanel — the charm-list examination panel (UI lane,
// charm-list build 2026-10-28, Systems 9e9a9dd).
//
// Props-driven presentation only: the caller (App) maps
// Systems' listCharms view to plain display rows; nothing
// here imports game, engine, or systems code, and nothing
// here owns state — selection lives on the caller, like
// InventoryPanel's selectedItemId.
//
// The list holds awakened kinds ONLY (listCharms contract):
// raw bones stay in main inventory until awakened. Rows
// show the display name + tier; tapping a row shows its
// detail (name, tier, note) below the list. The note is
// Systems' awakened-branch line (boneNote) — this panel
// invents no effect text; a kind without supplied text
// still shows its tier line (listCharms' contract).

import { UI_THEMES, type UiThemeName } from './themes';
import { VineDivider } from './WitchyArt';

/** One row of the examination list — App's mapping of a ListedCharm. */
export interface CharmListRow {
  /** Bone kind (shape slug, e.g. 'shrew-skull'). */
  kind: string;
  /** Display name, e.g. 'Primal Bone - shrew skull'. */
  display: string;
  /** Tier held (≥ 1). */
  tier: number;
  /** Display line, e.g. 'Tier 1 · Stirs at hunger 45'. */
  note: string;
}

export interface CharmsPanelProps {
  /** Awakened charms in awakening order (listCharms view, App-mapped). */
  charms: CharmListRow[];
  /** Kind whose detail is shown. Null = nothing selected. */
  selectedKind: string | null;
  /** Called when the player taps a charm row. */
  onSelectKind: (kind: string) => void;
  /** Called when the panel is closed. Optional. */
  onClose?: () => void;
  /** Thumb-sized action buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire" (gathering / the world outside). */
  theme?: UiThemeName;
}

export function CharmsPanel({
  charms,
  selectedKind,
  onSelectKind,
  onClose,
  comfortable = false,
  theme = 'mire',
}: CharmsPanelProps) {
  const t = UI_THEMES[theme];
  const rowBtn = comfortable
    ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] w-full text-left hover:bg-moss'
    : 'rounded bg-moss-deep px-2 py-1 text-xs w-full text-left hover:bg-moss';
  const closeBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
    : 'rounded px-2 py-1 text-sm ' + t.button;
  const selected =
    selectedKind === null
      ? undefined
      : charms.find((charm) => charm.kind === selectedKind);
  return (
    <section aria-label="Charms" className={'rounded-2xl p-3 ' + t.panel}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className={'text-base font-semibold ' + t.heading}>Charms</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close charms"
            className={closeBtn}
          >
            Close [X]
          </button>
        ) : null}
      </div>
      <VineDivider className="mb-2" />
      <p className={'mb-2 text-sm ' + t.muted}>
        Awakened charms live here, not in the pack. They weigh nothing, and
        their effects are always on.
      </p>

      {charms.length === 0 ? (
        <p className={'italic ' + t.muted}>No charms awakened yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {charms.map((charm) => {
            const isSelected = charm.kind === selectedKind;
            return (
              <li key={charm.kind}>
                <button
                  type="button"
                  onClick={() => onSelectKind(charm.kind)}
                  aria-pressed={isSelected}
                  className={rowBtn}
                >
                  {charm.display} · Tier {charm.tier}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <div className="mt-3 border-t border-stone-700 pt-2">
          <p className={'text-base font-semibold ' + t.heading}>
            {selected.display}
          </p>
          <p className={'mt-1 text-sm ' + t.muted}>Tier {selected.tier}</p>
          <p className="mt-1 text-sm text-stone-200">{selected.note}</p>
        </div>
      ) : null}
    </section>
  );
}
