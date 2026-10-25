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
export { WitchPortrait } from './WitchPortrait';
export type { WitchPortraitProps } from './WitchPortrait';
export { WitchMark, VineDivider } from './WitchyArt';
export type { WitchyArtProps } from './WitchyArt';
export { UI_THEMES } from './themes';
export type { UiThemeName, UiTheme } from './themes';
export { WorldAnchor } from './WorldAnchor';
export type { WorldAnchorProps } from './WorldAnchor';
export { InteractionPrompt } from './InteractionPrompt';
export type { InteractionPromptProps } from './InteractionPrompt';
export { ContextMenu } from './ContextMenu';
export type { ContextMenuProps } from './ContextMenu';
export { ObjectFeedback } from './ObjectFeedback';
export type { ObjectFeedbackProps } from './ObjectFeedback';
export { InteractionProgress } from './InteractionProgress';
export type { InteractionProgressProps } from './InteractionProgress';
export { WitchHealth } from './WitchHealth';
export type { WitchHealthProps } from './WitchHealth';
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
  ContextAction,
  FeedbackTone,
} from './types';
