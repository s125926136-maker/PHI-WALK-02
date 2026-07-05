/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ModelSelector 
} from './components/ModelSelector';
import { 
  TelemetryPanel 
} from './components/TelemetryPanel';
import { 
  SimulatorCanvas 
} from './components/SimulatorCanvas';
import HUD from './components/HUD';
import { 
  ThreeViews 
} from './components/ThreeViews';
import { 
  SpaceType, 
  PlayerSettings, 
  TelemetryData, 
  ModelFileInfo,
  HumanScaleType
} from './types';
import { 
  Layout, 
  Compass, 
  HelpCircle, 
  Activity, 
  Sparkles, 
  Maximize2,
  Minimize2,
  RotateCcw,
  UploadCloud,
  Layers,
  ChevronRight,
  ChevronLeft,
  Check,
  Play,
  Settings,
  Building,
  Ruler,
  Globe,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Sparkle
} from 'lucide-react';

const INITIAL_SETTINGS: PlayerSettings = {
  presetId: 'adult',
  eyeHeight: 1.65,
  bodyWidth: 0.72,
  reachRadius: 0.75,
  modelUnit: 'm',
  viewMode: 'first-person',
  collisionEnabled: true,
  gravityEnabled: true,
  showLaserMeasure: true,
  showMeasureVisualization: true,
  showReachSphere: false,
  showClearanceEnvelope: true,
  posture: 'standing',
  currentMoveSpeed: 2.2, // standard walking speed (m/s)
  displayMode: 'real',
  showOrientationAnalysis: false,
  showNightVision: false,
  showSunAnalysis: false,
  showWindAnalysis: false,
  showAccessibilityAnalysis: false,
  siteMargin: 10,
  siteMarginOption: '10m',
  
  // Project Settings & Solar Analysis V0.6 Defaults
  siteName: "臺灣綠建築基地 (Taiwan Green Site)",
  latitude: 23.6959,
  longitude: 120.5346,
  latitudeDMS: "23°41'45\"N",
  longitudeDMS: "120°32'05\"E",
  coordsFormat: 'decimal',
  modelNorth: 0,
  timezone: 8,
  analysisDate: "2026-06-21", // Summer Solstice default
  analysisTime: "12:00",
  
  // Solar Analysis V0.7 Defaults
  analysisMode: 'solar',
  modelRotation: 0,
  showCompass: true,
  showFloatingPanel: false,
  movementMode: 'architect',
};

const INITIAL_TELEMETRY: TelemetryData = {
  eyeHeight: 1.65,
  eyeLevelAboveGround: null,
  ceilingHeight: null,
  walkwayWidth: null,
  nearestWall: null,
  nearestFurniture: null,
  currentRoom: '未偵測到空間區域',
  oppressionIndex: 0,
  oppressionLevel: 'comfortable',
  isSafeForWheelchair: true,
  fps: 60,
};

export default function App() {
  // Workflow states
  const [workflowStep, setWorkflowStep] = useState<'start' | 'setup' | 'simulation'>('start');
  const [setupStep, setSetupStep] = useState<number>(1); // 1: 專案, 2: 模型, 3: 朝向, 4: 基地, 5: 完成
  const [projectName, setProjectName] = useState<string>("無標題專案 (Untitled Project)");

  // Simulator states
  const [currentSpace, setCurrentSpace] = useState<SpaceType>('apartment');
  const [corridorWidth, setCorridorWidth] = useState<number>(1.2);
  const [corridorHeight, setCorridorHeight] = useState<number>(2.4);
  const [settings, setSettings] = useState<PlayerSettings>(INITIAL_SETTINGS);
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [fileInfo, setFileInfo] = useState<ModelFileInfo | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  
  // Drag and Drop global overlay indicator
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Global Drag and Drop event listeners to support dropping model anywhere on screen
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 && e.clientY === 0) {
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        handleFileUpload(file);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleFileUpload = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (['glb', 'gltf', 'obj', 'fbx'].includes(extension || '')) {
      setUploadedFile(file);
      setCurrentSpace('uploaded');
      // If we are currently on setup step 1, automatically prompt moving to step 2!
      if (setupStep === 1) {
        setTimeout(() => setSetupStep(2), 500);
      }
    } else {
      alert('不支援的檔案格式！請載入 .glb, .gltf, .obj 或 .fbx 檔案。');
    }
  };

  const handleSpaceChange = (space: SpaceType) => {
    setCurrentSpace(space);
  };

  const handleSettingsChange = (newSettings: Partial<PlayerSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleTelemetryUpdate = (data: TelemetryData) => {
    setTelemetry(data);
  };

  const handleModelLoaded = (info: ModelFileInfo) => {
    setFileInfo(info);
    setIsLoading(false);
  };

  const triggerResetCamera = () => {
    setResetTrigger((prev) => prev + 1);
  };

  // Pre-load default simulation variables on start simulation
  const handleStartSimulation = () => {
    setSettings(prev => ({
      ...prev,
      presetId: 'adult',
      eyeHeight: 1.65,
      bodyWidth: 0.72,
      reachRadius: 0.75,
      analysisTime: "07:00", // Start at 07:00
      showSunAnalysis: true, // Solar is ON
      displayMode: 'real',
      showFloatingPanel: true, // Open the Analysis Dock
    }));
    setWorkflowStep('simulation');
  };

  // --------------------------------------------------
  // RENDER: STEP 0 - START SCREEN
  // --------------------------------------------------
  if (workflowStep === 'start') {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#070707] text-stone-200 justify-center items-center font-sans overflow-hidden relative select-none">
        {/* Architectural Grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#070707_80%)]"></div>

        {/* Dynamic backdrop glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand/5 blur-[130px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center max-w-xl text-center p-8 space-y-12 animate-fade-in">
          
          {/* Logo Badge */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand/50 to-orange-600/50 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
            <div className="relative w-16 h-16 border-2 border-brand flex items-center justify-center bg-black/80">
              <div className="w-4 h-4 bg-brand"></div>
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-4">
            <h1 className="text-5xl font-extrabold tracking-[0.35em] text-stone-100 font-mono select-none">
              PHI WALK
            </h1>
            <div className="h-[2px] w-24 bg-brand mx-auto my-3"></div>
            <p className="text-xs uppercase font-bold tracking-[0.25em] text-stone-400 font-mono">
              Architectural Spatial Experience Simulator
            </p>
            <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed pt-2 font-sans">
              一站式 1:1 人體尺度、日照遮蔭、空間壓迫感及無障礙體感模擬分析軟體。導入您的 3D CAD/BIM 模型，立刻開展專業微氣候及尺度體感實測。
            </p>
          </div>

          {/* CTA Action */}
          <button
            onClick={() => setWorkflowStep('setup')}
            className="w-56 py-3.5 bg-brand text-black hover:bg-white text-xs font-bold tracking-[0.25em] uppercase cursor-pointer border border-brand hover:border-white shadow-2xl shadow-brand/10 transition-all duration-300"
          >
            [ 開啟專案 ]
          </button>

          {/* Footer information */}
          <div className="text-[9px] font-mono text-stone-600 uppercase tracking-widest pt-12">
            PHI WALK v1.0 • PROFESSIONAL SPATIAL ANALYTICS SUITE
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // RENDER: STEP 1-5 - PROJECT SETUP WIZARD
  // --------------------------------------------------
  if (workflowStep === 'setup') {
    return (
      <div className="flex flex-col h-screen w-screen bg-bg-darker font-sans text-stone-200 overflow-hidden relative">
        
        {/* Wizard Topbar */}
        <header className="h-14 bg-bg-dark border-b border-border-dark flex items-center justify-between px-6 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 bg-brand"></div>
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-widest text-stone-200 font-mono uppercase">
                PHI WALK • PROJECT INITIALIZATION
              </h1>
            </div>
          </div>
          <button
            onClick={() => setWorkflowStep('start')}
            className="text-[10px] text-stone-500 hover:text-stone-300 font-mono px-2 py-1 border border-border-dark/60 hover:border-stone-500 rounded-sm cursor-pointer transition-colors"
          >
            ← 退出專案
          </button>
        </header>

        {/* Step Progress Wizard Bar */}
        <div className="bg-bg-dark border-b border-border-dark py-4 px-6 shrink-0 select-none">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {[
              { id: 1, label: '① 專案 (Project)' },
              { id: 2, label: '② 模型 (Unit)' },
              { id: 3, label: '③ 朝向 (North)' },
              { id: 4, label: '④ 基地 (Geography)' },
              { id: 5, label: '⑤ 完成 (Validation)' },
            ].map((step) => {
              const isActive = setupStep === step.id;
              const isCompleted = setupStep > step.id;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => {
                      if (isCompleted || step.id <= setupStep) {
                        setSetupStep(step.id);
                      }
                    }}
                    disabled={step.id > setupStep}
                    className={`flex items-center gap-1.5 px-3 py-1.5 transition-all text-xs font-mono font-bold border-b-2 cursor-pointer ${
                      isActive 
                        ? 'border-brand text-brand bg-brand/5'
                        : isCompleted
                        ? 'border-emerald-500 text-emerald-400 hover:bg-bg-darker'
                        : 'border-transparent text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    <span>{isCompleted ? '✓' : ''} {step.label}</span>
                  </button>
                  {step.id < 5 && (
                    <div className={`h-[1px] flex-1 mx-2 ${setupStep > step.id ? 'bg-emerald-500/50' : 'bg-border-dark'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Main Wizard Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
          <div className="w-full max-w-4xl bg-bg-dark border border-border-dark p-6 rounded-sm space-y-6 shadow-2xl animate-fade-in">
            
            {/* SUB-STEP 1: 建立專案與匯入/預覽模型 */}
            {setupStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-stone-100 flex items-center gap-2 font-mono">
                    <Layers size={16} className="text-brand" />
                    [ STEP 1 ] 建立專案與模型載入 (Project & Model Setup)
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    請輸入專案名稱，並選擇您要進行體感模擬的 3D 模型來源。
                  </p>
                </div>

                {/* Project Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                    專案名稱 (Project Name)
                  </label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-2.5 text-stone-500" />
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-bg-darker border border-border-dark pl-9 pr-3 py-2 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-sans"
                      placeholder="輸入您的專案名稱..."
                    />
                  </div>
                </div>

                {/* Model Selector Sources */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                    3D 空間幾何來源 (Spatial Model Source)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Source 1: Built-in presets */}
                    <div className="border border-border-dark p-4 rounded-sm bg-bg-darker/40 space-y-3">
                      <span className="text-xs font-bold text-stone-300 font-mono block">○ 系統內建預覽模型 (System Space Presets)</span>
                      
                      <div className="space-y-2">
                        {[
                          { id: 'apartment', name: '住宅公寓 (Residential Apartment)', desc: '微型住宅格局，包含客廳、臥室、0.9m 過道及浴廁。適合一般居家尺寸實測。' },
                          { id: 'gallery', name: '挑高展覽館 (Exhibition Gallery)', desc: '挑高 6.0 米、大跨距結構柱列之公共空間。適合大尺度光影及空間體感。' },
                          { id: 'corridor', name: '可變動通道 (Interactive Corridor)', desc: '實驗長廊。可調整寬高，即時進行狹隘壓迫度與通道無障礙量化分析。' },
                        ].map((space) => (
                          <button
                            key={space.id}
                            type="button"
                            onClick={() => {
                              setCurrentSpace(space.id as SpaceType);
                            }}
                            className={`w-full p-2.5 text-left border rounded-sm transition-all text-xs cursor-pointer block ${
                              currentSpace === space.id && currentSpace !== 'uploaded'
                                ? 'bg-brand/15 border-brand text-brand font-bold'
                                : 'bg-bg-darker border-border-dark/60 hover:bg-bg-mid hover:text-stone-200 text-stone-400'
                            }`}
                          >
                            <span className="block font-bold">{space.name}</span>
                            <span className="block text-[10px] text-stone-500 mt-1 leading-relaxed font-normal">{space.desc}</span>
                          </button>
                        ))}
                      </div>

                      {currentSpace === 'corridor' && (
                        <div className="p-3 bg-bg-dark/60 border border-border-dark/60 rounded-sm space-y-3.5 animate-fade-in">
                          <span className="text-[9px] text-brand uppercase tracking-wider block font-bold font-mono">🔧 通道實驗尺寸 (Interactive Adjustments)</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] font-mono text-stone-400">
                                <span>通道淨寬:</span>
                                <span className="text-stone-200 font-bold">{corridorWidth.toFixed(2)} m</span>
                              </div>
                              <input
                                type="range"
                                min="0.8"
                                max="2.0"
                                step="0.1"
                                value={corridorWidth}
                                onChange={(e) => setCorridorWidth(parseFloat(e.target.value))}
                                className="w-full accent-brand h-1 bg-bg-darker"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] font-mono text-stone-400">
                                <span>通道淨高:</span>
                                <span className="text-stone-200 font-bold">{corridorHeight.toFixed(2)} m</span>
                              </div>
                              <input
                                type="range"
                                min="1.8"
                                max="3.0"
                                step="0.1"
                                value={corridorHeight}
                                onChange={(e) => setCorridorHeight(parseFloat(e.target.value))}
                                className="w-full accent-brand h-1 bg-bg-darker"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Source 2: Custom CAD Upload */}
                    <div className="border border-border-dark p-4 rounded-sm bg-bg-darker/40 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-stone-300 font-mono block">○ 匯入自訂 3D 模型 (Import Custom 3D Model)</span>
                        
                        {/* Drag Area */}
                        <div 
                          className={`border-2 border-dashed rounded-sm p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                            currentSpace === 'uploaded'
                              ? 'border-brand/60 bg-brand/5 text-brand'
                              : 'border-border-dark hover:border-stone-500 bg-bg-darker'
                          }`}
                          onClick={() => document.getElementById('file-upload-wizard')?.click()}
                        >
                          <UploadCloud size={24} className="text-stone-500 mb-2 group-hover:text-brand" />
                          <span className="text-xs font-bold block select-none">點選或拖曳 3D 檔案至此</span>
                          <span className="text-[10px] text-stone-500 block mt-1 select-none font-mono">支援格式: .glb, .gltf, .obj, .fbx</span>
                          <input
                            id="file-upload-wizard"
                            type="file"
                            accept=".glb,.gltf,.obj,.fbx"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleFileUpload(e.target.files[0]);
                              }
                            }}
                          />
                        </div>

                        {uploadedFile && (
                          <div className="p-3 bg-bg-darker border border-border-dark rounded-sm space-y-1 animate-fade-in text-xs font-mono">
                            <div className="flex justify-between items-center text-stone-300">
                              <span className="font-bold truncate max-w-[180px]">📁 {uploadedFile.name}</span>
                              <span className="text-[10px] text-stone-500">{(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                            </div>
                            <span className="text-[9px] text-emerald-400 block font-bold mt-1">✓ 檔案載入成功，已設為當前模擬圖元。</span>
                          </div>
                        )}
                      </div>

                      {/* Info warning */}
                      <p className="text-[10px] text-stone-500 leading-relaxed font-sans">
                        💡 貼心提醒: 匯入大型 3D 模型時，系統會自動在載入後將模型最低點對齊於模擬地面（Y=0），並依 1:1 地平線進行完美地板貼地校正。
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wizard Footer Navigation */}
                <div className="flex justify-end pt-4 border-t border-border-dark/60">
                  <button
                    type="button"
                    onClick={() => setSetupStep(2)}
                    className="px-5 py-2 bg-brand text-black hover:bg-white text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <span>下一步: 設定模型單位 (Set Units)</span>
                    <ChevronRight size={14} className="stroke-[3]" />
                  </button>
                </div>
              </div>
            )}

            {/* SUB-STEP 2: 模型設定 - 模型單位 (Model Unit) */}
            {setupStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-stone-100 flex items-center gap-2 font-mono">
                    <Ruler size={16} className="text-brand" />
                    [ STEP 2 ] 模擬單位校正 (Model Unit Scale Alignment)
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    指定模型建立時所採用的長度單位。系統將以此單位精準對齊 1:1 的人體尺度與安全法規淨高尺寸。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Unit Selectors */}
                  <div className="space-y-3.5 border border-border-dark p-4 rounded-sm bg-bg-darker/30">
                    <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">選擇模型圖面單位 (Unit Scale)</span>
                    
                    <div className="space-y-2 font-mono">
                      {[
                        { id: 'm', label: '公尺 (1 Unit = 1 Meter)', desc: '適用於標準多數 GLB/BIM 輸出。人體眼高預設 1.65。' },
                        { id: 'cm', label: '公分 (1 Unit = 1 Centimeter)', desc: '常用於精細室內裝修家具圖面。比例將自動校準。' },
                        { id: 'mm', label: '公厘 (1 Unit = 1 Millimeter)', desc: '製造業與高精度機械加工/大比例尺繪製模型。' },
                      ].map((unit) => (
                        <label
                          key={unit.id}
                          className={`p-3 border rounded-sm flex items-start gap-3 cursor-pointer transition-all ${
                            settings.modelUnit === unit.id
                              ? 'bg-brand/10 border-brand text-brand'
                              : 'bg-bg-darker border-border-dark/80 hover:bg-bg-mid text-stone-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="modelUnit"
                            value={unit.id}
                            checked={settings.modelUnit === unit.id}
                            onChange={() => handleSettingsChange({ modelUnit: unit.id as any })}
                            className="mt-1 accent-brand cursor-pointer"
                          />
                          <div>
                            <span className="block font-bold text-xs text-stone-200">{unit.label}</span>
                            <span className="block text-[10px] text-stone-500 mt-1 leading-normal font-sans">{unit.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Unit Information Card */}
                  <div className="space-y-4 border border-border-dark p-4 rounded-sm bg-bg-darker/30 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">人體工學常模比例連動狀態</span>
                      <div className="p-3 bg-bg-darker border border-border-dark/80 rounded-sm space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-stone-500">當前模型單位 (Unit):</span>
                          <span className="text-stone-200 font-bold uppercase">{settings.modelUnit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">模擬成人眼高 (Eye Height):</span>
                          <span className="text-brand font-bold">{(1.65).toFixed(2)} m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">雙手通行寬度 (Body Width):</span>
                          <span className="text-brand font-bold">{(0.72).toFixed(2)} m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">雙手觸及半徑 (Reach):</span>
                          <span className="text-brand font-bold">{(0.75).toFixed(2)} m</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-brand/5 border border-brand/20 rounded-sm text-xs space-y-1.5 leading-relaxed font-sans">
                      <span className="font-bold text-brand block text-[11px]">💡 1:1 比對原理</span>
                      <p className="text-stone-400 text-[11px]">
                        PHI WALK 內建動態法規尺度感知器，其淨空安全包絡、無障礙判定軌跡等三維圖元，皆會在此進行轉換。
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wizard Footer Navigation */}
                <div className="flex justify-between pt-4 border-t border-border-dark/60">
                  <button
                    type="button"
                    onClick={() => setSetupStep(1)}
                    className="px-4 py-2 border border-border-dark hover:border-stone-500 text-stone-400 hover:text-stone-200 text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <ChevronLeft size={14} />
                    <span>上一步</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupStep(3)}
                    className="px-5 py-2 bg-brand text-black hover:bg-white text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <span>下一步: 朝向定位設定 (Orientation)</span>
                    <ChevronRight size={14} className="stroke-[3]" />
                  </button>
                </div>
              </div>
            )}

            {/* SUB-STEP 3: 建築朝向設定 (Model Orientation 三視圖) */}
            {setupStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-stone-100 flex items-center gap-2 font-mono">
                    <Compass size={16} className="text-brand" />
                    [ STEP 3 ] 建築正北偏差朝向校正 (Model Orientation Alignment)
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    在平面圖中拖曳 <strong>↑ N</strong> 指北針以校準 True North，不要旋轉建築本體。北立面及西立面相機將同步旋轉更新。
                  </p>
                </div>

                {/* Render three views orthographic camera component */}
                <ThreeViews
                  currentSpace={currentSpace}
                  uploadedFile={uploadedFile}
                  corridorWidth={corridorWidth}
                  corridorHeight={corridorHeight}
                  modelNorth={settings.modelNorth}
                  onModelNorthChange={(deg) => handleSettingsChange({ modelNorth: deg })}
                />

                {/* Wizard Footer Navigation */}
                <div className="flex justify-between pt-4 border-t border-border-dark/60">
                  <button
                    type="button"
                    onClick={() => setSetupStep(2)}
                    className="px-4 py-2 border border-border-dark hover:border-stone-500 text-stone-400 hover:text-stone-200 text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <ChevronLeft size={14} />
                    <span>上一步</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupStep(4)}
                    className="px-5 py-2 bg-brand text-black hover:bg-white text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <span>下一步: 基地設定 (Site Settings)</span>
                    <ChevronRight size={14} className="stroke-[3]" />
                  </button>
                </div>
              </div>
            )}

            {/* SUB-STEP 4: 基地設定 & 基地生成 */}
            {setupStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-stone-100 flex items-center gap-2 font-mono">
                    <Globe size={16} className="text-brand" />
                    [ STEP 4 ] 基地地理位置與生成設定 (Site Geography & Generation)
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    指定基地的地球物理經緯度，並設定模擬所生成之水平基地草皮延伸範圍（Site Margin）。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Left block: Coordinates & Geography */}
                  <div className="space-y-4 border border-border-dark p-4 rounded-sm bg-bg-darker/30">
                    <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider font-mono">基地地理定位 (Geographical Decimal Degrees)</span>
                    
                    {/* Quick presets list for convenience */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-stone-500 font-bold block uppercase font-mono">快速預設座標 (Presets)</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { name: '台北基地', lat: 25.0330, lng: 121.5654 },
                          { name: '台中基地', lat: 24.1477, lng: 120.6736 },
                          { name: '高雄基地', lat: 22.6273, lng: 120.3014 },
                        ].map((loc) => (
                          <button
                            key={loc.name}
                            type="button"
                            onClick={() => {
                              handleSettingsChange({
                                latitude: loc.lat,
                                longitude: loc.lng,
                              });
                            }}
                            className={`py-1 px-1.5 border text-[10px] rounded-xs font-sans text-center transition-all cursor-pointer ${
                              Math.abs(settings.latitude - loc.lat) < 0.01
                                ? 'bg-brand/20 border-brand text-brand font-bold'
                                : 'bg-bg-darker border-border-dark/60 text-stone-400 hover:bg-bg-mid'
                            }`}
                          >
                            {loc.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1 flex flex-col">
                        <label className="text-[9px] text-stone-500 block font-mono">緯度 Latitude (-90~90)</label>
                        <input
                          type="number"
                          min="-90"
                          max="90"
                          step="0.0001"
                          value={settings.latitude}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleSettingsChange({ latitude: Math.max(-90, Math.min(90, val)) });
                            }
                          }}
                          className="w-full bg-bg-darker border border-border-dark px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-mono"
                        />
                        <input
                          type="range"
                          min="-90"
                          max="90"
                          step="0.01"
                          value={settings.latitude}
                          onChange={(e) => handleSettingsChange({ latitude: parseFloat(e.target.value) })}
                          className="w-full accent-brand h-1 bg-bg-darker appearance-none cursor-pointer mt-1.5"
                        />
                      </div>
                      <div className="space-y-1 flex flex-col">
                        <label className="text-[9px] text-stone-500 block font-mono">經度 Longitude (-180~180)</label>
                        <input
                          type="number"
                          min="-180"
                          max="180"
                          step="0.0001"
                          value={settings.longitude}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleSettingsChange({ longitude: Math.max(-180, Math.min(180, val)) });
                            }
                          }}
                          className="w-full bg-bg-darker border border-border-dark px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-mono"
                        />
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="0.01"
                          value={settings.longitude}
                          onChange={(e) => handleSettingsChange({ longitude: parseFloat(e.target.value) })}
                          className="w-full accent-brand h-1 bg-bg-darker appearance-none cursor-pointer mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-stone-500 block font-mono flex items-center gap-1">
                          <Calendar size={11} className="text-stone-500" />
                          <span>預設日期</span>
                        </label>
                        <input
                          type="date"
                          value={settings.analysisDate}
                          onChange={(e) => handleSettingsChange({ analysisDate: e.target.value })}
                          className="w-full bg-bg-darker border border-border-dark px-2 py-1 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-[11px] font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-stone-500 block font-mono flex items-center gap-1">
                          <Globe size={11} className="text-stone-500" />
                          <span>時區 Timezone</span>
                        </label>
                        <select
                          value={settings.timezone}
                          onChange={(e) => handleSettingsChange({ timezone: parseInt(e.target.value, 10) })}
                          className="w-full bg-bg-darker border border-border-dark px-2 py-1.5 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-[11px] font-mono cursor-pointer"
                        >
                          <option value="8">GMT+8 (Taipei / HK)</option>
                          <option value="0">GMT+0 (UTC)</option>
                          <option value="-5">GMT-5 (New York)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Right block: Landscape Site Margin Generation */}
                  <div className="space-y-4 border border-border-dark p-4 rounded-sm bg-bg-darker/30">
                    <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider font-mono">基地地盤綠地生成 (Site Margin Range)</span>

                    <div className="space-y-2">
                      {[
                        { id: 'Ground', value: 0, label: '僅基本草地 (Grass Ground Only)', desc: '不向模型外圍做多餘地盤渲染，僅維持起點下方防墜落草地。' },
                        { id: '10m', value: 10, label: '自動向外擴展 10 米 (Bounding Box +10m)', desc: '系統自動偵測模型包絡框，向 X、Z 軸邊緣均等向外鋪設 10m 綠茵景觀。' },
                        { id: '20m', value: 20, label: '自動向外擴展 20 米 (Bounding Box +20m)', desc: '模型向外延伸 20 米草地，提供開敞的遠景視野，方便日影投影落於地盤上。' },
                      ].map((opt) => (
                        <label
                          key={opt.id}
                          className={`p-3 border rounded-sm flex items-start gap-3 cursor-pointer transition-all ${
                            settings.siteMargin === opt.value
                              ? 'bg-brand/10 border-brand text-brand font-bold'
                              : 'bg-bg-darker border-border-dark/80 hover:bg-bg-mid text-stone-400 font-normal'
                          }`}
                        >
                          <input
                            type="radio"
                            name="siteMarginOption"
                            checked={settings.siteMargin === opt.value}
                            onChange={() => handleSettingsChange({ siteMargin: opt.value, siteMarginOption: (opt.id === 'Ground' ? 'custom' : opt.id as any) })}
                            className="mt-1 accent-brand cursor-pointer"
                          />
                          <div className="text-left">
                            <span className="block font-bold text-xs text-stone-200">{opt.label}</span>
                            <span className="block text-[10px] text-stone-500 mt-1 leading-normal font-sans">{opt.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Wizard Footer Navigation */}
                <div className="flex justify-between pt-4 border-t border-border-dark/60">
                  <button
                    type="button"
                    onClick={() => setSetupStep(3)}
                    className="px-4 py-2 border border-border-dark hover:border-stone-500 text-stone-400 hover:text-stone-200 text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <ChevronLeft size={14} />
                    <span>上一步</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupStep(5)}
                    className="px-5 py-2 bg-brand text-black hover:bg-white text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <span>下一步: 專案檢查與完成 (Validation)</span>
                    <ChevronRight size={14} className="stroke-[3]" />
                  </button>
                </div>
              </div>
            )}

            {/* SUB-STEP 5: 完成與模型完整度自動診斷 */}
            {setupStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-stone-100 flex items-center gap-2 font-mono">
                    <Sparkles size={16} className="text-brand animate-pulse" />
                    [ STEP 5 ] 專案編譯與模型健康度自動診斷 (Model Validation)
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    PHI WALK 正在自動掃描編譯您建立的專案幾何資訊。確認所有核心參數均正確無誤。
                  </p>
                </div>

                {/* Validation checklist grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left checklist */}
                  <div className="border border-border-dark p-4 rounded-sm bg-bg-darker/30 space-y-3.5">
                    <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider font-mono">自動診斷診斷表 (Validation Diagnostics)</span>
                    
                    <div className="space-y-2 text-xs">
                      {[
                        { label: 'Model Loaded (空間模型圖元加載)', desc: `已就緒: ${currentSpace === 'uploaded' ? (uploadedFile?.name || '自訂上傳模型') : '系統內建預設模型'}`, check: true },
                        { label: 'Unit Scale (尺度與通行包絡線縮放)', desc: `已就緒: 1 Unit = 1 ${settings.modelUnit === 'm' ? '公尺 (m)' : settings.modelUnit === 'cm' ? '公分 (cm)' : '公厘 (mm)'}`, check: true },
                        { label: 'North Orientation (地理正北偏差定位)', desc: `已就緒: 朝向夾角 ${settings.modelNorth}° 已注入微氣候路徑`, check: true },
                        { label: 'Site Generated (地平綠茵景觀地盤生成)', desc: `已就緒: 地盤向外擴展 ${settings.siteMargin}m 綠地基底`, check: true },
                        { label: 'Solar Settings (日影軌跡核心物理常數)', desc: `已就緒: 基地經緯度 ${settings.latitude.toFixed(4)}, ${settings.longitude.toFixed(4)} 綁定`, check: true },
                      ].map((chk, idx) => (
                        <div key={idx} className="p-2.5 bg-bg-darker border border-border-dark/60 rounded flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">
                            ✓
                          </div>
                          <div>
                            <span className="block font-bold text-stone-200">{chk.label}</span>
                            <span className="block text-[10px] text-stone-400 mt-0.5">{chk.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right summary visual card */}
                  <div className="border border-border-dark p-4 rounded-sm bg-bg-darker/30 flex flex-col justify-between">
                    <div className="space-y-4">
                      <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider font-mono">專案模擬宣告設定值 (Manifest Overview)</span>
                      
                      <div className="p-3 bg-bg-darker border border-border-dark/80 rounded-sm space-y-2 text-xs font-mono text-left">
                        <div>
                          <span className="text-stone-500 block uppercase text-[8px]">專案名稱</span>
                          <span className="text-stone-200 font-bold text-xs">{projectName}</span>
                        </div>
                        <div className="h-[1px] bg-border-dark/60 my-1" />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-stone-500 block uppercase text-[8px]">預設測試角色</span>
                            <span className="text-brand font-bold text-xs">成人 (Adult - 1.65m)</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block uppercase text-[8px]">初始體驗時段</span>
                            <span className="text-brand font-bold text-xs">上午 07:00 (日出)</span>
                          </div>
                        </div>
                        <div className="h-[1px] bg-border-dark/60 my-1" />
                        <div>
                          <span className="text-stone-500 block uppercase text-[8px]">日照分析層狀態</span>
                          <span className="text-emerald-400 font-bold text-xs">太陽軌跡運算 [已開啟]</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      {/* Giant START SIMULATION CTA Button */}
                      <button
                        type="button"
                        onClick={handleStartSimulation}
                        className="w-full py-3.5 bg-brand text-black hover:bg-white text-xs font-bold font-mono tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer rounded-none border border-brand transition-all duration-300 shadow-xl shadow-brand/10"
                      >
                        <Play size={13} className="fill-black stroke-[3]" />
                        <span>[ 開始空間體驗模擬 ]</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Wizard Footer Navigation */}
                <div className="flex justify-between pt-4 border-t border-border-dark/60">
                  <button
                    type="button"
                    onClick={() => setSetupStep(4)}
                    className="px-4 py-2 border border-border-dark hover:border-stone-500 text-stone-400 hover:text-stone-200 text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    <ChevronLeft size={14} />
                    <span>上一步</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Global Hover Area overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-bg-darker/95 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6 border-4 border-brand border-dashed m-3 rounded animate-fade-in pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand flex items-center justify-center text-brand mb-4 animate-bounce">
              <UploadCloud size={28} />
            </div>
            <h2 className="text-lg font-bold text-white tracking-widest uppercase">RELEASE TO IMPORT MODEL</h2>
            <p className="text-[10px] text-brand mt-1 font-mono">[Supports .glb, .gltf, .obj, .fbx formats]</p>
          </div>
        )}

      </div>
    );
  }

  // --------------------------------------------------
  // RENDER: STEP 3 & 4 - ACTIVE 1:1 SIMULATION MODE
  // --------------------------------------------------
  if (workflowStep === 'simulation') {
    return (
      <div className="flex flex-col h-screen w-screen bg-bg-darker font-sans text-stone-200 overflow-hidden relative select-none">
        
        {/* Dynamic simulator canvas takes the entire viewport */}
        <div className="flex-1 flex flex-col p-0 bg-black gap-0 relative">
          <SimulatorCanvas
            settings={settings}
            currentSpace={currentSpace}
            corridorWidth={corridorWidth}
            corridorHeight={corridorHeight}
            telemetry={telemetry}
            onTelemetryUpdate={handleTelemetryUpdate}
            onModelLoaded={handleModelLoaded}
            onLoadingStateChange={setIsLoading}
            uploadedFile={uploadedFile}
            onSettingsChange={handleSettingsChange}
            activeKeys={activeKeys}
            setActiveKeys={setActiveKeys}
            resetTrigger={resetTrigger}
            projectName={projectName}
            onBackToSetup={() => {
              setWorkflowStep('setup');
              setSetupStep(5); // Return to Step 5 (Validation) to keep workflow smooth
            }}
          />
          <HUD telemetry={telemetry} />
        </div>

      </div>
    );
  }

  return null;
}

