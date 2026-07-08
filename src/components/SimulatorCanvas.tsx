/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as fflate from 'fflate';
import { 
  PlayerSettings, 
  TelemetryData, 
  SpaceType, 
  ModelFileInfo,
  ViewMode,
  ModelUnit
} from '../types';
import { computeSolarPosition } from '../utils/solarCalculator';
import { buildApartment, buildGallery, buildInteractiveCorridor } from '../proceduralSpaces';
import { Maximize, Minimize, ShieldCheck, Zap, MousePointer, Info, Scale, Sun, Compass, Ruler, Moon, Calendar, Clock, RotateCcw, User, Activity, Layers, Settings, ChevronLeft, ChevronRight, Globe, Eye } from 'lucide-react';
import { HUMAN_PRESETS } from './TelemetryPanel';
import { eventBus } from '../core/EventSystem';
import { WorkspacePanels } from './workspace/WorkspacePanels';
import { TelemetryHUD } from './TelemetryHUD';
import { TopToolbar } from './TopToolbar';
import { SidebarPanel } from './SidebarPanel';
import { TimeControlPanel } from './TimeControlPanel';
import { AnalysisOverlay } from './AnalysisOverlay';
import { DebugOverlay } from './DebugOverlay';
import { LoadingOverlay } from './LoadingOverlay';
import { ModelImportDialog } from './ModelImportDialog';
import { SpatialMeasurementEngine } from '../analysis/measure';
import { SolarEngine } from '../analysis/solar';
import { WindEngine } from '../analysis/wind';
import { EngineRegistry, AnalysisContext } from '../analysis/framework';
import { pluginRegistry } from '../core/plugins/PluginRegistry';
import { AnalysisEnginePluginAdapter } from '../core/plugins/AnalysisEnginePluginAdapter';
import { CharacterController, CharacterInputState, CharacterPhysicsConfig } from '../core/CharacterController';
import { CameraController } from '../core/CameraController';
import { InputManager } from '../core/InputManager';
import { ThreeSceneManager } from '../core/ThreeSceneManager';
import { SimulationLoop, SimulationContext } from '../core/SimulationLoop';
import { EngineFactory } from '../core/EngineFactory';
import { EngineRuntime } from '../core/EngineRuntime';
import { PerformanceProfiler } from '../core/PerformanceProfiler';
import { disposeSimulatorObject3D } from './simulator/threeDisposal';
import { useEnvironmentObjects } from './simulator/useEnvironmentObjects';

// Setup fflate globally for FBXLoader compression support
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.fflate = fflate;
}

// File-scope static variables to completely eliminate GC pressure inside 60fps loop
const _tempV1 = new THREE.Vector3();
const _tempV2 = new THREE.Vector3();
const _tempV3 = new THREE.Vector3();
const _tempEuler = new THREE.Euler();
const _downRay = new THREE.Raycaster();
const _cameraRay = new THREE.Raycaster();
const _eyeDownRay = new THREE.Raycaster();
const _upRay = new THREE.Raycaster();
const _leftRay = new THREE.Raycaster();
const _rightRay = new THREE.Raycaster();
const _sweepRay = new THREE.Raycaster();
const _frontRay = new THREE.Raycaster();

interface SimulatorCanvasProps {
  settings: PlayerSettings;
  currentSpace: SpaceType;
  corridorWidth: number;
  corridorHeight: number;
  telemetry: TelemetryData;
  onTelemetryUpdate: (data: TelemetryData) => void;
  onModelLoaded: (info: ModelFileInfo) => void;
  onLoadingStateChange: (isLoading: boolean) => void;
  uploadedFile: File | null;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  activeKeys: Record<string, boolean>;
  setActiveKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  resetTrigger: number;
  projectName?: string;
  onBackToSetup?: () => void;
}

export const UNIT_FACTORS: Record<ModelUnit, number> = {
  m: 1.0,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  inch: 0.0254,
};

export function lerpAngle(current: number, target: number, step: number): number {
  let diff = target - current;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return current + diff * step;
}

export function getSkyColor(altitude: number): THREE.Color {
  const color = new THREE.Color();
  if (altitude >= 0.15) {
    if (altitude < 0.4) {
      const t = (altitude - 0.15) / (0.4 - 0.15);
      color.lerpColors(new THREE.Color(0xfbad40), new THREE.Color(0xb4d2ff), t);
    } else {
      color.setHex(0xb4d2ff);
    }
  } else if (altitude >= 0.0) {
    const t = altitude / 0.15;
    color.lerpColors(new THREE.Color(0x1a2a6c), new THREE.Color(0xfbad40), t);
  } else if (altitude > -0.15) {
    const t = (altitude + 0.15) / 0.15;
    color.lerpColors(new THREE.Color(0x030712), new THREE.Color(0x1a2a6c), t);
  } else {
    color.setHex(0x030712);
  }
  return color;
}

export const SimulatorCanvas: React.FC<SimulatorCanvasProps> = ({
  settings,
  currentSpace,
  corridorWidth,
  corridorHeight,
  telemetry,
  onTelemetryUpdate,
  onModelLoaded,
  onLoadingStateChange,
  uploadedFile,
  onSettingsChange,
  activeKeys,
  setActiveKeys,
  resetTrigger,
  projectName,
  onBackToSetup,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [isLocked, setIsLocked] = useState(false);
  const [isTabCursorMode, setIsTabCursorMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detectedUnit, setDetectedUnit] = useState<ModelUnit | null>(null);
  const [detectedDimensions, setDetectedDimensions] = useState<{ x: number, y: number, z: number } | null>(null);
  const [playerHeading, setPlayerHeading] = useState<number>(0);
  const [sunAzimuthDeg, setSunAzimuthDeg] = useState<number>(180);
  const [playerPitch, setPlayerPitch] = useState<number>(0);
  const [showTimeControl, setShowTimeControl] = useState(false);
  const [isTimePlaying, setIsTimePlaying] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState<'0x' | '1x' | '2x' | '5x' | '10x'>('0x');
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showSetupConfirm, setShowSetupConfirm] = useState(false);
  const [hidePerceptionData, setHidePerceptionData] = useState(false);
  const [showGround, setShowGround] = useState(true);
  const [showShadow, setShowShadow] = useState(true);

  // Sliding Docks States (Left Dock)
  const [characterHovered, setCharacterHovered] = useState(false);
  const [characterClicked, setCharacterClicked] = useState(false);
  const isCharacterOpen = characterHovered || characterClicked;

  // Blender-style Right Workspace Dock States
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'visual' | 'scene' | 'player' | 'analysis' | 'environment' | 'accessibility' | 'wind' | 'hud' | 'profiler' | null>('visual');
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);

  // System metrics state for the Profiler developer panel
  const [metrics, setMetrics] = useState({
    fps: 60,
    frameTime: 16.6,
    raycastsPerFrame: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    visibleMeshes: 0,
    solarTime: 0.0,
    measureTime: 0.0,
    memoryEstimate: 'N/A'
  });

  // HUD states
  const [hudEnabled, setHudEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('phi-walk-hud-enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isHudPinned, setIsHudPinned] = useState<boolean>(() => {
    const saved = localStorage.getItem('phi-walk-hud-pinned');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('phi-walk-hud-collapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isMiniHud, setIsMiniHud] = useState<boolean>(() => {
    const saved = localStorage.getItem('phi-walk-hud-mini');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isSmartPlacementEnabled, setIsSmartPlacementEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('phi-walk-hud-smart');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [hudOpacity, setHudOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('phi-walk-hud-opacity');
    return saved !== null ? JSON.parse(saved) : 85;
  });
  const [hudTheme, setHudTheme] = useState<'dark' | 'light' | 'glass' | 'cyberpunk'>(() => {
    const saved = localStorage.getItem('phi-walk-hud-theme');
    return saved !== null ? (JSON.parse(saved) as any) : 'dark';
  });
  const [hudSize, setHudSize] = useState<'small' | 'medium' | 'large'>(() => {
    const saved = localStorage.getItem('phi-walk-hud-size');
    return saved !== null ? (JSON.parse(saved) as any) : 'medium';
  });
  const [hudPreferredCorner, setHudPreferredCorner] = useState<'BR' | 'BL' | 'TR' | 'TL' | 'BCL' | 'TCL'>(() => {
    const saved = localStorage.getItem('phi-walk-hud-pref-corner');
    return saved !== null ? (JSON.parse(saved) as any) : 'BR';
  });
  const [hudOffset, setHudOffset] = useState<{ x: number; y: number } | null>(() => {
    const saved = localStorage.getItem('phi-walk-hud-pos');
    return saved ? JSON.parse(saved) : null;
  });
  const [hudEnabledItems, setHudEnabledItems] = useState(() => {
    const saved = localStorage.getItem('phi-walk-hud-items');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      oppression: true,
      eyeToCeiling: true,
      eyeToGround: true,
      walkwayWidth: true,
      wallDistance: true,
      heading: false,
      fps: false,
      altitude: false,
      ada: false,
    };
  });

  const [hudDebugInfo, setHudDebugInfo] = useState<{
    visible: boolean;
    position: string;
    opacity: number;
    zIndex: number;
    safeArea: boolean;
    collision: boolean;
    mode: string;
  }>({
    visible: true,
    position: 'BR (Default)',
    opacity: 0.85,
    zIndex: 50,
    safeArea: true,
    collision: false,
    mode: 'Smart',
  });

  // 1. Listen to HUD settings changes from the HUD overlay component
  useEffect(() => {
    const unsub = eventBus.on('hud-settings-change', (updated: Partial<import('../types').HUDSettings>) => {
      if (updated.enabled !== undefined) setHudEnabled(updated.enabled);
      if (updated.pinned !== undefined) setIsHudPinned(updated.pinned);
      if (updated.collapsed !== undefined) setIsHudCollapsed(updated.collapsed);
      if (updated.mini !== undefined) setIsMiniHud(updated.mini);
      if (updated.smartPlacement !== undefined) setIsSmartPlacementEnabled(updated.smartPlacement);
      if (updated.opacity !== undefined) setHudOpacity(updated.opacity);
      if (updated.theme !== undefined) setHudTheme(updated.theme);
      if (updated.size !== undefined) setHudSize(updated.size);
      if (updated.preferredCorner !== undefined) setHudPreferredCorner(updated.preferredCorner);
      if (updated.offset !== undefined) setHudOffset(updated.offset);
      if (updated.enabledItems !== undefined) setHudEnabledItems(updated.enabledItems);
    });
    return unsub;
  }, []);

  // 2. Broadcast HUD settings changes from SimulatorCanvas to the HUD overlay component
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    eventBus.emit('hud-settings-change', {
      enabled: hudEnabled,
      pinned: isHudPinned,
      collapsed: isHudCollapsed,
      mini: isMiniHud,
      smartPlacement: isSmartPlacementEnabled,
      opacity: hudOpacity,
      theme: hudTheme,
      size: hudSize,
      preferredCorner: hudPreferredCorner,
      offset: hudOffset,
      enabledItems: hudEnabledItems,
    });
  }, [
    hudEnabled,
    isHudPinned,
    isHudCollapsed,
    isMiniHud,
    isSmartPlacementEnabled,
    hudOpacity,
    hudTheme,
    hudSize,
    hudPreferredCorner,
    hudOffset,
    hudEnabledItems,
  ]);

  // 3. Listen to HUD debug state updates from the HUD overlay component
  useEffect(() => {
    const unsub = eventBus.on('hud-debug-update', (debug: any) => {
      setHudDebugInfo(debug);
    });
    return unsub;
  }, []);

  // 4. Listen to unpin trigger events from the HUD overlay component
  useEffect(() => {
    const unsub = eventBus.on('hud-unpin-trigger', () => {
      setIsWorkspaceExpanded(true);
      setActiveWorkspaceTab('accessibility');
    });
    return unsub;
  }, []);

  // 5. Broadcast UI layout changes to the HUD component so it can recalculate collision boundaries
  useEffect(() => {
    eventBus.emit('layout-change', {
      leftDockOpen: isCharacterOpen,
      rightDockOpen: isWorkspaceExpanded && activeWorkspaceTab !== null,
      bottomTimeOpen: showTimeControl,
      activeWorkspaceTab,
      isWorkspaceExpanded
    });
  }, [isCharacterOpen, isWorkspaceExpanded, activeWorkspaceTab, showTimeControl]);

  // Scene Elements Toggles
  const [sceneSkyEnabled, setSceneSkyEnabled] = useState(true);
  const [sceneSunEnabled, setSceneSunEnabled] = useState(true);
  const [sceneSunPathEnabled, setSceneSunPathEnabled] = useState(true);
  const [sceneBoundaryEnabled, setSceneBoundaryEnabled] = useState(true);
  const [sceneVegetationEnabled, setSceneVegetationEnabled] = useState(true);
  const [sceneSpawnPointEnabled, setSceneSpawnPointEnabled] = useState(true);

  const {
    sunGroupRef,
    windGroupRef,
    accessibilityGroupRef,
    turningCircleRef,
    updateGroundEnvironment,
    createAnalysisEnvironmentObjects,
    cleanupEnvironmentObjects,
  } = useEnvironmentObjects({
    sceneBoundaryEnabled,
    sceneVegetationEnabled,
    sceneSpawnPointEnabled,
  });

  // Player HUD Toggles
  const [playerEnvelopeEnabled, setPlayerEnvelopeEnabled] = useState(true);
  const [playerDirectionArrowEnabled, setPlayerDirectionArrowEnabled] = useState(true);
  const [playerCrosshairEnabled, setPlayerCrosshairEnabled] = useState(true);

  // Spatial Measurement Toggles
  const [analysisEyeLevelEnabled, setAnalysisEyeLevelEnabled] = useState(true);
  const [analysisCeilingHeightEnabled, setAnalysisCeilingHeightEnabled] = useState(true);
  const [analysisWalkwayWidthEnabled, setAnalysisWalkwayWidthEnabled] = useState(true);
  const [analysisWallDistanceEnabled, setAnalysisWallDistanceEnabled] = useState(true);
  const [analysisEyeRayEnabled, setAnalysisEyeRayEnabled] = useState(true);
  const [analysisDimensionLabelsEnabled, setAnalysisDimensionLabelsEnabled] = useState(true);
  const [analysisMeasureArrowEnabled, setAnalysisMeasureArrowEnabled] = useState(true);

  // Wind Interactive Parameters
  const [windSpeed, setWindSpeed] = useState<number>(3.0);
  const [windAngle, setWindAngle] = useState<number>(170); // in degrees

  // 3D Refs for Custom Elements
  const sunPathLineRef = useRef<THREE.Line | null>(null);
  const timeAccumulatorRef = useRef<number>(0);
  const isTimePlayingRef = useRef(false);
  const timeSpeedRef = useRef<'0x' | '1x' | '2x' | '5x' | '10x'>('0x');

  // Synchronization Refs to prevent stale closures in the animation loop
  const isLockedRef = useRef(false);
  const isTabCursorModeRef = useRef(false);
  const showTimeControlRef = useRef(false);
  const showCharacterModalRef = useRef(false);
  const showSetupConfirmRef = useRef(false);
  const activeWorkspaceTabRef = useRef<string | null>(null);
  const isWorkspaceExpandedRef = useRef(false);
  const debugLogFrameCounter = useRef(0);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    isTabCursorModeRef.current = isTabCursorMode;
  }, [isTabCursorMode]);

  useEffect(() => {
    showTimeControlRef.current = showTimeControl;
  }, [showTimeControl]);

  useEffect(() => {
    showCharacterModalRef.current = showCharacterModal;
  }, [showCharacterModal]);

  useEffect(() => {
    showSetupConfirmRef.current = showSetupConfirm;
  }, [showSetupConfirm]);

  useEffect(() => {
    activeWorkspaceTabRef.current = activeWorkspaceTab;
  }, [activeWorkspaceTab]);

  useEffect(() => {
    isWorkspaceExpandedRef.current = isWorkspaceExpanded;
  }, [isWorkspaceExpanded]);

  useEffect(() => {
    isTimePlayingRef.current = isTimePlaying;
  }, [isTimePlaying]);

  useEffect(() => {
    timeSpeedRef.current = timeSpeed;
  }, [timeSpeed]);

  useEffect(() => {
    if (groundMeshRef.current) {
      groundMeshRef.current.visible = showGround;
    }
  }, [showGround]);

  // Handle dynamic scene sky background or dark workspace color
  useEffect(() => {
    if (sceneRef.current) {
      if (sceneSkyEnabled) {
        if (settings.showNightVision) {
          sceneRef.current.background = new THREE.Color(0x021102); // Dark green
        } else if (settings.showOrientationAnalysis) {
          sceneRef.current.background = new THREE.Color(0x111111); // Dark orientation
        } else if (settings.showSunAnalysis) {
          // Inside the frame loop it will update dynamically, but set a default starting day color here
          sceneRef.current.background = new THREE.Color(0xb4d2ff); 
        } else {
          sceneRef.current.background = new THREE.Color(0xb4d2ff); // Sky blue
        }
      } else {
        sceneRef.current.background = new THREE.Color(0x0a0a0a); // Workspace dark charcoal
      }
    }
  }, [sceneSkyEnabled, settings.showNightVision, settings.showOrientationAnalysis, settings.showSunAnalysis]);

  // Synchronize active workspace tabs with settings analysis properties reactively
  useEffect(() => {
    if (activeWorkspaceTab === 'wind') {
      onSettingsChange({ showWindAnalysis: true });
    } else if (activeWorkspaceTab === 'environment') {
      onSettingsChange({ showSunAnalysis: true });
    } else if (activeWorkspaceTab === 'accessibility') {
      onSettingsChange({ showAccessibilityAnalysis: true });
    }
  }, [activeWorkspaceTab]);
  const [activeDockSection, setActiveDockSection] = useState<'solar' | 'orientation' | 'measure' | 'night' | 'human' | 'telemetry'>('solar');
  const [isDraggingPanelCompass, setIsDraggingPanelCompass] = useState(false);
  const panelCompassRef = useRef<SVGSVGElement | null>(null);

  const handlePanelCompassMove = (clientX: number, clientY: number) => {
    if (!panelCompassRef.current) return;
    const rect = panelCompassRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    
    let angleDegrees = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI));
    if (angleDegrees < 0) angleDegrees += 360;
    
    onSettingsChange({ modelRotation: angleDegrees });
  };

  const handlePanelCompassMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPanelCompass(true);
    if (inputManagerRef.current) {
      inputManagerRef.current.startPanelCompassDrag(
        e.clientX,
        e.clientY,
        (x, y) => handlePanelCompassMove(x, y),
        () => setIsDraggingPanelCompass(false)
      );
    }
  };

  // ThreeJS References stored in mutable refs to bypass React state re-render lags
  const runtimeRef = useRef<EngineRuntime | null>(null);
  const threeSceneManagerRef = useRef<ThreeSceneManager | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const currentModelGroupRef = useRef<THREE.Group | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  
  // CharacterController reference
  const characterControllerRef = useRef<CharacterController | null>(null);
  const simulationLoopRef = useRef<SimulationLoop | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const inputManagerRef = useRef<InputManager | null>(null);
  const shadowLogCounter = useRef<number>(0);
  const shadowSpamTimer = useRef<number>(0);

  // Player state refs for physics & rotation
  const playerPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const playerVelocity = useRef<THREE.Vector3>(new THREE.Vector3());
  
  // Proxy objects to read directly from characterControllerRef.current
  const cameraYaw = {
    get current() {
      return characterControllerRef.current?.cameraYaw ?? 0;
    }
  };
  const cameraPitch = {
    get current() {
      return characterControllerRef.current?.cameraPitch ?? 0;
    }
  };
  
  // Proxy object to read directly from characterControllerRef.current.currentEyeHeight
  const currentEyeHeight = {
    get current() {
      return characterControllerRef.current?.currentEyeHeight ?? settings.eyeHeight;
    }
  };

  const avatarYawRef = useRef<number>(Math.PI); // facing Z- forward initially

  const reachSphereRef = useRef<THREE.Mesh | null>(null);
  const clearanceCylinderRef = useRef<THREE.Mesh | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  
  // First-person reach animations
  const fpArmGroupRef = useRef<THREE.Group | null>(null);
  const dynReachGroupRef = useRef<THREE.Group | null>(null);
  const reachAnimTimerRef = useRef<number>(-1);
  const dynReachFadeTimerRef = useRef<number>(-1);

  // Measure Visualization
  const measureVisGroupRef = useRef<THREE.Group | null>(null);

  // Frame counter & timing for tiered-rate system updates (60 FPS vs ~15 FPS vs ~7.5 FPS vs ~5 FPS)
  const frameCountRef = useRef<number>(0);
  const lastTelemetryTimeRef = useRef<number>(0);

  // Solar position calculation caching to completely bypass heavy trigonometry at 60 FPS
  const lastSolarParamsRef = useRef({
    date: '',
    time: '',
    latitude: 0,
    longitude: 0,
    timezone: 0,
    modelNorth: 0,
    showSunAnalysis: false,
    modelId: '',
    sceneSunEnabled: true,
    sceneSunPathEnabled: true,
    sceneSkyEnabled: true,
  });

  // Spatial Measurement Engine using PHI WALK Analysis Engine Framework
  const measureEngineRef = useRef<SpatialMeasurementEngine | null>(null);

  // Solar Engine using PHI WALK Analysis Engine Framework
  const solarEngineRef = useRef<SolarEngine | null>(null);

  // Wind Engine using PHI WALK Analysis Engine Framework
  const windEngineRef = useRef<WindEngine | null>(null);

  // Performance metrics caching
  const metricsCache = useRef({
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    visibleMeshes: 0,
    solarTime: 0.0,
    measureTime: 0.0,
    memoryEstimate: 'N/A'
  });

  // Cached list of collidable meshes to avoid traversing the scene graph every frame
  const cachedCollidableMeshesRef = useRef<THREE.Object3D[]>([]);

  // Pointer lock requests
  const requestPointerLock = () => {
    if (inputManagerRef.current) {
      inputManagerRef.current.requestPointerLock();
    }
  };

  // Reactively manage pointer lock state based on showFloatingPanel, showTimeControl, and showCharacterModal
  const prevShowFloatingPanel = useRef(settings.showFloatingPanel);
  const prevShowTimeControl = useRef(showTimeControl);
  const prevShowCharacterModal = useRef(showCharacterModal);
  const prevShowSetupConfirm = useRef(showSetupConfirm);
  const prevWorkspaceExpanded = useRef(isWorkspaceExpanded && activeWorkspaceTab !== null);

  useEffect(() => {
    const isAnyPanelOpen = settings.showFloatingPanel || showTimeControl || showCharacterModal || showSetupConfirm || (activeWorkspaceTab !== null && isWorkspaceExpanded);
    const wasAnyPanelOpen = prevShowFloatingPanel.current || prevShowTimeControl.current || prevShowCharacterModal.current || prevShowSetupConfirm.current || prevWorkspaceExpanded.current;

    prevShowFloatingPanel.current = settings.showFloatingPanel;
    prevShowTimeControl.current = showTimeControl;
    prevShowCharacterModal.current = showCharacterModal;
    prevShowSetupConfirm.current = showSetupConfirm;
    prevWorkspaceExpanded.current = isWorkspaceExpanded && activeWorkspaceTab !== null;

    if (isAnyPanelOpen) {
      if (document.pointerLockElement === canvasRef.current) {
        document.exitPointerLock();
      }
      setIsLocked(false);
    } else if (wasAnyPanelOpen && !isAnyPanelOpen) {
      // Re-request lock when all panels close (only if we are NOT in Tab Cursor mode)
      if (!isTabCursorMode) {
        requestPointerLock();
      }
    }
  }, [settings.showFloatingPanel, showTimeControl, showCharacterModal, showSetupConfirm, activeWorkspaceTab, isWorkspaceExpanded, isTabCursorMode]);

  // InputManager binding and configuration updates
  useEffect(() => {
    if (canvasRef.current && containerRef.current && inputManagerRef.current && characterControllerRef.current && cameraControllerRef.current) {
      inputManagerRef.current.bind(
        canvasRef.current,
        containerRef.current,
        characterControllerRef.current,
        cameraControllerRef.current,
        {
          getSettings: () => settings,
          getIsLocked: () => isLocked,
          getIsTabCursorMode: () => isTabCursorMode,
          getShowTimeControl: () => showTimeControl,
          getShowCharacterModal: () => showCharacterModal,
          getShowSetupConfirm: () => showSetupConfirm,
          getIsWorkspaceExpanded: () => isWorkspaceExpanded,
          getActiveWorkspaceTab: () => activeWorkspaceTab,
          
          onActiveKeysChange: (keys) => setActiveKeys(keys),
          onLockChange: (locked) => setIsLocked(locked),
          onFullscreenChange: (fullscreen) => setIsFullscreen(fullscreen),
          onTabCursorModeChange: (tabCursor) => setIsTabCursorMode(tabCursor),
          onReach: () => {
            if (reachAnimTimerRef.current < 0) {
              reachAnimTimerRef.current = 0;
            }
            dynReachFadeTimerRef.current = 0.5;
          },
          onTimeControlToggle: (nextValue) => {
            setShowTimeControl(nextValue);
            if (!nextValue) {
              onSettingsChange({ viewMode: 'first-person' });
            }
          },
          onSettingsChange: (newSettings) => onSettingsChange(newSettings),
        }
      );
    }

    return () => {
      inputManagerRef.current?.unbind();
    };
  }, []);

  // Update InputManager configuration on state/prop changes to ensure the callbacks/getters have latest values
  useEffect(() => {
    if (!inputManagerRef.current) return;

    inputManagerRef.current.updateConfig({
      getSettings: () => settings,
      getIsLocked: () => isLocked,
      getIsTabCursorMode: () => isTabCursorMode,
      getShowTimeControl: () => showTimeControl,
      getShowCharacterModal: () => showCharacterModal,
      getShowSetupConfirm: () => showSetupConfirm,
      getIsWorkspaceExpanded: () => isWorkspaceExpanded,
      getActiveWorkspaceTab: () => activeWorkspaceTab,
      
      onActiveKeysChange: (keys) => setActiveKeys(keys),
      onLockChange: (locked) => setIsLocked(locked),
      onFullscreenChange: (fullscreen) => setIsFullscreen(fullscreen),
      onTabCursorModeChange: (tabCursor) => setIsTabCursorMode(tabCursor),
      onReach: () => {
        if (reachAnimTimerRef.current < 0) {
          reachAnimTimerRef.current = 0;
        }
        dynReachFadeTimerRef.current = 0.5;
      },
      onTimeControlToggle: (nextValue) => {
        setShowTimeControl(nextValue);
        if (!nextValue) {
          onSettingsChange({ viewMode: 'first-person' });
        }
      },
      onSettingsChange: (newSettings) => onSettingsChange(newSettings),
    });
  }, [
    settings,
    isLocked,
    isTabCursorMode,
    showTimeControl,
    showCharacterModal,
    showSetupConfirm,
    isWorkspaceExpanded,
    activeWorkspaceTab,
    setActiveKeys,
    onSettingsChange,
  ]);

  const toggleFullscreen = () => {
    inputManagerRef.current?.toggleFullscreen();
  };

  // Trigger Camera Reset
  useEffect(() => {
    if (resetTrigger > 0) {
      resetPlayerPosition();
    }
  }, [resetTrigger]);

  const resetPlayerPosition = () => {
    if (!characterControllerRef.current) return;

    characterControllerRef.current.setCameraRotation(0, 0);
    avatarYawRef.current = Math.PI; // default face Z-
    characterControllerRef.current.resetVelocity();

    let spawned = false;

    if (currentModelGroupRef.current) {
      const box = new THREE.Box3().setFromObject(currentModelGroupRef.current);
      if (isFinite(box.min.x) && isFinite(box.max.x) && isFinite(box.min.z) && isFinite(box.max.z)) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const spawnX = center.x;
        const spawnY = Math.max(0, box.min.y) + settings.eyeHeight;
        const spawnZ = box.min.z - 5.0; // Place player 5.0 meters in front of the model's front boundary

        characterControllerRef.current.setPosition(spawnX, spawnY, spawnZ);

        // Point the camera towards the model center
        const dx = center.x - spawnX;
        const dy = center.y - spawnY;
        const dz = center.z - spawnZ;

        const targetYaw = Math.atan2(-dx, -dz);
        avatarYawRef.current = targetYaw + Math.PI;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);
        const targetPitch = Math.atan2(dy, horizontalDist);
        characterControllerRef.current.setCameraRotation(targetYaw, targetPitch);
        spawned = true;
      }
    }

    if (!spawned) {
      // Position based on space fallback
      if (currentSpace === 'apartment') {
        characterControllerRef.current.setPosition(0, settings.eyeHeight, 0);
      } else if (currentSpace === 'gallery') {
        characterControllerRef.current.setPosition(0, settings.eyeHeight, -8);
      } else if (currentSpace === 'corridor') {
        characterControllerRef.current.setPosition(0, settings.eyeHeight, 4.5);
      } else {
        characterControllerRef.current.setPosition(0, settings.eyeHeight, 0);
      }
    }

    // CharacterController Phase 2A: Sync look and transform state to shadow controller
    characterControllerRef.current.setAvatarYaw(avatarYawRef.current);
    characterControllerRef.current.resetVelocity();
  };

  const updateGroundPlane = () => {
    const scene = sceneRef.current;
    const groundMesh = groundMeshRef.current;
    if (!scene || !groundMesh) return;

    updateGroundEnvironment({
      scene,
      groundMesh,
      currentModelGroup: currentModelGroupRef.current,
      siteMargin: settings.siteMargin,
    });
  };

  const applyDisplayMode = (scene: THREE.Scene, mode: 'real' | 'analyze' | 'night-vision' | 'orientation') => {
    const ambientLight = ambientLightRef.current;
    const hemiLight = hemiLightRef.current;
    const dirLight = dirLightRef.current;
    const renderer = rendererRef.current;

    if (!ambientLight || !hemiLight || !dirLight || !renderer) return;

    // --- Architectural Debugging Logs (Console Outputs) ---
    if (currentModelGroupRef.current) {
      const model = currentModelGroupRef.current;
      let rendererCount = 0;
      let activeRendererCount = 0;
      const materialNamesSet = new Set<string>();
      const layersSet = new Set<string>();

      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          rendererCount++;
          if (node.visible) {
            activeRendererCount++;
          }
          if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(mat => {
              materialNamesSet.add(mat.name || mat.type);
            });
          }
          layersSet.add(`Mask ${node.layers.mask}`);
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);

      console.log("=== Solar Study Diagnostic Data ===");
      console.log(`Building Count: ${model.children.length}`);
      console.log(`Renderer Count: ${rendererCount}`);
      console.log(`Active Renderer Count: ${activeRendererCount}`);
      console.log(`Material Name: ${Array.from(materialNamesSet).join(', ') || 'None'}`);
      console.log(`Layer Name: ${Array.from(layersSet).join(', ') || 'Default'}`);
      console.log(`Bounds Size: Width=${size.x.toFixed(2)}m, Height=${size.y.toFixed(2)}m, Depth=${size.z.toFixed(2)}m`);
      console.log("===================================");
    }

    // Reset default light colors first
    ambientLight.color.setHex(0xffffff);
    hemiLight.color.setHex(0xb4d2ff);
    hemiLight.groundColor.setHex(0x5a7850);
    dirLight.color.setHex(0xffffff);

    // 1. Configure Light Intensity and Shadows based on Layers & Display Modes
    if (settings.showNightVision) {
      // High ambient boost for night vision
      ambientLight.intensity = 1.35;
      hemiLight.intensity = 0.6;
      dirLight.intensity = 0.35;
      dirLight.castShadow = true;
      renderer.shadowMap.enabled = true;
    } else if (settings.showOrientationAnalysis) {
      // Clean neutral architectural lighting for orientation analysis
      ambientLight.intensity = 1.0;
      hemiLight.intensity = 0.2;
      dirLight.intensity = 0.0;
      dirLight.castShadow = false;
      renderer.shadowMap.enabled = false;
    } else if (settings.showSunAnalysis) {
      // For accurate architectural solar analysis, we turn off all ambient and fill lights (Environment = 0, Ambient = 0)
      ambientLight.color.setHex(0x000000);
      ambientLight.intensity = 0.0;
      hemiLight.color.setHex(0x000000); // Turn off sky hemi light completely
      hemiLight.groundColor.setHex(0x000000);
      hemiLight.intensity = 0.0;
      dirLight.color.setHex(0xfbad40); // Soft architectural warm amber sun as the sole light source
      dirLight.intensity = 1.35;
      dirLight.castShadow = true;
      renderer.shadowMap.enabled = true;
    } else {
      // Standard lights based on displayMode
      if (mode === 'real') {
        ambientLight.intensity = 0.45;
        hemiLight.intensity = 0.4;
        dirLight.intensity = 0.65;
        dirLight.castShadow = true;
        renderer.shadowMap.enabled = true;
      } else if (mode === 'analyze') {
        ambientLight.intensity = 1.35;
        hemiLight.intensity = 0.2;
        dirLight.intensity = 0.0;
        dirLight.castShadow = false;
        renderer.shadowMap.enabled = false;
      } else if (mode === 'night-vision') {
        ambientLight.intensity = 1.25;
        hemiLight.intensity = 0.6;
        dirLight.intensity = 0.35;
        dirLight.castShadow = true;
        renderer.shadowMap.enabled = true;
      } else if (mode === 'orientation') {
        ambientLight.intensity = 1.0;
        hemiLight.intensity = 0.2;
        dirLight.intensity = 0.0;
        dirLight.castShadow = false;
        renderer.shadowMap.enabled = false;
      }
    }

    // Apply showShadow state override
    if (!showShadow) {
      dirLight.castShadow = false;
      renderer.shadowMap.enabled = false;
    }

    if (dirLight.castShadow && currentModelGroupRef.current) {
      const box = new THREE.Box3().setFromObject(currentModelGroupRef.current);
      const center = new THREE.Vector3();
      box.getCenter(center);
      dirLight.target.position.copy(center);
      dirLight.target.updateMatrixWorld();
    }

    // 2. Determine which material mode has the highest priority
    let activeMatMode: 'real' | 'analyze' | 'orientation' | 'sun' = 'real';
    if (settings.showOrientationAnalysis) {
      activeMatMode = 'orientation';
    } else if (settings.showSunAnalysis) {
      activeMatMode = 'sun';
    } else if (mode === 'analyze') {
      activeMatMode = 'analyze';
    } else if (mode === 'orientation') {
      activeMatMode = 'orientation';
    }

    // Traverse scene models and apply materials based on priority
    if (currentModelGroupRef.current) {
      currentModelGroupRef.current.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          // Save original material if not already saved
          if (!node.userData.originalMaterial) {
            node.userData.originalMaterial = node.material;
          }

          // Dispose previous temporary material if it's already a generated one
          if (node.material && node.material !== node.userData.originalMaterial) {
            if (Array.isArray(node.material)) {
              node.material.forEach((m) => m?.dispose());
            } else {
              node.material.dispose();
            }
          }

          if (activeMatMode === 'orientation') {
            node.material = new THREE.ShaderMaterial({
              transparent: false,
              depthWrite: true,
              depthTest: true,
              vertexShader: `
                varying vec3 vWorldNormal;
                void main() {
                  vWorldNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
                varying vec3 vWorldNormal;
                void main() {
                  vec3 normal = normalize(vWorldNormal);
                  vec3 color = vec3(140.0 / 255.0); // Default fallback: ±Y/±Z Gray
                  
                  if (normal.y > 0.5) {
                    color = vec3(90.0 / 255.0);   // Ceiling (+Z) Deep Gray: RGB 90, 90, 90
                  } else if (normal.y < -0.5) {
                    color = vec3(220.0 / 255.0);  // Floor (-Z) Light Gray: RGB 220, 220, 220
                  } else if (abs(normal.x) > abs(normal.z)) {
                    color = vec3(170.0 / 255.0);  // X-Wall (±X) Medium Gray: RGB 170, 170, 170
                  } else {
                    color = vec3(140.0 / 255.0);  // Y-Wall (±Z) Gray: RGB 140, 140, 140
                  }
                  
                  // Ultra-soft Lambert-style diffuse shading to show joints/corners clearly
                  // while maintaining easily readable gray levels.
                  vec3 lightDir = normalize(vec3(0.2, 1.0, 0.3));
                  float shading = 0.95 + 0.05 * dot(normal, lightDir);
                  gl_FragColor = vec4(color * shading, 1.0);
                }
              `
            });
          } else if (activeMatMode === 'sun') {
            // Highly stable, native MeshStandardMaterial for architectural sun study
            node.material = new THREE.MeshStandardMaterial({
              color: 0xfafafa, // clean off-white clay color to receive lighting & shadows clearly
              roughness: 0.9,
              metalness: 0.05,
              flatShading: false,
              shadowSide: THREE.DoubleSide
            });
            node.castShadow = true;
            node.receiveShadow = true;
          } else if (activeMatMode === 'analyze') {
            const type = node.userData.type;
            let clayColor = 0xe0e0e0;
            if (type === 'floor') {
              clayColor = 0xd1d1d1;
            } else if (type === 'wall') {
              clayColor = 0xfbfbfb;
            } else if (type === 'ceiling') {
              clayColor = 0xededed;
            }

            node.material = new THREE.MeshStandardMaterial({
              color: clayColor,
              roughness: 0.95,
              metalness: 0.05,
              flatShading: false,
            });
          } else {
            // Restore original material
            if (node.userData.originalMaterial) {
              node.material = node.userData.originalMaterial;
              node.userData.originalMaterial = undefined;
            }
          }
        }
      });
    }
  };

  // UPDATE DISPLAY MODE & ANALYSIS LAYERS LIVE
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) {
      applyDisplayMode(scene, settings.displayMode);
    }
  }, [
    settings.displayMode,
    settings.showOrientationAnalysis,
    settings.showSunAnalysis,
    settings.showNightVision,
    showShadow,
    currentSpace
  ]);

  // INITIALIZE THREE.JS SCENE (Runs ONCE on mount)
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    const runtime = new EngineRuntime();
    runtimeRef.current = runtime;

    // Ensure all engine property refs are synchronized with the active engine instance
    const activeEngine = runtime.engine;
    const sceneManager = activeEngine.threeSceneManager;
    threeSceneManagerRef.current = sceneManager;
    characterControllerRef.current = activeEngine.characterController;
    simulationLoopRef.current = activeEngine.simulationLoop;
    cameraControllerRef.current = activeEngine.cameraController;
    inputManagerRef.current = activeEngine.inputManager;
    playerPos.current = activeEngine.characterController.position;
    playerVelocity.current = activeEngine.characterController.velocity;

    runtime.initialize(canvasRef.current, containerRef.current!);
    const scene = sceneManager.scene!;
    const camera = sceneManager.camera!;
    const renderer = sceneManager.renderer!;
    
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    ambientLightRef.current = sceneManager.ambientLight;
    hemiLightRef.current = sceneManager.hemiLight;
    dirLightRef.current = sceneManager.dirLight;
    groundMeshRef.current = sceneManager.groundMesh;

    // Construct Low-poly First Person Arm Group
    const fpArmGroup = new THREE.Group();
    fpArmGroup.visible = false;

    // Material matching standard mannequin aesthetic but slightly styled
    const armMat = new THREE.MeshStandardMaterial({ 
      color: 0x3b82f6, 
      roughness: 0.6,
      metalness: 0.1
    });

    // Forearm Cylinder
    const forearmGeom = new THREE.CylinderGeometry(0.015, 0.022, 0.35, 8);
    forearmGeom.rotateX(Math.PI / 2); // Point along forward/z
    const forearm = new THREE.Mesh(forearmGeom, armMat);
    forearm.position.set(0, 0, -0.175);
    fpArmGroup.add(forearm);

    // Wrist
    const wristGeom = new THREE.SphereGeometry(0.022, 8, 8);
    const wrist = new THREE.Mesh(wristGeom, armMat);
    wrist.position.set(0, 0, -0.35);
    fpArmGroup.add(wrist);

    // Palm box
    const palmGeom = new THREE.BoxGeometry(0.05, 0.015, 0.05);
    const palm = new THREE.Mesh(palmGeom, armMat);
    palm.position.set(0, 0, -0.385);
    fpArmGroup.add(palm);

    // Light-blue accented fingers
    const fingerMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.5
    });
    const fingerGeom = new THREE.BoxGeometry(0.01, 0.008, 0.035);

    const indexFinger = new THREE.Mesh(fingerGeom, fingerMat);
    indexFinger.position.set(-0.015, 0, -0.42);
    fpArmGroup.add(indexFinger);

    const middleFinger = new THREE.Mesh(fingerGeom, fingerMat);
    middleFinger.position.set(0.015, 0, -0.42);
    fpArmGroup.add(middleFinger);

    const thumbGeom = new THREE.BoxGeometry(0.02, 0.008, 0.01);
    const thumb = new THREE.Mesh(thumbGeom, fingerMat);
    thumb.position.set(0.03, 0, -0.385);
    thumb.rotation.y = Math.PI / 4;
    fpArmGroup.add(thumb);

    camera.add(fpArmGroup);
    fpArmGroupRef.current = fpArmGroup;

    // Construct Dynamic Reach (70cm radius dome) for "E" Key animation
    const dynReachGroup = new THREE.Group();
    dynReachGroup.visible = false;

    // Inner semi-transparent solid dome
    const innerReach = new THREE.Mesh(
      new THREE.SphereGeometry(0.70, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4, // Cyan
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    dynReachGroup.add(innerReach);

    // Outer wireframe dome
    const outerReach = new THREE.Mesh(
      new THREE.SphereGeometry(0.70, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    dynReachGroup.add(outerReach);

    scene.add(dynReachGroup);
    dynReachGroupRef.current = dynReachGroup;

    // Resize observer to scale canvas with frame dynamically
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      
      window.requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const { width, height } = entries[0].contentRect;
        threeSceneManagerRef.current?.resize(width, height);
      });
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // 2. CREATE ERGONOMIC REACH SPHERE WIREFRAME
    const reachGeom = new THREE.SphereGeometry(1, 16, 12);
    const reachMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Cyan
      wireframe: true,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const reachSphere = new THREE.Mesh(reachGeom, reachMat);
    reachSphere.visible = false;
    scene.add(reachSphere);
    reachSphereRef.current = reachSphere;

    // 3. CREATE CLEARANCE ENVELOPE CYLINDER WIREFRAME
    const cylGeom = new THREE.CylinderGeometry(0.5, 0.5, 2, 16, 2, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, // Blue
      wireframe: true,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const clearanceCylinder = new THREE.Mesh(cylGeom, cylMat);
    clearanceCylinder.visible = false;
    scene.add(clearanceCylinder);
    clearanceCylinderRef.current = clearanceCylinder;

    // 5. INITIALIZE SPATIAL MEASUREMENT ENGINE USING THE PHI WALK ANALYSIS FRAMEWORK
    const measureEngine = new SpatialMeasurementEngine();
    measureEngineRef.current = measureEngine;

    EngineRegistry.getInstance().register(measureEngine);
    pluginRegistry.register(new AnalysisEnginePluginAdapter(measureEngine));

    // 5a. INITIALIZE SOLAR ENGINE USING THE PHI WALK ANALYSIS FRAMEWORK
    const solarEngine = new SolarEngine();
    solarEngineRef.current = solarEngine;

    EngineRegistry.getInstance().register(solarEngine);
    pluginRegistry.register(new AnalysisEnginePluginAdapter(solarEngine));

    // 5c. INITIALIZE WIND ENGINE USING THE PHI WALK ANALYSIS FRAMEWORK
    const windEngine = new WindEngine();
    windEngineRef.current = windEngine;

    EngineRegistry.getInstance().register(windEngine);
    pluginRegistry.register(new AnalysisEnginePluginAdapter(windEngine));
    EngineRegistry.getInstance().initializeAll(scene, camera, renderer);

    createAnalysisEnvironmentObjects(scene);

    // 4. CREATE PROCEDURAL 3D AVATAR GROUP (Torso, head, wheelchair, directions)
    const avatarGroup = new THREE.Group();
    avatarGroup.visible = false;

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 }));
    head.name = 'mannequin_head';
    head.position.y = 1.5;
    avatarGroup.add(head);

    // Torso (Mannequin body)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.8), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 }));
    torso.name = 'mannequin_torso';
    torso.position.y = 1.0;
    avatarGroup.add(torso);

    // Shoulders (左右肩膀)
    const shoulders = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.1, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 })
    );
    shoulders.name = 'mannequin_shoulders';
    shoulders.position.y = 1.35;
    avatarGroup.add(shoulders);

    // Chest Direction Arrow (胸前方向箭頭, pointing forward in +Z direction)
    const chestArrowGroup = new THREE.Group();
    chestArrowGroup.name = 'mannequin_chest_arrow';
    
    const chestArrowShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.1 })
    );
    chestArrowShaft.rotation.x = Math.PI / 2;
    chestArrowShaft.position.set(0, 0, 0.075);

    const chestArrowTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.1 })
    );
    chestArrowTip.rotation.x = Math.PI / 2;
    chestArrowTip.position.set(0, 0, 0.2);

    chestArrowGroup.add(chestArrowShaft);
    chestArrowGroup.add(chestArrowTip);
    avatarGroup.add(chestArrowGroup);

    // Floor Direction Arrow (腳下前向箭頭, pointing forward in +Z direction)
    const floorArrowGroup = new THREE.Group();
    floorArrowGroup.name = 'mannequin_floor_arrow';

    const floorArrowShaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.005, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.8 })
    );
    floorArrowShaft.position.set(0, 0.0025, 0.15);

    const floorArrowTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.18, 4),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.8 })
    );
    floorArrowTip.rotation.x = Math.PI / 2;
    floorArrowTip.scale.y = 0.03; // Flatten it along the vertical axis
    floorArrowTip.position.set(0, 0.0025, 0.36);

    floorArrowGroup.add(floorArrowShaft);
    floorArrowGroup.add(floorArrowTip);
    floorArrowGroup.position.y = 0.01;
    avatarGroup.add(floorArrowGroup);

    // 4b. Lower Body Legs (下肢 - simple standing cylinder legs)
    const legGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.425, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    
    const leftLeg = new THREE.Mesh(legGeom, legMat);
    leftLeg.name = 'mannequin_left_leg';
    leftLeg.position.set(-0.08, 0.2125, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    avatarGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeom, legMat);
    rightLeg.name = 'mannequin_right_leg';
    rightLeg.position.set(0.08, 0.2125, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    avatarGroup.add(rightLeg);

    // 4c. Footprint (腳底站立範圍矩形 - simple flat box)
    const footprintGeom = new THREE.BoxGeometry(0.45, 0.005, 0.3);
    const footprintMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
    const footprint = new THREE.Mesh(footprintGeom, footprintMat);
    footprint.name = 'mannequin_footprint';
    footprint.position.set(0, 0.0025, 0);
    footprint.receiveShadow = true;
    avatarGroup.add(footprint);

    // 4d. Standing Reference Circle (人體基準圈 - light ring and subtle filled disc)
    const standingCircleGroup = new THREE.Group();
    standingCircleGroup.name = 'mannequin_standing_circle';

    const standingCircleGeom = new THREE.RingGeometry(0.29, 0.30, 48);
    const standingCircleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // beautiful light sky blue
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const standingCircleOuter = new THREE.Mesh(standingCircleGeom, standingCircleMat);
    standingCircleOuter.rotation.x = -Math.PI / 2;
    standingCircleOuter.position.y = 0.006;
    standingCircleGroup.add(standingCircleOuter);

    const innerCircleGeom = new THREE.CircleGeometry(0.29, 32);
    const innerCircleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const standingCircleInner = new THREE.Mesh(innerCircleGeom, innerCircleMat);
    standingCircleInner.rotation.x = -Math.PI / 2;
    standingCircleInner.position.y = 0.005;
    standingCircleGroup.add(standingCircleInner);

    avatarGroup.add(standingCircleGroup);

    // Procedural Wheelchair Group
    const wheelchairGroup = new THREE.Group();
    wheelchairGroup.name = 'wheelchair_chassis';

    // Wheels (Left & Right)
    const wheelGeom = new THREE.TorusGeometry(0.32, 0.02, 6, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.9, roughness: 0.2 });
    
    const leftWheel = new THREE.Mesh(wheelGeom, wheelMat);
    leftWheel.position.set(-0.35, 0.32, 0);
    leftWheel.rotation.y = Math.PI / 2;
    wheelchairGroup.add(leftWheel);

    const rightWheel = new THREE.Mesh(wheelGeom, wheelMat);
    rightWheel.position.set(0.35, 0.32, 0);
    rightWheel.rotation.y = Math.PI / 2;
    wheelchairGroup.add(rightWheel);

    // Seat Box
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 }));
    seat.position.set(0, 0.45, -0.05);
    wheelchairGroup.add(seat);

    // Backrest Box
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 }));
    backrest.position.set(0, 0.75, -0.3);
    wheelchairGroup.add(backrest);

    avatarGroup.add(wheelchairGroup);
    scene.add(avatarGroup);
    avatarGroupRef.current = avatarGroup;

    // Reset player position initially
    resetPlayerPosition();

    return () => {
      resizeObserver.disconnect();
      if (measureEngineRef.current) {
        pluginRegistry.unregister('measure-engine');
        EngineRegistry.getInstance().unregister('measure-engine');
        measureEngineRef.current = null;
      }
      if (solarEngineRef.current) {
        pluginRegistry.unregister('solar-engine');
        EngineRegistry.getInstance().unregister('solar-engine');
        solarEngineRef.current = null;
      }
      if (windEngineRef.current) {
        pluginRegistry.unregister('wind-engine');
        EngineRegistry.getInstance().unregister('wind-engine');
        windEngineRef.current = null;
      }
      cleanupEnvironmentObjects();
      disposeSimulatorObject3D(fpArmGroupRef.current);
      fpArmGroupRef.current = null;
      disposeSimulatorObject3D(dynReachGroupRef.current);
      dynReachGroupRef.current = null;
      disposeSimulatorObject3D(reachSphereRef.current);
      reachSphereRef.current = null;
      disposeSimulatorObject3D(clearanceCylinderRef.current);
      clearanceCylinderRef.current = null;
      disposeSimulatorObject3D(avatarGroupRef.current);
      avatarGroupRef.current = null;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      threeSceneManagerRef.current = null;
      characterControllerRef.current = null;
      simulationLoopRef.current = null;
      cameraControllerRef.current = null;
      inputManagerRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // LOAD ARCHITECTURAL MODEL (When space selection changes or custom file drops)
  useEffect(() => {
    const scene = sceneRef.current;
    const sceneManager = threeSceneManagerRef.current;
    if (!scene || !sceneManager) return;

    onLoadingStateChange(true);
    setLoadError(null);

    // Clear previous model
    sceneManager.unloadModel();
    currentModelGroupRef.current = null;
    cachedCollidableMeshesRef.current = [];

    const loadComplete = (group: THREE.Group, metadata: ModelFileInfo) => {
      sceneManager.currentModelGroup = group;
      currentModelGroupRef.current = group;
      cachedCollidableMeshesRef.current = [];
      applyDisplayMode(scene, settings.displayMode);
      onModelLoaded(metadata);
      onLoadingStateChange(false);
      resetPlayerPosition();
      updateGroundPlane();
    };

    const loadFail = (err: any) => {
      console.error(err);
      setLoadError('無法載入此 3D 模型，請確保檔案格式正確 (無損壞且為支援之延伸模組)。');
      onLoadingStateChange(false);
      // Fallback to corridor
      onSettingsChange({ presetId: 'adult' });
    };

    // Case 1: Procedural Apartment
    if (currentSpace === 'apartment') {
      const group = buildApartment(scene);
      loadComplete(group, {
        name: '住宅公寓 (Procedural Apartment)',
        size: 'Procedural',
        meshCount: group.children.length,
        vertexCount: 0,
        dimensions: { x: 11.7, y: 2.8, z: 14 },
      });
    }
    // Case 2: Procedural Gallery
    else if (currentSpace === 'gallery') {
      const group = buildGallery(scene);
      loadComplete(group, {
        name: '挑高展覽大廳 (Exhibition Gallery)',
        size: 'Procedural',
        meshCount: group.children.length,
        vertexCount: 0,
        dimensions: { x: 15, y: 6.0, z: 20 },
      });
    }
    // Case 3: Procedural Interactive Corridor
    else if (currentSpace === 'corridor') {
      const group = buildInteractiveCorridor(scene, corridorWidth, corridorHeight);
      loadComplete(group, {
        name: '可變通道 (Interactive Corridor)',
        size: 'Procedural',
        meshCount: group.children.length,
        vertexCount: 0,
        dimensions: { x: corridorWidth, y: corridorHeight, z: 12 },
      });
    }
    // Case 4: Uploaded Custom Model (GLTF, GLB, FBX, OBJ)
    else if (currentSpace === 'uploaded' && uploadedFile) {
      const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
      const fileUrl = URL.createObjectURL(uploadedFile);

      const processLoadedModel = (obj: THREE.Group | THREE.Scene) => {
        const loadedGroup = new THREE.Group();
        loadedGroup.name = 'uploaded_model';
        loadedGroup.add(obj);

        let vertexCount = 0;
        let meshCount = 0;

        // Auto-analyse normals and classify for gravity & raycast collisions
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.geometry) {
              child.geometry.computeVertexNormals();
              child.geometry.computeBoundingBox();
              vertexCount += child.geometry.attributes.position.count;
            }

            // If user did not provide tagged metadata (standard files don't),
            // auto-classify based on surface normals.
            // Vertices with Up normal (y > 0.7) are floors; Down normal (y < -0.7) are ceilings; horizontal are walls.
            // Default to 'wall' for raycast fallback
            child.userData = { type: 'wall', roomName: '自訂匯入區域 (Imported Area)' };
            
            // Analyze average normal
            if (child.geometry && child.geometry.index) {
              // Standard approach: check bounding box normal orientation
              const bbox = child.geometry.boundingBox;
              if (bbox) {
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const normalY = new THREE.Vector3(0, 1, 0).applyQuaternion(child.quaternion);
                
                if (Math.abs(normalY.y) > 0.85) {
                  // Flat surface
                  if (child.position.y < 0.15) {
                    child.userData.type = 'floor';
                  } else {
                    child.userData.type = 'ceiling';
                  }
                } else if (size.y < 0.15) {
                  child.userData.type = 'floor';
                }
              }
            } else if (child.geometry) {
              // Check height to classify simple floor
              const bbox = child.geometry.boundingBox;
              if (bbox) {
                const size = new THREE.Vector3();
                bbox.getSize(size);
                if (size.y < 0.2 && child.position.y < 0.5) {
                  child.userData.type = 'floor';
                } else if (size.y < 0.2 && child.position.y > 1.8) {
                  child.userData.type = 'ceiling';
                }
              }
            }
          }
        });

        // Compute raw unscaled model dimensions
        const rawBox = new THREE.Box3().setFromObject(loadedGroup);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);
        const rawCenter = new THREE.Vector3();
        rawBox.getCenter(rawCenter);

        loadedGroup.userData.rawBox = rawBox;
        loadedGroup.userData.rawSize = rawSize;
        loadedGroup.userData.rawCenter = rawCenter;
        loadedGroup.userData.vertexCount = vertexCount;

        // Auto-detect unit based on height (rawSize.y)
        let detected: ModelUnit = 'm';
        if (rawSize.y > 1000) {
          detected = 'mm';
        } else if (rawSize.y > 80) {
          detected = 'cm';
        } else if (rawSize.y > 15) {
          detected = 'ft';
        } else {
          detected = 'm';
        }

        // Show auto-detect prompt to user
        setDetectedUnit(detected);
        setDetectedDimensions({ x: rawSize.x, y: rawSize.y, z: rawSize.z });

        const scale = UNIT_FACTORS[settings.modelUnit];
        loadedGroup.scale.set(scale, scale, scale);

        // Re-align so lowest point rests on y = 0 for perfect floor snapping
        const reBox = new THREE.Box3().setFromObject(loadedGroup);
        const reMin = reBox.min;
        loadedGroup.position.set(-rawCenter.x * scale, -reMin.y, -rawCenter.z * scale);

        scene.add(loadedGroup);

        const metadata: ModelFileInfo = {
          name: uploadedFile.name,
          size: `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`,
          meshCount,
          vertexCount,
          dimensions: { x: rawSize.x * scale, y: rawSize.y * scale, z: rawSize.z * scale },
          rawDimensions: { x: rawSize.x, y: rawSize.y, z: rawSize.z }
        };

        loadComplete(loadedGroup, metadata);
        URL.revokeObjectURL(fileUrl);
      };

      if (extension === 'gltf' || extension === 'glb') {
        const loader = sceneManager.gltfLoader;
        loader.load(fileUrl, (gltf) => {
          processLoadedModel(gltf.scene);
        }, undefined, loadFail);
      } else if (extension === 'obj') {
        const loader = sceneManager.objLoader;
        loader.load(fileUrl, (obj) => {
          processLoadedModel(obj);
        }, undefined, loadFail);
      } else if (extension === 'fbx') {
        const loader = sceneManager.fbxLoader;
        loader.load(fileUrl, (fbx) => {
          processLoadedModel(fbx);
        }, undefined, loadFail);
      } else {
        loadFail('不支援的檔案格式');
      }
    }
  }, [currentSpace, uploadedFile]);

  // UPDATE SCALE LIVE WHEN MODEL UNIT CHANGES OR CUSTOM DETECTED UNIT SORTS
  useEffect(() => {
    const scene = sceneRef.current;
    const group = currentModelGroupRef.current;
    if (!scene || !group) return;

    const scale = UNIT_FACTORS[settings.modelUnit];
    group.scale.set(scale, scale, scale);

    // Re-align positioning so lowest point rests on y = 0
    const rawCenter = group.userData.rawCenter as THREE.Vector3;
    const rawBox = group.userData.rawBox as THREE.Box3;
    if (rawCenter && rawBox) {
      const reMinY = rawBox.min.y * scale;
      group.position.set(-rawCenter.x * scale, -reMinY, -rawCenter.z * scale);
    }

    // Update metadata dimensions
    const rawSize = group.userData.rawSize as THREE.Vector3;
    if (rawSize) {
      onModelLoaded({
        name: currentSpace === 'uploaded' ? (uploadedFile?.name || '自訂模型') : 
              currentSpace === 'apartment' ? '住宅公寓 (Procedural Apartment)' :
              currentSpace === 'gallery' ? '挑高展覽大廳 (Exhibition Gallery)' : '可變通道 (Interactive Corridor)',
        size: currentSpace === 'uploaded' ? `${((uploadedFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB` : 'Procedural',
        meshCount: group.children.length,
        vertexCount: group.userData.vertexCount || 0,
        dimensions: { x: rawSize.x * scale, y: rawSize.y * scale, z: rawSize.z * scale },
        rawDimensions: { x: rawSize.x, y: rawSize.y, z: rawSize.z }
      });
    }

    // Reset player to the correct spawn point when unit changes
    resetPlayerPosition();
    updateGroundPlane();
  }, [settings.modelUnit, currentSpace]);

  // UPDATE INTERACTIVE CORRIDOR LIVE RESIZING
  useEffect(() => {
    const scene = sceneRef.current;
    if (currentSpace === 'corridor' && scene) {
      buildInteractiveCorridor(scene, corridorWidth, corridorHeight);
      
      // Update metadata dimension
      onModelLoaded({
        name: '可變通道 (Interactive Corridor)',
        size: 'Procedural',
        meshCount: 15,
        vertexCount: 0,
        dimensions: { x: corridorWidth, y: corridorHeight, z: 12 },
      });
      updateGroundPlane();
    }
  }, [corridorWidth, corridorHeight, currentSpace]);

  // UPDATE MODEL ROTATION BASED ON ANALYSIS MODE & MODEL ROTATION SETTINGS
  useEffect(() => {
    const group = currentModelGroupRef.current;
    if (!group) return;

    if (settings.analysisMode === 'solar') {
      group.rotation.y = 0;
    } else {
      group.rotation.y = (settings.modelRotation || 0) * (Math.PI / 180);
    }
  }, [settings.analysisMode, settings.modelRotation, currentSpace]);

  // UPDATE GROUND PLANE DYNAMICALLY WHEN SITE MARGIN CHANGES
  useEffect(() => {
    updateGroundPlane();
  }, [settings.siteMargin]);

  // MAIN RUNTIME ANIMATION LOOP (Physics, raycast telemetry, rendering, visual aids)
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const runtime = runtimeRef.current;
    const characterController = characterControllerRef.current;
    const cameraController = cameraControllerRef.current;
    const inputManager = inputManagerRef.current;
    const simulationLoop = simulationLoopRef.current;

    if (!scene || !camera || !renderer || !runtime || !characterController || !cameraController || !inputManager || !simulationLoop) return;

    runtime.start((dt, isPaused) => {
      const context: SimulationContext = {
        scene,
        camera,
        renderer,
        settings,
        activeKeys,
        isLocked: isLockedRef.current,
        isTabCursorMode: isTabCursorModeRef.current,
        showCharacterModal: showCharacterModalRef.current,
        showSetupConfirm: showSetupConfirmRef.current,
        currentSpace,
        
        playerPos: playerPos.current,
        playerVelocity: playerVelocity.current,
        cameraYaw,
        cameraPitch,
        avatarYaw: avatarYawRef,
        currentEyeHeight,
        
        characterController,
        cameraController,
        inputManager,
        
        cachedCollidableMeshes: cachedCollidableMeshesRef,
        currentModelGroup: currentModelGroupRef.current,
        avatarGroup: avatarGroupRef.current,
        clearanceCylinder: clearanceCylinderRef.current,
        reachSphere: reachSphereRef.current,
        fpArmGroup: fpArmGroupRef.current,
        dynReachGroup: dynReachGroupRef.current,
        sunGroup: sunGroupRef.current,
        dirLight: dirLightRef.current,
        ambientLight: ambientLightRef.current,
        hemiLight: hemiLightRef.current,
        windGroup: windGroupRef.current,
        accessibilityGroup: accessibilityGroupRef.current,
        turningCircle: turningCircleRef.current,
        
        analysisEyeLevelEnabled,
        analysisCeilingHeightEnabled,
        analysisWalkwayWidthEnabled,
        analysisWallDistanceEnabled,
        analysisEyeRayEnabled,
        analysisDimensionLabelsEnabled,
        analysisMeasureArrowEnabled,
        playerDirectionArrowEnabled,
        playerEnvelopeEnabled,
        sceneSunEnabled,
        sceneSunPathEnabled,
        sceneSkyEnabled,
        windSpeed,
        windAngle,
        isTimePlaying: isTimePlayingRef.current,
        timeSpeed: timeSpeedRef.current,
        
        onSettingsChange,
        onTelemetryUpdate,
        setPlayerHeading,
        setPlayerPitch,
        setSunAzimuthDeg,
        metricsCache,
        performanceProfiler: PerformanceProfiler,
      };

      if (isPaused) {
        renderer.render(scene, camera);
      } else {
        simulationLoop.update(dt, context);
      }
    });

    return () => {
      runtime.stop();
    };
  }, [
    settings,
    activeKeys,
    currentSpace,
    analysisEyeLevelEnabled,
    analysisCeilingHeightEnabled,
    analysisWalkwayWidthEnabled,
    analysisWallDistanceEnabled,
    analysisEyeRayEnabled,
    analysisDimensionLabelsEnabled,
    analysisMeasureArrowEnabled,
    playerEnvelopeEnabled,
    playerDirectionArrowEnabled,
    playerCrosshairEnabled,
    windSpeed,
    windAngle,
    onSettingsChange,
    onTelemetryUpdate,
  ]);

  return (
    <div 
      ref={containerRef} 
      className="relative flex-1 bg-bg-darker border border-border-dark rounded-none overflow-hidden flex items-stretch select-none"
    >
      <canvas 
        ref={canvasRef} 
        onClick={requestPointerLock}
        className="w-full h-full cursor-crosshair focus:outline-none"
      />

      {/* POINTER LOCK OVERLAY INSTRUCTIONS */}
      {!isLocked && !isTabCursorMode && !settings.showFloatingPanel && !showTimeControl && !showCharacterModal && !showSetupConfirm && (
        <div 
          onClick={requestPointerLock}
          className="absolute inset-0 bg-bg-darker/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 cursor-pointer group transition-all"
        >
          <div className="w-14 h-14 bg-brand/10 border border-brand/25 flex items-center justify-center text-brand mb-4 group-hover:scale-105 transition-all animate-pulse">
            <MousePointer size={24} />
          </div>
          <h3 className="text-stone-100 font-bold text-sm tracking-widest uppercase font-mono">
            CLICK TO LOCK CURSOR & START SIMULATION
          </h3>
          <p className="text-xs text-stone-400 mt-2 max-w-sm leading-relaxed font-sans">
            滑鼠指標會被隱藏，直接移動滑鼠可擺動視角。
            <br />
            按 <span className="font-mono bg-bg-mid px-1.5 py-0.5 border border-border-dark text-stone-200">W, A, S, D</span> 進行前後左右移動行走。
            <br />
            按 <span className="font-mono bg-bg-mid px-1.5 py-0.5 border border-border-dark text-stone-200">ESC</span> 鍵隨時退出鎖定。
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-brand/90 font-mono bg-brand/5 border border-brand/20 px-3 py-1.5 uppercase tracking-wider">
            <Zap size={11} />
            <span>[1:1 Human Scale Spatial Simulator Ready]</span>
          </div>
        </div>
      )}

      <LoadingOverlay 
        detectedUnit={detectedUnit} 
        detectedDimensions={detectedDimensions} 
        setDetectedUnit={setDetectedUnit} 
        loadError={loadError} 
        setLoadError={setLoadError} 
        onSettingsChange={onSettingsChange} 
      />

      {/* HUD CROSSHAIR CENTRE DOT */}
      {playerCrosshairEnabled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none">
          {/* Central Dot */}
          <div className="w-1.5 h-1.5 bg-brand rounded-full shadow-md shadow-brand/40"></div>
          {/* Reticle Ring */}
          <div className="absolute w-6 h-6 border border-brand/35 rounded-full"></div>
          {/* Outer Ring */}
          <div className="absolute w-12 h-12 border border-dashed border-brand/15 rounded-full animate-spin-slow"></div>
          {/* Hairlines */}
          <div className="absolute w-[1.5px] h-2.5 bg-brand/40 -translate-y-3"></div>
          <div className="absolute w-[1.5px] h-2.5 bg-brand/40 translate-y-3"></div>
          <div className="absolute w-2.5 h-[1.5px] bg-brand/40 -translate-x-3"></div>
          <div className="absolute w-2.5 h-[1.5px] bg-brand/40 translate-x-3"></div>
        </div>
      )}

      <AnalysisOverlay 
        settings={settings} 
        playerHeading={playerHeading} 
        sunAzimuthDeg={sunAzimuthDeg} 
      />

      {/* FLOATING ANALYSIS PANEL (DOCK) */}
      {false && settings.showFloatingPanel && (
        <div 
          className="absolute top-4 right-4 bottom-14 w-80 bg-bg-darker/95 border border-border-dark/80 shadow-2xl rounded-sm flex flex-col z-30 pointer-events-auto overflow-hidden animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-10 bg-bg-dark border-b border-border-dark/80 px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-brand animate-pulse"></div>
              <span className="text-xs font-bold font-mono tracking-wider text-stone-200">FLOATING ANALYSIS DOCK</span>
            </div>
            <button 
              onClick={() => onSettingsChange({ showFloatingPanel: false })}
              className="text-[10px] text-stone-500 hover:text-stone-300 font-mono border border-border-dark/60 hover:border-stone-500 px-1.5 py-0.5 rounded-sm cursor-pointer transition-colors"
            >
              [Tab] CLOSE
            </button>
          </div>

          {/* Dock Content Scroll Container - TEST */}
          <div className="flex-1 overflow-y-auto divide-y divide-border-dark/40 font-sans">
            
            {/* 1. SOLAR STUDY SECTION */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setActiveDockSection('solar');
                  onSettingsChange({ 
                    analysisMode: 'solar',
                    showSunAnalysis: true,
                    showOrientationAnalysis: false
                  });
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-all ${
                  activeDockSection === 'solar' 
                    ? 'bg-brand/10 border-l-2 border-brand text-brand font-bold' 
                    : 'bg-bg-dark/20 text-stone-400 hover:bg-bg-mid/30 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Sun size={14} className={activeDockSection === 'solar' ? "text-brand" : "text-stone-400"} />
                  <span>☀ SOLAR STUDY (日照分析)</span>
                </div>
                <span className="text-[9px] text-stone-600 font-mono font-normal">
                  {activeDockSection === 'solar' ? 'EXPANDED' : 'COLLAPSED'}
                </span>
              </button>

              {activeDockSection === 'solar' && (
                <div className="p-3 bg-bg-darker/60 space-y-3 text-xs animate-fade-in">
                  
                  {/* Preset Locations */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-stone-500 uppercase tracking-wider block">基地預設位置 (Location Preset)</label>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { name: '台北 (Taipei)', lat: 25.0330, lng: 121.5654, tz: 8 },
                        { name: '東京 (Tokyo)', lat: 35.6762, lng: 139.6503, tz: 9 },
                        { name: '倫敦 (London)', lat: 51.5074, lng: -0.1278, tz: 0 },
                        { name: '紐約 (New York)', lat: 40.7128, lng: -74.0060, tz: -5 },
                      ].map((loc) => (
                        <button
                          key={loc.name}
                          type="button"
                          onClick={() => onSettingsChange({
                            latitude: loc.lat,
                            longitude: loc.lng,
                            timezone: loc.tz,
                            siteName: loc.name.split(' ')[0]
                          })}
                          className="px-2 py-1 bg-bg-dark border border-border-dark/60 hover:bg-bg-mid/40 hover:border-brand/50 text-[10px] text-stone-300 rounded-sm cursor-pointer transition-all"
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Input */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-stone-500 flex items-center gap-1">
                      <Calendar size={11} className="text-stone-500" />
                      <span>模擬日期 (Study Date)</span>
                    </label>
                    <input
                      type="date"
                      value={settings.analysisDate}
                      onChange={(e) => onSettingsChange({ analysisDate: e.target.value })}
                      className="w-full bg-bg-dark border border-border-dark px-2 py-1 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-[11px]"
                    />
                  </div>

                  {/* Time Slider & Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] text-stone-500 flex items-center gap-1">
                        <Clock size={11} className="text-stone-500" />
                        <span>模擬時間 (Study Time)</span>
                      </label>
                      <input
                        type="time"
                        value={settings.analysisTime}
                        onChange={(e) => onSettingsChange({ analysisTime: e.target.value })}
                        className="bg-bg-dark border border-border-dark px-1.5 py-0.5 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-[10px] w-16 text-center font-mono"
                      />
                    </div>
                    {/* Continuous slider for smooth dragging */}
                    <input
                      type="range"
                      min="0"
                      max="23.98"
                      step="0.05"
                      value={(() => {
                        const [h, m] = settings.analysisTime.split(':').map(Number);
                        return h + (m / 60);
                      })()}
                      onChange={(e) => {
                        const hours = parseFloat(e.target.value);
                        const h = Math.floor(hours);
                        const m = Math.floor((hours - h) * 60);
                        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        onSettingsChange({ analysisTime: timeStr });
                      }}
                      className="w-full accent-brand h-1 bg-bg-dark appearance-none cursor-pointer mt-1.5"
                    />
                    <div className="flex justify-between text-[8px] text-stone-500 font-mono">
                      <span>00:00 (Midnight)</span>
                      <span>12:00 (Noon)</span>
                      <span>23:59</span>
                    </div>
                  </div>

                  {/* Latitude & Longitude decimal sliders & Numerical Inputs */}
                  <div className="space-y-3 border-t border-border-dark/30 pt-2.5">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Latitude */}
                      <div className="space-y-1 flex flex-col">
                        <label className="text-stone-500 text-[9px] block font-mono">緯度 LAT (-90~90)</label>
                        <input
                          type="number"
                          min="-90"
                          max="90"
                          step="0.0001"
                          value={settings.latitude}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              onSettingsChange({ latitude: 0 });
                              return;
                            }
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              onSettingsChange({ latitude: Math.max(-90, Math.min(90, val)) });
                            }
                          }}
                          className="w-full bg-bg-dark text-stone-200 border border-border-dark/60 rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:border-brand"
                        />
                        <input
                          type="range"
                          min="-90"
                          max="90"
                          step="0.01"
                          value={settings.latitude}
                          onChange={(e) => onSettingsChange({ latitude: parseFloat(e.target.value) })}
                          className="w-full accent-brand h-1 bg-bg-dark appearance-none cursor-pointer mt-1"
                        />
                      </div>
                      {/* Longitude */}
                      <div className="space-y-1 flex flex-col">
                        <label className="text-stone-500 text-[9px] block font-mono font-mono">經度 LNG (-180~180)</label>
                        <input
                          type="number"
                          min="-180"
                          max="180"
                          step="0.0001"
                          value={settings.longitude}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              onSettingsChange({ longitude: 0 });
                              return;
                            }
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              onSettingsChange({ longitude: Math.max(-180, Math.min(180, val)) });
                            }
                          }}
                          className="w-full bg-bg-dark text-stone-200 border border-border-dark/60 rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:border-brand"
                        />
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="0.01"
                          value={settings.longitude}
                          onChange={(e) => onSettingsChange({ longitude: parseFloat(e.target.value) })}
                          className="w-full accent-brand h-1 bg-bg-dark appearance-none cursor-pointer mt-1"
                        />
                      </div>
                    </div>

                    {/* Paste Coordinates Row */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            const matches = text.match(/(-?\d+(?:\.\d+)?)\s*[\s,]\s*(-?\d+(?:\.\d+)?)/);
                            if (matches && matches.length >= 3) {
                              const lat = parseFloat(matches[1]);
                              const lng = parseFloat(matches[2]);
                              if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                onSettingsChange({
                                  latitude: lat,
                                  longitude: lng,
                                  siteName: 'Custom'
                                });
                              } else {
                                alert(`經緯度超出範圍 (Parsed coordinates out of bounds): Lat ${lat}, Lng ${lng}. (Valid: Lat [-90,90], Lng [-180,180])`);
                              }
                            } else {
                              alert("無法解析剪貼簿內容。請確保剪貼簿中包含兩個經緯度數字，格式如 (Cannot parse clipboard): 23.6959,120.5346");
                            }
                          } catch (err) {
                            const input = prompt("請貼上經緯度 (Please paste coordinates, e.g., 23.6959,120.5346):");
                            if (input) {
                              const matches = input.match(/(-?\d+(?:\.\d+)?)\s*[\s,]\s*(-?\d+(?:\.\d+)?)/);
                              if (matches && matches.length >= 3) {
                                const lat = parseFloat(matches[1]);
                                const lng = parseFloat(matches[2]);
                                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                  onSettingsChange({
                                    latitude: lat,
                                    longitude: lng,
                                    siteName: 'Custom'
                                  });
                                } else {
                                  alert(`經緯度超出範圍 (Invalid coordinate bounds): Lat ${lat}, Lng ${lng}`);
                                }
                              } else {
                                alert("無法解析經緯度 (Could not parse coordinates).");
                              }
                            }
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-bg-dark/60 hover:bg-bg-mid border border-border-dark/60 hover:border-brand/40 text-[10px] font-mono text-stone-300 hover:text-brand rounded transition-all cursor-pointer"
                      >
                        <span>📋 Paste Coordinates (貼上經緯度)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. ORIENTATION STUDY SECTION */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setActiveDockSection('orientation');
                  onSettingsChange({ 
                    analysisMode: 'orientation',
                    showSunAnalysis: false,
                    showOrientationAnalysis: true
                  });
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-all ${
                  activeDockSection === 'orientation' 
                    ? 'bg-brand/10 border-l-2 border-brand text-brand font-bold' 
                    : 'bg-bg-dark/20 text-stone-400 hover:bg-bg-mid/30 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Compass size={14} className={activeDockSection === 'orientation' ? "text-brand" : "text-stone-400"} />
                  <span>🧭 ORIENTATION (朝向分析)</span>
                </div>
                <span className="text-[9px] text-stone-600 font-mono font-normal">
                  {activeDockSection === 'orientation' ? 'EXPANDED' : 'COLLAPSED'}
                </span>
              </button>

              {activeDockSection === 'orientation' && (
                <div className="p-3 bg-bg-darker/60 space-y-3 text-xs animate-fade-in">
                  
                  {/* Interactive compass dial */}
                  <div className="flex flex-col items-center justify-center space-y-1.5 p-2 bg-bg-dark/40 border border-border-dark/65 rounded-sm">
                    <span className="text-[9px] text-stone-500 uppercase tracking-wider block text-center">拖曳羅盤旋轉建築<br />(Drag Compass)</span>
                    
                    <div className="relative w-28 h-28 flex items-center justify-center bg-bg-darker rounded-full border border-border-dark/80 shadow-inner">
                      <svg
                        ref={panelCompassRef}
                        onMouseDown={handlePanelCompassMouseDown}
                        className="w-full h-full cursor-pointer select-none overflow-visible"
                        viewBox="0 0 120 120"
                      >
                        <circle cx="60" cy="60" r="50" className="fill-none stroke-stone-800/80 stroke-1" />
                        <circle cx="60" cy="60" r="44" className="fill-none stroke-stone-800 stroke-[1.5px]" />
                        <circle cx="60" cy="60" r="3" className="fill-brand stroke-none" />

                        <line x1="60" y1="12" x2="60" y2="108" className="stroke-stone-800/30 stroke-1" strokeDasharray="1 2" />
                        <line x1="12" y1="60" x2="108" y2="60" className="stroke-stone-800/30 stroke-1" strokeDasharray="1 2" />

                        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
                          const rad = (deg - 90) * Math.PI / 180;
                          const x1 = 60 + Math.cos(rad) * 44;
                          const y1 = 60 + Math.sin(rad) * 44;
                          const x2 = 60 + Math.cos(rad) * (deg % 90 === 0 ? 38 : 41);
                          const y2 = 60 + Math.sin(rad) * (deg % 90 === 0 ? 38 : 41);
                          return (
                            <line
                              key={deg}
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              className={deg % 90 === 0 ? "stroke-brand/40 stroke-1" : "stroke-stone-800 stroke-[0.5px]"}
                            />
                          );
                        })}

                        <text x="60" y="22" className="text-[10px] font-bold fill-stone-400 font-sans" textAnchor="middle">N</text>
                        <text x="100" y="63.5" className="text-[10px] font-bold fill-stone-400 font-sans" textAnchor="middle">E</text>
                        <text x="60" y="105" className="text-[10px] font-bold fill-stone-400 font-sans" textAnchor="middle">S</text>
                        <text x="21" y="63.5" className="text-[10px] font-bold fill-stone-400 font-sans" textAnchor="middle">W</text>

                        {(() => {
                          const rAngle = (settings.modelRotation || 0);
                          const rad = (rAngle - 90) * Math.PI / 180;
                          const pointerLength = 36;
                          const px = 60 + Math.cos(rad) * pointerLength;
                          const py = 60 + Math.sin(rad) * pointerLength;
                          return (
                            <g>
                              <circle cx="60" cy="60" r={pointerLength} className="fill-none stroke-brand/5 stroke-1" />
                              <line x1="60" y1="60" x2={px} y2={py} className="stroke-brand stroke-[1.5px]" strokeLinecap="round" />
                              <polygon
                                points={`${px},${py} ${px - Math.cos(rad - 0.4) * 6},${py - Math.sin(rad - 0.4) * 6} ${px - Math.cos(rad + 0.4) * 6},${py - Math.sin(rad + 0.4) * 6}`}
                                className="fill-brand stroke-none"
                              />
                            </g>
                          );
                        })()}
                      </svg>

                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '30px' }}>
                        <span className="text-[9px] bg-bg-dark border border-border-dark/80 px-1 py-0.5 rounded font-bold text-brand font-mono">
                          {settings.modelRotation || 0}°
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Slider & Reset Button */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-stone-500 font-medium">朝向角度 (Model Rotation)</span>
                      <button
                        type="button"
                        onClick={() => onSettingsChange({ modelRotation: 0 })}
                        className="text-brand flex items-center gap-1 hover:underline cursor-pointer font-bold"
                      >
                        <RotateCcw size={10} />
                        <span>重設歸零</span>
                      </button>
                    </div>
                    
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={settings.modelRotation || 0}
                      onChange={(e) => onSettingsChange({ modelRotation: parseInt(e.target.value, 10) })}
                      className="w-full accent-brand h-1 bg-bg-dark appearance-none cursor-pointer mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. MEASURE TOOL SECTION */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setActiveDockSection('measure')}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-all ${
                  activeDockSection === 'measure' 
                    ? 'bg-brand/10 border-l-2 border-brand text-brand font-bold' 
                    : 'bg-bg-dark/20 text-stone-400 hover:bg-bg-mid/30 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Ruler size={14} className={activeDockSection === 'measure' ? "text-brand" : "text-stone-400"} />
                  <span>📏 MEASURE TOOL (空間量測)</span>
                </div>
                <span className="text-[9px] text-stone-600 font-mono font-normal">
                  {activeDockSection === 'measure' ? 'EXPANDED' : 'COLLAPSED'}
                </span>
              </button>

              {activeDockSection === 'measure' && (
                <div className="p-3 bg-bg-darker/60 space-y-3 text-xs animate-fade-in">
                  
                  {/* Measure Switches */}
                  <div className="space-y-2">
                    {/* Laser lines */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 hover:bg-bg-mid/30 rounded transition-all select-none">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-stone-300">雷射測距光束 (Laser Lines)</span>
                        <p className="text-[9px] text-stone-500">投射雷射指示光，顯現測距落點。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showLaserMeasure}
                        onChange={(e) => onSettingsChange({ showLaserMeasure: e.target.checked })}
                        className="w-3.5 h-3.5 accent-brand rounded bg-bg-mid focus:ring-0 cursor-pointer"
                      />
                    </label>

                    {/* Measure arrows */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 hover:bg-bg-mid/30 rounded transition-all select-none border-t border-border-dark/30 pt-2">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-stone-300">顯示測量標註 (Measure Arrows)</span>
                        <p className="text-[9px] text-stone-500">即時標註尺寸與文字標籤 (可按 M 鍵)。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showMeasureVisualization}
                        onChange={(e) => onSettingsChange({ showMeasureVisualization: e.target.checked })}
                        className="w-3.5 h-3.5 accent-brand rounded bg-bg-mid focus:ring-0 cursor-pointer"
                      />
                    </label>

                    {/* Reach sphere */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 hover:bg-bg-mid/30 rounded transition-all select-none border-t border-border-dark/30 pt-2">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-stone-300">伸手操作範圍圈 (Reach Sphere)</span>
                        <p className="text-[9px] text-stone-500">模擬手部操作與物品抓取之半徑球圈。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showReachSphere}
                        onChange={(e) => onSettingsChange({ showReachSphere: e.target.checked })}
                        className="w-3.5 h-3.5 accent-brand rounded bg-bg-mid focus:ring-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 4. NIGHT VISION & PHYSICS SECTION */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setActiveDockSection('night')}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-all ${
                  activeDockSection === 'night' 
                    ? 'bg-brand/10 border-l-2 border-brand text-brand font-bold' 
                    : 'bg-bg-dark/20 text-stone-400 hover:bg-bg-mid/30 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Moon size={14} className={activeDockSection === 'night' ? "text-brand" : "text-stone-400"} />
                  <span>🌙 ENVIRONMENT & PHYSICS (環境與物理)</span>
                </div>
                <span className="text-[9px] text-stone-600 font-mono font-normal">
                  {activeDockSection === 'night' ? 'EXPANDED' : 'COLLAPSED'}
                </span>
              </button>

              {activeDockSection === 'night' && (
                <div className="p-3 bg-bg-darker/60 space-y-3 text-xs animate-fade-in">
                  
                  <div className="space-y-2">
                    {/* Night vision */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 hover:bg-bg-mid/30 rounded transition-all select-none">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-stone-300">微光夜視儀 (Night Vision)</span>
                        <p className="text-[9px] text-stone-500">於低光源環境中開啟增益 (可按 N 鍵)。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showNightVision}
                        onChange={(e) => onSettingsChange({ showNightVision: e.target.checked })}
                        className="w-3.5 h-3.5 accent-brand rounded bg-bg-mid focus:ring-0 cursor-pointer"
                      />
                    </label>

                    {/* Collision */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 hover:bg-bg-mid/30 rounded transition-all select-none border-t border-border-dark/30 pt-2">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-stone-300">實體碰撞限制 (Physics Collision)</span>
                        <p className="text-[9px] text-stone-500">開啟後將受到牆面與障礙之實體阻擋。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.collisionEnabled}
                        onChange={(e) => onSettingsChange({ collisionEnabled: e.target.checked })}
                        className="w-3.5 h-3.5 accent-brand rounded bg-bg-mid focus:ring-0 cursor-pointer"
                      />
                    </label>

                    {/* Gravity */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 hover:bg-bg-mid/30 rounded transition-all select-none border-t border-border-dark/30 pt-2">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-stone-300">重力與攀爬 (Gravity & Steps)</span>
                        <p className="text-[9px] text-stone-500">模擬地心引力並自動攀爬台階或斜坡。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.gravityEnabled}
                        onChange={(e) => onSettingsChange({ gravityEnabled: e.target.checked })}
                        className="w-3.5 h-3.5 accent-brand rounded bg-bg-mid focus:ring-0 cursor-pointer"
                      />
                    </label>

                    {/* Clearance envelope */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 hover:bg-bg-mid/30 rounded transition-all select-none border-t border-border-dark/30 pt-2">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-stone-300">高寬淨空框 (Clearance Envelope)</span>
                        <p className="text-[9px] text-stone-500">以紅色碰撞框顯示身體通行時的淨高與淨寬。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showClearanceEnvelope}
                        onChange={(e) => onSettingsChange({ showClearanceEnvelope: e.target.checked })}
                        className="w-3.5 h-3.5 accent-brand rounded bg-bg-mid focus:ring-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 5. HUMAN SCALE SECTION */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setActiveDockSection('human');
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-all ${
                  activeDockSection === 'human' 
                    ? 'bg-brand/10 border-l-2 border-brand text-brand font-bold' 
                    : 'bg-bg-dark/20 text-stone-400 hover:bg-bg-mid/30 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <User size={14} className={activeDockSection === 'human' ? "text-brand" : "text-stone-400"} />
                  <span>👤 HUMAN SCALE (人體尺度)</span>
                </div>
                <span className="text-[9px] text-stone-600 font-mono font-normal">
                  {activeDockSection === 'human' ? 'EXPANDED' : 'COLLAPSED'}
                </span>
              </button>

              {activeDockSection === 'human' && (
                <div className="p-3 bg-bg-darker/60 space-y-3 text-xs animate-fade-in">
                  
                  {/* Presets Grid */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-stone-500 uppercase tracking-wider block font-bold">人體尺度預設值 (Presets)</span>
                    <div className="grid grid-cols-2 gap-1.5 font-sans">
                      {HUMAN_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onSettingsChange({
                              presetId: preset.id,
                              eyeHeight: preset.eyeHeight,
                              bodyWidth: preset.bodyWidth,
                              reachRadius: preset.reachRadius,
                              currentMoveSpeed: 2.2 * preset.speedMultiplier
                            });
                          }}
                          className={`py-1 px-1.5 border text-[10px] text-left transition-all cursor-pointer ${
                            settings.presetId === preset.id
                              ? 'bg-brand/20 border-brand text-brand font-bold shadow-sm shadow-brand/10'
                              : 'bg-bg-dark/40 border-border-dark/80 hover:bg-bg-mid hover:border-border-mid text-stone-400'
                          }`}
                        >
                          <div className="font-bold truncate">{preset.name.split(' ')[0]}</div>
                          <div className="text-[8px] text-stone-500 font-mono font-normal mt-0.5">眼高: {preset.eyeHeight}m</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders for details */}
                  <div className="space-y-2.5 border-t border-border-dark/30 pt-2.5">
                    {/* Eye height slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-stone-500 font-medium">模擬眼高 (Eye Height)</span>
                        <span className="text-stone-300 font-bold">{settings.eyeHeight.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.2"
                        step="0.05"
                        value={settings.eyeHeight}
                        onChange={(e) => onSettingsChange({ eyeHeight: parseFloat(e.target.value) })}
                        className="w-full accent-brand h-1 bg-bg-dark appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Shoulder width slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-stone-500 font-medium">身體通行寬度 (Body Width)</span>
                        <span className="text-stone-300 font-bold">{settings.bodyWidth.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="1.2"
                        step="0.05"
                        value={settings.bodyWidth}
                        onChange={(e) => onSettingsChange({ bodyWidth: parseFloat(e.target.value) })}
                        className="w-full accent-brand h-1 bg-bg-dark appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Reach radius slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-stone-500 font-medium">雙手觸及半徑 (Reach Radius)</span>
                        <span className="text-stone-300 font-bold">{settings.reachRadius.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="1.2"
                        step="0.05"
                        value={settings.reachRadius}
                        onChange={(e) => onSettingsChange({ reachRadius: parseFloat(e.target.value) })}
                        className="w-full accent-brand h-1 bg-bg-dark appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Model units select */}
                    <div className="space-y-1 pt-1 border-t border-border-dark/30">
                      <span className="text-[9px] text-stone-500 uppercase tracking-wider block font-bold">量測與標註單位 (Unit)</span>
                      <select
                        value={settings.modelUnit}
                        onChange={(e) => onSettingsChange({ modelUnit: e.target.value as ModelUnit })}
                        className="w-full bg-bg-dark border border-border-dark/60 rounded px-1.5 py-1 text-[11px] font-mono text-stone-300 focus:outline-none focus:border-brand cursor-pointer"
                      >
                        <option value="m">公尺 (m)</option>
                        <option value="cm">公分 (cm)</option>
                        <option value="mm">公厘 (mm)</option>
                        <option value="ft">英呎 (ft)</option>
                        <option value="inch">英吋 (inch)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. LIVE TELEMETRY SECTION */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setActiveDockSection('telemetry');
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-all ${
                  activeDockSection === 'telemetry' 
                    ? 'bg-brand/10 border-l-2 border-brand text-brand font-bold' 
                    : 'bg-bg-dark/20 text-stone-400 hover:bg-bg-mid/30 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Activity size={14} className={activeDockSection === 'telemetry' ? "text-brand" : "text-stone-400"} />
                  <span>📊 LIVE TELEMETRY (即時感知數據)</span>
                </div>
                <span className="text-[9px] text-stone-600 font-mono font-normal">
                  {activeDockSection === 'telemetry' ? 'EXPANDED' : 'COLLAPSED'}
                </span>
              </button>

              {activeDockSection === 'telemetry' && (
                <div className="p-3 bg-bg-darker/60 space-y-3.5 text-xs animate-fade-in font-mono">
                  
                  {/* Oppression Meter */}
                  <div className="space-y-1.5 p-2 bg-bg-dark/40 border border-border-dark/65 rounded-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-stone-500 uppercase tracking-wider block font-bold">空間壓迫感指數 (Oppression Index)</span>
                      <span className="font-mono font-bold text-xs text-stone-200">{telemetry.oppressionIndex.toFixed(0)} / 100</span>
                    </div>

                    <div className="h-1.5 w-full bg-bg-darker rounded overflow-hidden flex">
                      <div 
                        style={{ width: `${telemetry.oppressionIndex}%` }}
                        className={`h-full transition-all duration-300 ${
                          telemetry.oppressionIndex < 30 ? 'bg-emerald-500' :
                          telemetry.oppressionIndex < 60 ? 'bg-sky-500' :
                          telemetry.oppressionIndex < 80 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] mt-1 font-sans">
                      <span className="text-stone-500">空間體驗感受:</span>
                      {telemetry.oppressionLevel === 'spacious' && <span className="text-emerald-400 font-bold">開敞 (Spacious)</span>}
                      {telemetry.oppressionLevel === 'comfortable' && <span className="text-sky-400 font-bold">舒適 (Comfortable)</span>}
                      {telemetry.oppressionLevel === 'cozy' && <span className="text-amber-400 font-bold">緊湊 (Cozy)</span>}
                      {telemetry.oppressionLevel === 'oppressive' && <span className="text-red-400 font-bold">壓迫 (Oppressive)</span>}
                    </div>
                  </div>

                  {/* Dimensions grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-bg-dark/40 border border-border-dark/50 p-2 rounded-sm space-y-0.5">
                      <span className="text-stone-500 block uppercase text-[8px]">模擬眼高 (Eye Height)</span>
                      <span className="text-stone-200 font-bold text-[11px]">{telemetry.eyeHeight.toFixed(2)} m</span>
                    </div>
                    <div className="bg-bg-dark/40 border border-border-dark/50 p-2 rounded-sm space-y-0.5">
                      <span className="text-stone-500 block uppercase text-[8px]">視線至天花板 (Eye-to-Ceiling)</span>
                      <span className="text-stone-200 font-bold text-[11px]">
                        {telemetry.ceilingHeight !== null ? `${telemetry.ceilingHeight.toFixed(2)} m` : '無限制'}
                      </span>
                    </div>
                    <div className="bg-bg-dark/40 border border-border-dark/50 p-2 rounded-sm space-y-0.5 col-span-2 flex justify-between items-center px-2">
                      <span className="text-stone-500 uppercase text-[8px]">通行寬度 (Walkway Width)</span>
                      <span className={`font-bold text-[11px] ${telemetry.walkwayWidth !== null && telemetry.walkwayWidth < 0.9 ? 'text-red-400' : 'text-stone-200'}`}>
                        {telemetry.walkwayWidth !== null ? `${telemetry.walkwayWidth.toFixed(2)} m` : '無限制'}
                      </span>
                    </div>
                    <div className="bg-bg-dark/40 border border-border-dark/50 p-2 rounded-sm space-y-0.5 col-span-2 flex justify-between items-center px-2">
                      <span className="text-stone-500 uppercase text-[8px]">最近阻礙牆面 (Nearest Wall)</span>
                      <span className="text-stone-200 font-bold text-[11px]">
                        {telemetry.nearestWall !== null ? `${telemetry.nearestWall.toFixed(2)} m` : '無限制'}
                      </span>
                    </div>
                  </div>

                  {/* Accessibility Tag */}
                  <div className="flex items-center justify-between p-2 bg-bg-dark/40 border border-border-dark/50 rounded-sm">
                    <div className="flex items-center gap-1.5 text-[9px] text-stone-400 font-sans">
                      <span className={`w-1.5 h-1.5 rounded-full ${telemetry.isSafeForWheelchair ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span>輪椅無障礙通行判定 (Wheelchair ADA)</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1 py-0.2 rounded-xs ${telemetry.isSafeForWheelchair ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {telemetry.isSafeForWheelchair ? '符合 (PASS)' : '受限 (RESTRICTED)'}
                    </span>
                  </div>

                  {/* Diagnostic FPS */}
                  <div className="flex items-center justify-between text-[9px] text-stone-500 font-mono">
                    <span>運行影格率 (Frame Rate)</span>
                    <div className="flex items-center gap-1 bg-bg-dark/60 border border-border-dark/60 px-1.5 py-0.5 rounded-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{telemetry.fps} FPS</span>
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>

          {/* Footer Info */}
          <div className="h-8 bg-bg-dark border-t border-border-dark px-3 flex items-center justify-between shrink-0 font-mono text-[9px] text-stone-500">
            <span>[Tab] to Lock/Unlock Cursor</span>
            <span className="text-brand font-bold">PHI WALK V0.8</span>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* REDESIGNED SIMULATION HUD OVERLAYS         */}
      {/* ========================================== */}

      <TopToolbar 
        projectName={projectName} 
        currentSpace={currentSpace} 
        isLocked={isLocked} 
        isFullscreen={isFullscreen} 
        toggleFullscreen={toggleFullscreen} 
        onOpenSetupConfirm={() => setShowSetupConfirm(true)} 
      />

      <TelemetryHUD settings={settings} />

      <SidebarPanel 
        isCharacterOpen={isCharacterOpen} 
        settings={settings} 
        onSettingsChange={onSettingsChange} 
        setCharacterHovered={setCharacterHovered} 
        setCharacterClicked={setCharacterClicked} 
        characterClicked={characterClicked} 
      />

      {/* CONSOLIDATED BLENDER-STYLE WORKSPACE DOCK SYSTEM (RIGHT SIDE) */}
      <div 
        className="absolute top-16 right-0 bottom-14 z-30 pointer-events-auto flex items-stretch select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <WorkspacePanels
          activeWorkspaceTab={activeWorkspaceTab}
          isWorkspaceExpanded={isWorkspaceExpanded}
          setIsWorkspaceExpanded={setIsWorkspaceExpanded}
          settings={settings}
          onSettingsChange={onSettingsChange}
          sceneSkyEnabled={sceneSkyEnabled}
          setSceneSkyEnabled={setSceneSkyEnabled}
          showGround={showGround}
          setShowGround={setShowGround}
          showShadow={showShadow}
          setShowShadow={setShowShadow}
          sceneSunEnabled={sceneSunEnabled}
          setSceneSunEnabled={setSceneSunEnabled}
          sceneSunPathEnabled={sceneSunPathEnabled}
          setSceneSunPathEnabled={setSceneSunPathEnabled}
          sceneBoundaryEnabled={sceneBoundaryEnabled}
          setSceneBoundaryEnabled={setSceneBoundaryEnabled}
          sceneVegetationEnabled={sceneVegetationEnabled}
          setSceneVegetationEnabled={setSceneVegetationEnabled}
          sceneSpawnPointEnabled={sceneSpawnPointEnabled}
          setSceneSpawnPointEnabled={setSceneSpawnPointEnabled}
          playerCrosshairEnabled={playerCrosshairEnabled}
          setPlayerCrosshairEnabled={setPlayerCrosshairEnabled}
          playerDirectionArrowEnabled={playerDirectionArrowEnabled}
          setPlayerDirectionArrowEnabled={setPlayerDirectionArrowEnabled}
          playerEnvelopeEnabled={playerEnvelopeEnabled}
          setPlayerEnvelopeEnabled={setPlayerEnvelopeEnabled}
          analysisCeilingHeightEnabled={analysisCeilingHeightEnabled}
          setAnalysisCeilingHeightEnabled={setAnalysisCeilingHeightEnabled}
          analysisWalkwayWidthEnabled={analysisWalkwayWidthEnabled}
          setAnalysisWalkwayWidthEnabled={setAnalysisWalkwayWidthEnabled}
          analysisWallDistanceEnabled={analysisWallDistanceEnabled}
          setAnalysisWallDistanceEnabled={setAnalysisWallDistanceEnabled}
          analysisEyeRayEnabled={analysisEyeRayEnabled}
          setAnalysisEyeRayEnabled={setAnalysisEyeRayEnabled}
          analysisEyeLevelEnabled={analysisEyeLevelEnabled}
          setAnalysisEyeLevelEnabled={setAnalysisEyeLevelEnabled}
          analysisDimensionLabelsEnabled={analysisDimensionLabelsEnabled}
          setAnalysisDimensionLabelsEnabled={setAnalysisDimensionLabelsEnabled}
          analysisMeasureArrowEnabled={analysisMeasureArrowEnabled}
          setAnalysisMeasureArrowEnabled={setAnalysisMeasureArrowEnabled}
          hudEnabledItems={hudEnabledItems}
          setHudEnabledItems={setHudEnabledItems}
          telemetry={telemetry}
          windSpeed={windSpeed}
          setWindSpeed={setWindSpeed}
          windAngle={windAngle}
          setWindAngle={setWindAngle}
          hudEnabled={hudEnabled}
          setHudEnabled={setHudEnabled}
          isHudPinned={isHudPinned}
          setIsHudPinned={setIsHudPinned}
          isSmartPlacementEnabled={isSmartPlacementEnabled}
          setIsSmartPlacementEnabled={setIsSmartPlacementEnabled}
          setHudOffset={setHudOffset}
          hudOpacity={hudOpacity}
          setHudOpacity={setHudOpacity}
          hudTheme={hudTheme}
          setHudTheme={setHudTheme}
          hudSize={hudSize}
          setHudSize={setHudSize}
          hudPreferredCorner={hudPreferredCorner}
          setHudPreferredCorner={setHudPreferredCorner}
          hudDebugInfo={hudDebugInfo}
        />

        {/* 2. VERTICAL TOOL TABS RAIL (Right edge of screen) */}
        <div className="w-[52px] bg-stone-950/95 border-l border-stone-800/80 flex flex-col items-center py-4 gap-3 bg-gradient-to-b from-stone-950 via-stone-950 to-stone-900/90 shadow-xl justify-between">
          <div className="flex flex-col items-center gap-3.5 w-full">
            {/* Top Logo / Workspace Badge */}
            <div className="w-8 h-8 rounded border border-stone-800 flex items-center justify-center text-[10px] font-bold font-mono text-stone-400 bg-stone-900/30">
              PHI
            </div>

            <div className="w-full border-t border-stone-900/80 my-1" />

            {/* List of tabs */}
            {[
              { id: 'visual', icon: <Layers size={15} />, name: 'Visual', cnName: '視覺' },
              { id: 'scene', icon: <Globe size={15} />, name: 'Scene', cnName: '場景' },
              { id: 'player', icon: <User size={15} />, name: 'Player', cnName: '玩家' },
              { id: 'analysis', icon: <Ruler size={15} />, name: 'Measure', cnName: '空間量測' },
              { id: 'environment', icon: <Sun size={15} />, name: 'Env', cnName: '環境' },
              { id: 'accessibility', icon: <ShieldCheck size={15} />, name: 'ADA', cnName: '分析' },
              { id: 'wind', icon: <Zap size={15} />, name: 'Wind', cnName: '風場' },
              { id: 'hud', icon: <Settings size={15} />, name: 'HUD', cnName: 'HUD 設置' },
            ].map((tab) => {
              const isActive = activeWorkspaceTab === tab.id && isWorkspaceExpanded;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (activeWorkspaceTab === tab.id) {
                      setIsWorkspaceExpanded(!isWorkspaceExpanded);
                    } else {
                      setActiveWorkspaceTab(tab.id as any);
                      setIsWorkspaceExpanded(true);
                    }
                  }}
                  className={`w-9 h-11 flex flex-col items-center justify-center gap-0.5 rounded transition-all cursor-pointer select-none group relative ${
                    isActive 
                      ? 'bg-brand text-black font-bold shadow-lg shadow-brand/20' 
                      : 'text-stone-500 hover:text-stone-200 hover:bg-stone-900/45'
                  }`}
                  title={`${tab.name} - ${tab.cnName}`}
                >
                  {tab.icon}
                  <span className={`text-[7px] tracking-tight scale-[0.9] font-sans ${isActive ? 'text-black font-bold' : 'text-stone-500'}`}>
                    {tab.name}
                  </span>
                  
                  {/* Custom Tooltip on Hover */}
                  <div className="absolute right-[56px] top-1/2 -translate-y-1/2 bg-stone-900 text-stone-200 border border-stone-800 rounded px-2 py-1 text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-2xl font-mono">
                    {tab.name} ({tab.cnName})
                  </div>
                </button>
              );
            })}
          </div>

          {/* Toggle Expand / Collapse Rail button */}
          <button 
            onClick={() => {
              if (activeWorkspaceTab === null) {
                setActiveWorkspaceTab('visual');
                setIsWorkspaceExpanded(true);
              } else {
                setIsWorkspaceExpanded(!isWorkspaceExpanded);
              }
            }}
            className="w-8 h-8 rounded flex items-center justify-center border border-stone-800 text-stone-500 hover:text-white hover:bg-stone-900/40 cursor-pointer transition-all"
            title={isWorkspaceExpanded ? "收起工作區" : "展開工作區"}
          >
            {isWorkspaceExpanded ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      <DebugOverlay 
        activeKeys={activeKeys} 
        settings={settings} 
        showTimeControl={showTimeControl} 
        isLocked={isLocked} 
      />

      {showTimeControl && (
        <TimeControlPanel 
          showTimeControl={showTimeControl} 
          setShowTimeControl={setShowTimeControl} 
          settings={settings} 
          onSettingsChange={onSettingsChange} 
          isTimePlaying={isTimePlaying} 
          setIsTimePlaying={setIsTimePlaying} 
          timeSpeed={timeSpeed} 
          setTimeSpeed={setTimeSpeed} 
        />
      )}

      <ModelImportDialog 
        showSetupConfirm={showSetupConfirm} 
        setShowSetupConfirm={setShowSetupConfirm} 
        onBackToSetup={onBackToSetup} 
      />

    </div>
  );
};
