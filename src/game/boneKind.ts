/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WORLD-BONE KINDS (Adam 2026-10-28 — individual bones in
 * the world, pickupable, each carrying its KIND). Kind-
 * tagged, NOT 18 scatter kinds (DEV-approved claim): one
 * 'bone' scatter kind, and each instance's kind derives
 * deterministically from its position — same seed +
 * position always gives the same kind, with no rand-stream
 * consumption (no chunk re-rolls) and no stored tag.
 * (Bones don't grow back — Adam, 2026-10-29: a harvested
 * scatter is removed permanently, so the determinism now
 * serves worldgen alone: a never-touched scatter's kind
 * is fixed by its position.)
 *
 * LIST AUTHORITY: BONE_KINDS mirrors Systems' RITUAL_
 * RECIPES keys in src/systems/rituals.ts (the determined
 * tier-1 Waking set). Game never imports systems (layer
 * rule), so the list is mirrored here with that comment
 * as its provenance — and the probe asserts the mirror
 * matches rituals.ts text, so drift is caught, not silent.
 * SHREW EXCLUDED (flagged): shrew skull is outright
 * (first-boot grant) and a found shrew skull's stacking
 * is TBD per the ritual doc — including it would invent
 * stacking semantics. If DEV ever wants 18, it is a
 * one-list change here + the probe's expectation.
 *
 * SHELL INSTRUCTION (for the grant path, DEV-sequenced):
 * resolve the kind from the HARVEST PAYLOAD position
 * (harvest:completed x/z — the target's position), never
 * from the player's position: two nearby bones differ by
 * position, and only the payload position names the bone
 * that was picked up.
 */

import { deriveSeed } from './seed';

/**
 * The 17 tier-1 Waking bone kinds, in RITUAL_RECIPES order
 * (day, night, twilight, moon, independent). Mirror of
 * Systems' list — see header. Shrew skull absent
 * deliberately (outright, no ritual).
 */
export const BONE_KINDS: readonly string[] = [
  // DAY (sun).
  'pigeon-wing-bone',
  'snake-vertebra',
  'turtle-shell-fragment',
  'crow-beak',
  // NIGHT.
  'owl-talon',
  'bat-wing-bone',
  'mouse-spine',
  'raccoon-tooth',
  'groundhog-tooth',
  // TWILIGHT.
  'fox-femur',
  'deer-antler-tip',
  // MOON PHASE.
  'wolf-tooth',
  // SKY-INDEPENDENT.
  'frog-pelvis',
  'mole-paw',
  'bear-claw',
  'rabbit-jaw',
  'beaver-incisor',
];

/**
 * The bone kind lying at (x, z) in world `seed`: FNV-1a
 * position hash → one of BONE_KINDS. Deterministic,
 * uniform enough across positions (probed). Position is
 * the whole identity (bones don't regrow — Adam,
 * 2026-10-29 — so no regrow stability is needed).
 */
export function boneKindAt(seed: string, x: number, z: number): string {
  const h = deriveSeed(String(seed), `bone:${x.toFixed(2)},${z.toFixed(2)}`);
  return BONE_KINDS[((h % BONE_KINDS.length) + BONE_KINDS.length) % BONE_KINDS.length];
}

/**
 * Systems' item-id mapping rule, mirrored (documented in
 * rituals.ts): a bone kind's carried item id. The shell
 * grants yields items, so a bone yield awaits Systems'
 * primal-bone-<kind> ids for grant/display — the string
 * is emitted regardless (DEV sequencing: pickup goes live
 * once both halves land).
 */
export function boneItemId(boneKind: string): string {
  return `primal-bone-${boneKind}`;
}
