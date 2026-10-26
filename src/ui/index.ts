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
export { HungerIndicator } from './HungerIndicator';
export type { HungerIndicatorProps, HungerStage } from './HungerIndicator';
export { FireState } from './FireState';
export type { FireStateProps, FireKind, FireChipStatus } from './FireState';
export { PlacementPreview } from './PlacementPreview';
export type { PlacementPreviewProps } from './PlacementPreview';
export { ShelteredIndicator } from './ShelteredIndicator';
export type { ShelteredIndicatorProps } from './ShelteredIndicator';
export { WornList } from './WornList';
export type { WornListProps, WornGarment } from './WornList';
export { UmbrellaIcon } from './UmbrellaIcon';
export { CAMERA_FRAMING, CAMERA_TRANSITION } from './cameraPresentation';
export type { CameraFraming } from './cameraPresentation';
export {
  MOTION_PRESENTATION,
  FACING_EASE_MS,
} from './motionPresentation';
export type { MotionState, MotionPresentation } from './motionPresentation';
export { CameraTransition } from './CameraTransition';
export type { CameraTransitionProps } from './CameraTransition';
export { WitchMotion } from './WitchMotion';
export type { WitchMotionProps } from './WitchMotion';
export { CameraPerspectiveCard } from './CameraPerspectiveCard';
export type { CameraPerspectiveCardProps } from './CameraPerspectiveCard';
export {
  HARVEST_REQUEST_EVENT,
  harvestRequestFor,
} from './proximityHarvest';
export type {
  HarvestTargetKind,
  HarvestTarget,
  HarvestRequest,
} from './proximityHarvest';
export { HarvestButton, RemoveButton } from './HarvestButton';
export type { HarvestButtonProps, RemoveButtonProps } from './HarvestButton';
export { ProximityHarvestButtons } from './ProximityHarvestButtons';
export type { ProximityHarvestButtonsProps } from './ProximityHarvestButtons';
export { projectWorldToScreen } from './worldProjection';
export type {
  ProjectionInput,
  ProjectedPoint,
} from './worldProjection';
export { HudShell } from './HudShell';
export type { HudShellProps } from './HudShell';
export { InventoryPanel } from './InventoryPanel';
export type { InventoryPanelProps } from './InventoryPanel';
export { CraftingMenu } from './CraftingMenu';
export type { CraftingMenuProps } from './CraftingMenu';
export { CameraToggle } from './CameraToggle';
export type { CameraToggleProps } from './CameraToggle';
export { TouchControls } from './TouchControls';
export type { TouchControlsProps } from './TouchControls';
export {
  OptionsModal,
  FONT_OPTIONS,
  DEFAULT_FONT_ID,
  loadFontChoice,
  saveFontChoice,
  fontClassFor,
} from './OptionsModal';
export type { OptionsModalProps, FontId } from './OptionsModal';
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
