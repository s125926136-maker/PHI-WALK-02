/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HumanScaleType = 'child' | 'teen' | 'adult' | 'elderly' | 'wheelchair';

export interface HumanScalePreset {
  id: HumanScaleType;
  name: string;
  eyeHeight: number;       // Eye height in meters
  bodyWidth: number;       // Clearance width in meters (shoulders/chair width)
  reachRadius: number;     // Typical reach distance in meters
  speedMultiplier: number; // Speed scale
  description: string;
}

export type SpaceType = 'apartment' | 'gallery' | 'corridor' | 'uploaded';

export interface SpacePreset {
  id: SpaceType;
  name: string;
  description: string;
  ceilingDefault: number;
  corridorDefault?: number;
}

export type ViewMode = 'first-person' | 'third-person';

export type ModelUnit = 'm' | 'cm' | 'mm' | 'ft' | 'inch';

export type SiteMarginOption = '5m' | '10m' | '20m' | '50m' | 'custom';

export interface PlayerSettings {
  presetId: HumanScaleType;
  eyeHeight: number;
  bodyWidth: number;
  reachRadius: number;
  modelUnit: ModelUnit;
  viewMode: ViewMode;
  collisionEnabled: boolean;
  gravityEnabled: boolean;
  showLaserMeasure: boolean;
  showMeasureVisualization: boolean;
  showReachSphere: boolean;
  showClearanceEnvelope: boolean;
  posture: 'standing' | 'sitting' | 'crouching';
  currentMoveSpeed: number;
  displayMode: 'real' | 'analyze' | 'night-vision' | 'orientation';
  showOrientationAnalysis: boolean;
  showNightVision: boolean;
  showSunAnalysis: boolean;
  showWindAnalysis: boolean;
  showAccessibilityAnalysis: boolean;
  siteMargin: number;
  siteMarginOption: SiteMarginOption;
  
  // Project Settings & Solar Analysis V0.6
  siteName: string;
  latitude: number;
  longitude: number;
  latitudeDMS: string;
  longitudeDMS: string;
  coordsFormat: 'decimal' | 'dms';
  modelNorth: number; // 0 to 360 degrees
  timezone: number; // e.g. 8 for GMT+8, can be negative
  analysisDate: string; // YYYY-MM-DD
  analysisTime: string; // HH:MM
  
  // Solar Analysis V0.7
  analysisMode: 'solar' | 'orientation';
  modelRotation: number; // 0 to 360 degrees for building rotation
  showCompass: boolean; // Toggle with 'B' key
  showFloatingPanel: boolean; // Toggle with 'Tab' key
  movementMode: 'architect' | 'explorer';
  jumpPower?: number;
}

export interface HUDSettings {
  enabled: boolean;
  pinned: boolean;
  collapsed: boolean;
  mini: boolean;
  smartPlacement: boolean;
  opacity: number;
  theme: 'dark' | 'light' | 'glass' | 'cyberpunk';
  size: 'small' | 'medium' | 'large';
  preferredCorner: 'BR' | 'BL' | 'TR' | 'TL' | 'BCL' | 'TCL';
  offset: { x: number; y: number } | null;
  enabledItems: {
    oppression: boolean;
    eyeToCeiling: boolean;
    eyeToGround: boolean;
    walkwayWidth: boolean;
    wallDistance: boolean;
    heading: boolean;
    fps: boolean;
    altitude: boolean;
    ada: boolean;
  };
}

export const DEFAULT_HUD_SETTINGS: HUDSettings = {
  enabled: true,
  pinned: true,
  collapsed: false,
  mini: false,
  smartPlacement: true,
  opacity: 85,
  theme: 'dark',
  size: 'medium',
  preferredCorner: 'BR',
  offset: null,
  enabledItems: {
    oppression: true,
    eyeToCeiling: true,
    eyeToGround: true,
    walkwayWidth: true,
    wallDistance: true,
    heading: false,
    fps: false,
    altitude: false,
    ada: false,
  }
};

export interface TelemetryData {
  eyeHeight: number;
  eyeLevelAboveGround: number | null;
  ceilingHeight: number | null;
  walkwayWidth: number | null;
  nearestWall: number | null;
  nearestFurniture: number | null;
  currentRoom: string;
  oppressionIndex: number; // 0 to 100
  oppressionLevel: 'spacious' | 'comfortable' | 'cozy' | 'oppressive';
  isSafeForWheelchair: boolean;
  fps: number;
  playerHeading?: number; // Added for HUD decoupling
  consolidatedResults?: Record<string, {
    name: string;
    value: string | number | boolean;
    unit?: string;
    status: 'success' | 'warning' | 'error' | 'inactive';
    warning?: string;
    timestamp: number;
    extraData?: any;
  }>;
}

export interface ModelFileInfo {
  name: string;
  size: string;
  vertexCount: number;
  meshCount: number;
  dimensions: { x: number; y: number; z: number } | null;
  rawDimensions?: { x: number; y: number; z: number } | null;
}
