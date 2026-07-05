import React from 'react';
import { Layers, Globe, User, Ruler, Sun, ShieldCheck, Zap, Settings } from 'lucide-react';
import { PlayerSettings, TelemetryData } from '../../types';
import { VisualPanel } from './VisualPanel';
import { ScenePanel } from './ScenePanel';
import { PlayerPanel } from './PlayerPanel';
import { MeasurePanel } from './MeasurePanel';
import { AnalysisPanel } from './AnalysisPanel';
import { EnvironmentPanel } from './EnvironmentPanel';
import { AccessibilityPanel } from './AccessibilityPanel';
import { HUDPanel } from './HUDPanel';

interface WorkspacePanelsProps {
  activeWorkspaceTab: string | null;
  isWorkspaceExpanded: boolean;
  setIsWorkspaceExpanded: (val: boolean) => void;
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  
  // ScenePanel props
  sceneSkyEnabled: boolean;
  setSceneSkyEnabled: (val: boolean) => void;
  showGround: boolean;
  setShowGround: (val: boolean) => void;
  showShadow: boolean;
  setShowShadow: (val: boolean) => void;
  sceneSunEnabled: boolean;
  setSceneSunEnabled: (val: boolean) => void;
  sceneSunPathEnabled: boolean;
  setSceneSunPathEnabled: (val: boolean) => void;
  sceneBoundaryEnabled: boolean;
  setSceneBoundaryEnabled: (val: boolean) => void;
  sceneVegetationEnabled: boolean;
  setSceneVegetationEnabled: (val: boolean) => void;
  sceneSpawnPointEnabled: boolean;
  setSceneSpawnPointEnabled: (val: boolean) => void;

  // PlayerPanel props
  playerCrosshairEnabled: boolean;
  setPlayerCrosshairEnabled: (val: boolean) => void;
  playerDirectionArrowEnabled: boolean;
  setPlayerDirectionArrowEnabled: (val: boolean) => void;
  playerEnvelopeEnabled: boolean;
  setPlayerEnvelopeEnabled: (val: boolean) => void;

  // Measurement/Analysis panel props
  analysisCeilingHeightEnabled: boolean;
  setAnalysisCeilingHeightEnabled: (val: boolean) => void;
  analysisWalkwayWidthEnabled: boolean;
  setAnalysisWalkwayWidthEnabled: (val: boolean) => void;
  analysisWallDistanceEnabled: boolean;
  setAnalysisWallDistanceEnabled: (val: boolean) => void;
  analysisEyeRayEnabled: boolean;
  setAnalysisEyeRayEnabled: (val: boolean) => void;
  analysisEyeLevelEnabled: boolean;
  setAnalysisEyeLevelEnabled: (val: boolean) => void;
  analysisDimensionLabelsEnabled: boolean;
  setAnalysisDimensionLabelsEnabled: (val: boolean) => void;
  analysisMeasureArrowEnabled: boolean;
  setAnalysisMeasureArrowEnabled: (val: boolean) => void;

  // Shared HUD items
  hudEnabledItems: Record<string, boolean>;
  setHudEnabledItems: React.Dispatch<React.SetStateAction<any>>;

  // Accessibility telemetry
  telemetry: TelemetryData;

  // Wind / AnalysisPanel props
  windSpeed: number;
  setWindSpeed: (val: number) => void;
  windAngle: number;
  setWindAngle: (val: number) => void;

  // HUDPanel props
  hudEnabled: boolean;
  setHudEnabled: (val: boolean) => void;
  isHudPinned: boolean;
  setIsHudPinned: (val: boolean) => void;
  isSmartPlacementEnabled: boolean;
  setIsSmartPlacementEnabled: (val: boolean) => void;
  setHudOffset: (val: any) => void;
  hudOpacity: number;
  setHudOpacity: (val: number) => void;
  hudTheme: 'dark' | 'light' | 'glass' | 'cyberpunk';
  setHudTheme: (theme: 'dark' | 'light' | 'glass' | 'cyberpunk') => void;
  hudSize: 'small' | 'medium' | 'large';
  setHudSize: (size: 'small' | 'medium' | 'large') => void;
  hudPreferredCorner: 'BR' | 'BL' | 'TR' | 'TL' | 'BCL' | 'TCL';
  setHudPreferredCorner: (corner: 'BR' | 'BL' | 'TR' | 'TL' | 'BCL' | 'TCL') => void;
  hudDebugInfo: {
    visible: boolean;
    position: string;
    opacity: number;
    zIndex: number;
    safeArea: boolean;
    collision: boolean;
  };
}

export const WorkspacePanels: React.FC<WorkspacePanelsProps> = ({
  activeWorkspaceTab,
  isWorkspaceExpanded,
  setIsWorkspaceExpanded,
  settings,
  onSettingsChange,
  sceneSkyEnabled,
  setSceneSkyEnabled,
  showGround,
  setShowGround,
  showShadow,
  setShowShadow,
  sceneSunEnabled,
  setSceneSunEnabled,
  sceneSunPathEnabled,
  setSceneSunPathEnabled,
  sceneBoundaryEnabled,
  setSceneBoundaryEnabled,
  sceneVegetationEnabled,
  setSceneVegetationEnabled,
  sceneSpawnPointEnabled,
  setSceneSpawnPointEnabled,
  playerCrosshairEnabled,
  setPlayerCrosshairEnabled,
  playerDirectionArrowEnabled,
  setPlayerDirectionArrowEnabled,
  playerEnvelopeEnabled,
  setPlayerEnvelopeEnabled,
  analysisCeilingHeightEnabled,
  setAnalysisCeilingHeightEnabled,
  analysisWalkwayWidthEnabled,
  setAnalysisWalkwayWidthEnabled,
  analysisWallDistanceEnabled,
  setAnalysisWallDistanceEnabled,
  analysisEyeRayEnabled,
  setAnalysisEyeRayEnabled,
  analysisEyeLevelEnabled,
  setAnalysisEyeLevelEnabled,
  analysisDimensionLabelsEnabled,
  setAnalysisDimensionLabelsEnabled,
  analysisMeasureArrowEnabled,
  setAnalysisMeasureArrowEnabled,
  hudEnabledItems,
  setHudEnabledItems,
  telemetry,
  windSpeed,
  setWindSpeed,
  windAngle,
  setWindAngle,
  hudEnabled,
  setHudEnabled,
  isHudPinned,
  setIsHudPinned,
  isSmartPlacementEnabled,
  setIsSmartPlacementEnabled,
  setHudOffset,
  hudOpacity,
  setHudOpacity,
  hudTheme,
  setHudTheme,
  hudSize,
  setHudSize,
  hudPreferredCorner,
  setHudPreferredCorner,
  hudDebugInfo,
}) => {
  return (
    <div 
      className={`bg-stone-950/95 border-l border-stone-800/80 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
        isWorkspaceExpanded && activeWorkspaceTab !== null ? 'w-[280px] border-l opacity-100' : 'w-0 border-l-0 opacity-0 pointer-events-none'
      }`}
    >
      {/* Active Tab Panel Header */}
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3 bg-stone-900/40 shrink-0">
        <div className="flex items-center gap-1.5 text-stone-200 font-bold uppercase tracking-wider text-[11px] font-mono">
          {activeWorkspaceTab === 'visual' && <Layers size={13} className="text-brand" />}
          {activeWorkspaceTab === 'scene' && <Globe size={13} className="text-brand" />}
          {activeWorkspaceTab === 'player' && <User size={13} className="text-brand" />}
          {activeWorkspaceTab === 'analysis' && <Ruler size={13} className="text-brand" />}
          {activeWorkspaceTab === 'environment' && <Sun size={13} className="text-brand" />}
          {activeWorkspaceTab === 'accessibility' && <ShieldCheck size={13} className="text-brand" />}
          {activeWorkspaceTab === 'wind' && <Zap size={13} className="text-brand" />}
          {activeWorkspaceTab === 'hud' && <Settings size={13} className="text-brand" />}
          
          <span>
            {activeWorkspaceTab === 'visual' && '視覺模式 Visual'}
            {activeWorkspaceTab === 'scene' && '場景元素 Scene'}
            {activeWorkspaceTab === 'player' && '玩家 HUD Player'}
            {activeWorkspaceTab === 'analysis' && '空間量測 Spatial Measurement'}
            {activeWorkspaceTab === 'environment' && '環境日照 Environment'}
            {activeWorkspaceTab === 'accessibility' && '無障礙 Accessibility'}
            {activeWorkspaceTab === 'wind' && '微氣候風場 Wind'}
            {activeWorkspaceTab === 'hud' && 'HUD 控制中心 HUD Manager'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setIsWorkspaceExpanded(false)}
            className="text-stone-500 hover:text-stone-200 text-[10px] font-mono cursor-pointer px-1.5 py-0.5 border border-stone-800 rounded bg-stone-900/40 hover:bg-stone-900/80 transition-colors"
          >
            [ 收起 ]
          </button>
        </div>
      </div>

      {/* Active Tab Panel Content Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-stone-300 scrollbar-thin">
        {activeWorkspaceTab === 'visual' && (
          <VisualPanel 
            settings={settings} 
            onSettingsChange={onSettingsChange} 
          />
        )}

        {activeWorkspaceTab === 'scene' && (
          <ScenePanel 
            sceneSkyEnabled={sceneSkyEnabled}
            setSceneSkyEnabled={setSceneSkyEnabled}
            showGround={showGround}
            setShowGround={setShowGround}
            showShadow={showShadow}
            setShowShadow={setShowShadow}
            sceneSunEnabled={sceneSunEnabled}
            setSceneSunEnabled={setSceneSunEnabled}
            sceneSunPathEnabled={sceneSunPathEnabled}
            setSceneSunPathEnabled={sceneSunPathEnabled}
            sceneBoundaryEnabled={sceneBoundaryEnabled}
            setSceneBoundaryEnabled={sceneBoundaryEnabled}
            sceneVegetationEnabled={sceneVegetationEnabled}
            setSceneVegetationEnabled={setSceneVegetationEnabled}
            sceneSpawnPointEnabled={sceneSpawnPointEnabled}
            setSceneSpawnPointEnabled={setSceneSpawnPointEnabled}
          />
        )}

        {activeWorkspaceTab === 'player' && (
          <PlayerPanel 
            settings={settings}
            onSettingsChange={onSettingsChange}
            playerCrosshairEnabled={playerCrosshairEnabled}
            setPlayerCrosshairEnabled={setPlayerCrosshairEnabled}
            playerDirectionArrowEnabled={playerDirectionArrowEnabled}
            setPlayerDirectionArrowEnabled={setPlayerDirectionArrowEnabled}
            playerEnvelopeEnabled={playerEnvelopeEnabled}
            setPlayerEnvelopeEnabled={setPlayerEnvelopeEnabled}
            hudEnabledItems={hudEnabledItems}
            setHudEnabledItems={setHudEnabledItems}
          />
        )}

        {activeWorkspaceTab === 'analysis' && (
          <MeasurePanel 
            onSettingsChange={onSettingsChange}
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
          />
        )}

        {activeWorkspaceTab === 'environment' && (
          <EnvironmentPanel 
            settings={settings}
            onSettingsChange={onSettingsChange}
          />
        )}

        {activeWorkspaceTab === 'accessibility' && (
          <AccessibilityPanel 
            telemetry={telemetry}
            hudEnabledItems={hudEnabledItems}
            setHudEnabledItems={setHudEnabledItems}
          />
        )}

        {activeWorkspaceTab === 'wind' && (
          <AnalysisPanel 
            windSpeed={windSpeed}
            setWindSpeed={setWindSpeed}
            windAngle={windAngle}
            setWindAngle={setWindAngle}
          />
        )}

        {activeWorkspaceTab === 'hud' && (
          <HUDPanel 
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
        )}
      </div>
    </div>
  );
};
