/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — UI barrel (UI lane).
 *
 * Props-driven presentation components only. NOT wired into App yet;
 * wiring happens after landing 1 lands, in a separate step.
 */

export { CharacterAvatar } from './CharacterAvatar';
export type { CharacterAvatarProps } from './CharacterAvatar';
export { HudShell } from './HudShell';
export type { HudShellProps } from './HudShell';
export { InventoryPanel } from './InventoryPanel';
export type { InventoryPanelProps } from './InventoryPanel';
export { CraftingMenu } from './CraftingMenu';
export type { CraftingMenuProps } from './CraftingMenu';
export { CameraToggle } from './CameraToggle';
export type { CameraToggleProps } from './CameraToggle';
export { Popup } from './Popup';
export type { PopupProps } from './Popup';
export type {
  CameraPerspective,
  NeedSlot,
  InventoryItem,
  RecipeIngredient,
  CraftingRecipe,
} from './types';
