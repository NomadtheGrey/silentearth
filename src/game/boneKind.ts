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
 * SHREW JOINS (Adam, 2026-11-01: 'The shrew bone should
 * be like any other.'): the retired first-boot grant was
 * the shrew skull's only source, so the shrew takes its
 * seat in this cycle like every other kind — appended
 * LAST, after the Waking order, because its charm is
 * outright (no ritual recipe: the mirror below carries
 * this one named exception). The modulo change (21 → 22)
 * re-deals ~95% of standing bone spots to different
 * kinds (measured over three worlds before the ruling;
 * the ruling accepts the re-deal class in advance).
 * A found shrew skull's staging still refuses (Systems'
 * stageBone) — its road is the charm path, as before.
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
 * The 21 tier-1 Waking bone kinds, in RITUAL_RECIPES order
 * (day, night, twilight, moon, independent), plus the
 * shrew appended last (Adam, 2026-11-01 — see header).
 * Mirror of Systems' list with that one named exception.
 * Muskrat, opossum, vole, and squirrel joined 2026-10-31
 * (Systems' registry first, this mirror second — the
 * bones-for-the-boneless build).
 */
export const BONE_KINDS: readonly string[] = [
  // DAY (sun).
  'pigeon-wing-bone',
  'snake-vertebra',
  'turtle-shell-fragment',
  'crow-beak',
  'squirrel-tail-bone',
  // NIGHT.
  'owl-talon',
  'bat-wing-bone',
  'mouse-spine',
  'raccoon-tooth',
  'groundhog-tooth',
  'opossum-crest',
  // TWILIGHT.
  'fox-femur',
  'deer-antler-tip',
  'muskrat-tail',
  // MOON PHASE.
  'wolf-tooth',
  // SKY-INDEPENDENT.
  'frog-pelvis',
  'mole-paw',
  'bear-claw',
  'rabbit-jaw',
  'beaver-incisor',
  'vole-skull',
  // THE GIVEN ONE (Adam, 2026-11-01): no Waking recipe —
  // its charm is outright — but its bone lies in the
  // world like any other.
  'shrew-skull',
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
