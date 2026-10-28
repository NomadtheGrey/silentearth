/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RITUAL-SITE STAGING STATE (Adam 2026-10-27 — tier-1
 * Waking processes, site side). Mirrors the altarState
 * pattern: a dependency-free singleton (imports only the
 * bus) that the renderer and the shell both read, so
 * neither imports the other for it.
 *
 * WHAT THIS HOLDS: what physically sits ON a ritual site
 * — one staged bone per site — and nothing else. The bone
 * is Systems' design key (an opaque string here, per the
 * ritual doc: boneKind design key, NOT an invented item
 * id). Offered flags (food offering, spoken name, extras,
 * substitutes) ride Systems' staging store, NOT this
 * record: Systems decides them, this state mirrors the
 * site. Completion timing (sky-window arrival) is
 * Systems' logic too — this module never reads the sky.
 *
 * SITE IDENTITY: a site is { kind, siteId, x, z }. Made
 * altar: siteId is the altarState id (altar:<n>), x/z the
 * altar position. Stump: NO stump ids exist in code
 * (FelledEntry is position-keyed) — siteId is derived
 * positional via stumpSiteId (pile precedent: spawned ids
 * derive from position the same way). Boulder: the kind
 * is accepted in the type, but NO boulder objects exist
 * in code, so nothing can stage onto a boulder until
 * boulders land — the state still holds such a record
 * (Systems reads state, not graphics), the renderer
 * simply draws nothing for it until then.
 *
 * SEMANTICS (dumb state, lane-decided, DEV-approved):
 * one staged bone per site; staging onto an occupied
 * site REPLACES (emits unstaged for the old bone, then
 * staged for the new) — Systems enforces any
 * refuse-by-checking-snapshot-first. restore() is silent
 * — the caller rebuilds once (trap restore precedent).
 * A non-array restore input is ignored entirely (state
 * untouched — a corrupt save must not wipe a live world);
 * invalid entries inside an array are dropped. Save
 * shape follows Systems-side (trap-save pattern); boot
 * restores BEFORE renderer construction (torch/altar
 * pattern), and the constructor's initial rebuild picks
 * the restored bones up.
 */

import { bus } from './events';

/** A ritual site kind: made altar, stump altar, boulder altar (same rituals, pinned). */
export type RitualSiteKind = 'altar' | 'stump' | 'boulder';

/** A ritual site, by kind + stable id + position (the renderer needs x/z to draw the bone). */
export interface RitualSiteRef {
  kind: RitualSiteKind;
  siteId: string;
  x: number;
  z: number;
}

/** A bone staged on a site, awaiting its window (or immediate completion, if sky-independent). */
export interface StagedBone {
  site: RitualSiteRef;
  /** Systems' bone design key (opaque here — never an invented item id). */
  bone: string;
}

/**
 * Stump site id, derived from position (no stump ids exist
 * in code — FelledEntry is position-keyed). Two decimals,
 * like the spawned-log ids, so the same stump always
 * derives the same id.
 */
export function stumpSiteId(x: number, z: number): string {
  return `stump:${x.toFixed(2)},${z.toFixed(2)}`;
}

const SITE_KINDS: ReadonlySet<string> = new Set(['altar', 'stump', 'boulder']);

class RitualSiteState {
  private staged = new Map<string, StagedBone>();

  stageBone(site: RitualSiteRef, bone: string): StagedBone {
    const ref: RitualSiteRef = { kind: site.kind, siteId: site.siteId, x: site.x, z: site.z };
    if (this.staged.has(site.siteId)) {
      bus.emit('ritual:unstaged', { siteId: site.siteId });
    }
    const record: StagedBone = { site: ref, bone };
    this.staged.set(site.siteId, record);
    bus.emit('ritual:staged', { site: { ...ref }, bone });
    return { site: { ...ref }, bone };
  }

  unstageBone(siteId: string): boolean {
    if (!this.staged.has(siteId)) return false;
    this.staged.delete(siteId);
    bus.emit('ritual:unstaged', { siteId });
    return true;
  }

  getStaged(siteId: string): StagedBone | undefined {
    const record = this.staged.get(siteId);
    return record ? { site: { ...record.site }, bone: record.bone } : undefined;
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): StagedBone[] {
    return [...this.staged.values()].map((record) => ({ site: { ...record.site }, bone: record.bone }));
  }

  restore(staged: ReadonlyArray<StagedBone>): void {
    if (!Array.isArray(staged)) return;
    this.staged.clear();
    for (const record of staged) {
      if (!record || typeof record !== 'object') continue;
      const site = (record as StagedBone).site;
      if (!site || typeof site !== 'object') continue;
      if (!SITE_KINDS.has(site.kind)) continue;
      if (typeof site.siteId !== 'string' || site.siteId === '') continue;
      if (!Number.isFinite(site.x) || !Number.isFinite(site.z)) continue;
      if (typeof (record as StagedBone).bone !== 'string' || (record as StagedBone).bone === '') continue;
      this.staged.set(site.siteId, {
        site: { kind: site.kind, siteId: site.siteId, x: site.x, z: site.z },
        bone: (record as StagedBone).bone,
      });
    }
  }

  clear(): void {
    this.staged.clear();
  }
}

export const ritualSiteState = new RitualSiteState();
