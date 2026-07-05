/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { 
  Upload, 
  Layers, 
  Home, 
  Building, 
  Sliders, 
  CheckCircle, 
  AlertTriangle, 
  FileCode, 
  HelpCircle,
  Accessibility
} from 'lucide-react';
import { SpaceType, ModelFileInfo, SpacePreset } from '../types';

interface ModelSelectorProps {
  currentSpace: SpaceType;
  onSpaceChange: (space: SpaceType) => void;
  corridorWidth: number;
  onCorridorWidthChange: (w: number) => void;
  corridorHeight: number;
  onCorridorHeightChange: (h: number) => void;
  fileInfo: ModelFileInfo | null;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

export const SPACE_PRESETS: SpacePreset[] = [
  {
    id: 'apartment',
    name: 'Multi-Room Apartment (住宅公寓)',
    description: 'A standard domestic scale apartment with a living room, 0.9m narrow hallway, bedroom, and kitchen. Perfect for studying daily residential walkability and wheelchair accessibility.',
    ceilingDefault: 2.8,
  },
  {
    id: 'gallery',
    name: 'Exhibition Gallery (挑高美術館)',
    description: 'A grand exhibition space with 6.0m high ceilings, structural columns, and a mezzanine floor connected via a walkable standard staircase. Ideal for examining double-volume spatial perception.',
    ceilingDefault: 6.0,
  },
  {
    id: 'corridor',
    name: 'Interactive Test Corridor (可變通道體驗)',
    description: 'An interactive experimental corridor. Dynamically adjust walkway width and ceiling height in real-time to locate your custom comfort threshold and spatial compression boundaries.',
    ceilingDefault: 2.4,
    corridorDefault: 1.2,
  },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentSpace,
  onSpaceChange,
  corridorWidth,
  onCorridorWidthChange,
  corridorHeight,
  onCorridorHeightChange,
  fileInfo,
  onFileUpload,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  // Run dynamic architectural analysis on the active spatial dimensions
  const getActiveDimensions = () => {
    if (currentSpace === 'apartment') {
      return { width: 0.9, height: 2.8, name: 'Apartment Hallway' };
    } else if (currentSpace === 'gallery') {
      return { width: 7.0, height: 6.0, name: 'Gallery Main Hall' };
    } else if (currentSpace === 'corridor') {
      return { width: corridorWidth, height: corridorHeight, name: 'Test Corridor' };
    } else {
      return { 
        width: fileInfo?.dimensions ? Math.min(fileInfo.dimensions.x, fileInfo.dimensions.z) : 1.2, 
        height: fileInfo?.dimensions ? fileInfo.dimensions.y : 2.5,
        name: fileInfo?.name || 'Uploaded Model' 
      };
    }
  };

  const dims = getActiveDimensions();

  // Compliance checklists
  const checkAdultPass = dims.width >= 0.75;
  const checkWheelchairPass = dims.width >= 0.90;
  const checkWheelchairComfort = dims.width >= 1.50;
  const checkCeilingPass = dims.height >= 2.10;
  const checkCeilingComfort = dims.height >= 2.80;

  return (
    <div className="flex flex-col h-full bg-bg-dark border-r border-border-dark text-stone-200 select-none text-sm w-full">
      {/* Scrollable container for sidebar content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {/* SECTION 1: SPATIAL TEMPLATES */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-l-2 border-brand pl-2 pb-0.5">
            <span className="text-[11px] font-bold text-brand uppercase tracking-widest">1. 選擇空間場景 (Scene Template)</span>
          </div>
          
          <div className="space-y-2">
            {SPACE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                id={`btn-space-${preset.id}`}
                onClick={() => onSpaceChange(preset.id)}
                className={`w-full text-left p-3 border transition-all ${
                  currentSpace === preset.id
                    ? 'bg-brand/10 border-brand text-white shadow-md shadow-brand/10'
                    : 'bg-bg-mid/40 border-border-dark hover:bg-bg-mid hover:border-border-mid text-stone-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {preset.id === 'apartment' && <Home size={13} className="text-brand" />}
                  {preset.id === 'gallery' && <Building size={13} className="text-brand" />}
                  {preset.id === 'corridor' && <Sliders size={13} className="text-brand" />}
                  <span className="font-semibold text-xs tracking-wider uppercase text-stone-100 font-mono">{preset.name}</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed font-sans">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* INTERACTIVE CORRIDOR CONTROLS (Only visible if Corridor is selected) */}
        {currentSpace === 'corridor' && (
          <div className="p-3 bg-brand/5 border border-brand/20 rounded-none space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-brand font-bold text-[11px] uppercase tracking-widest">
              <Sliders size={13} />
              <span>動態通道引數微調 (Parameters)</span>
            </div>
            
            {/* Width Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-stone-400">走道寬度 (Walkway Width)</span>
                <span className="text-brand font-bold">{corridorWidth.toFixed(2)} m</span>
              </div>
              <input
                id="slider-corridor-width"
                type="range"
                min="0.6"
                max="2.5"
                step="0.05"
                value={corridorWidth}
                onChange={(e) => onCorridorWidthChange(parseFloat(e.target.value))}
                className="w-full accent-brand h-1 bg-bg-mid appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>0.6m (極窄)</span>
                <span>1.2m (標準)</span>
                <span>2.5m (寬敞)</span>
              </div>
            </div>

            {/* Height Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-stone-400">天花板高度 (Ceiling Height)</span>
                <span className="text-brand font-bold">{corridorHeight.toFixed(2)} m</span>
              </div>
              <input
                id="slider-corridor-height"
                type="range"
                min="1.8"
                max="4.5"
                step="0.05"
                value={corridorHeight}
                onChange={(e) => onCorridorHeightChange(parseFloat(e.target.value))}
                className="w-full accent-brand h-1 bg-bg-mid appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>1.8m (壓迫)</span>
                <span>2.4m (一般)</span>
                <span>4.5m (挑高)</span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: FILE UPLOADER */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-l-2 border-brand pl-2 pb-0.5">
            <span className="text-[11px] font-bold text-brand uppercase tracking-widest">2. 匯入自訂 3D 模型 (Import Model)</span>
          </div>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed p-4 text-center cursor-pointer transition-all ${
              currentSpace === 'uploaded'
                ? 'border-brand bg-brand/10'
                : 'border-border-dark hover:border-brand/40 hover:bg-bg-mid/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,.obj,.fbx"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-stone-300 font-mono uppercase tracking-wider">[Parsing meshes...]</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto w-8 h-8 bg-bg-mid flex items-center justify-center text-stone-400">
                  <Upload size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-200">點擊或拖曳 3D 模型至此</p>
                  <p className="text-[10px] text-stone-500 mt-1 font-mono uppercase tracking-wider">GLB, GLTF, FBX, OBJ</p>
                </div>
              </div>
            )}
          </div>

          {/* Model File Metadata details if uploaded */}
          {fileInfo && (
            <div className="p-3 bg-bg-darker border border-border-dark text-xs space-y-2">
              <div className="flex items-center gap-2 text-brand font-semibold border-b border-border-dark pb-1 font-mono">
                <FileCode size={13} />
                <span className="truncate">{fileInfo.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1 font-mono text-[11px] text-stone-400">
                <span>檔案大小:</span>
                <span className="text-stone-300 text-right">{fileInfo.size}</span>
                <span>網格物件:</span>
                <span className="text-stone-300 text-right">{fileInfo.meshCount} meshes</span>
                {fileInfo.vertexCount > 0 && (
                  <>
                    <span>頂點數量:</span>
                    <span className="text-stone-300 text-right">{fileInfo.vertexCount.toLocaleString()}</span>
                  </>
                )}
                {fileInfo.dimensions && (
                  <>
                    <span>模型包圍盒:</span>
                    <span className="text-stone-300 text-right">
                      {fileInfo.dimensions.x.toFixed(1)}x{fileInfo.dimensions.y.toFixed(1)}x{fileInfo.dimensions.z.toFixed(1)}m
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => onSpaceChange('uploaded')}
                className={`w-full py-1.5 px-3 text-center text-xs font-bold transition-all uppercase tracking-wider rounded-sm ${
                  currentSpace === 'uploaded'
                    ? 'bg-brand text-black hover:bg-white'
                    : 'bg-bg-mid border border-border-dark text-stone-300 hover:text-white'
                }`}
              >
                開啟此匯入模型
              </button>
            </div>
          )}
        </div>

        {/* SECTION 3: ARCHITECTURAL ACCESSIBILITY CHECKLIST */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-l-2 border-brand pl-2 pb-0.5">
            <span className="text-[11px] font-bold text-brand uppercase tracking-widest">3. 尺度規範檢驗 (Accessibility Analyser)</span>
          </div>

          <div className="p-3 bg-bg-darker border border-border-dark space-y-3">
            <div className="text-[11px] text-stone-400 leading-relaxed font-sans">
              以當前體驗區域的臨界尺寸 (<span className="font-semibold text-stone-200">{dims.name}</span>) 評估通用設計 (Universal Design) 與無障礙規範：
            </div>

            <div className="space-y-2 text-xs">
              {/* Corridor Width Adult walking check */}
              <div className="flex items-start justify-between gap-2 p-1.5 bg-bg-mid/30 border border-border-dark">
                <div className="space-y-0.5">
                  <p className="font-semibold text-stone-200">單人行進通道 &gt; 0.75m</p>
                  <p className="text-[10px] text-stone-400 leading-tight">滿足一般人基本站立與行走所須寬度。</p>
                </div>
                {checkAdultPass ? (
                  <CheckCircle size={15} className="text-brand shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                )}
              </div>

              {/* Wheelchair minimum clearance */}
              <div className="flex items-start justify-between gap-2 p-1.5 bg-bg-mid/30 border border-border-dark">
                <div className="space-y-0.5">
                  <p className="font-semibold text-stone-200">輪椅通行寬度 &gt; 0.90m</p>
                  <p className="text-[10px] text-stone-400 leading-tight">內政部無障礙通路最低門檻、輪椅基本前進需求。</p>
                </div>
                {checkWheelchairPass ? (
                  <CheckCircle size={15} className="text-brand shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                )}
              </div>

              {/* Wheelchair comfort / turning */}
              <div className="flex items-start justify-between gap-2 p-1.5 bg-bg-mid/30 border border-border-dark">
                <div className="space-y-0.5">
                  <p className="font-semibold text-stone-200">輪椅雙向/迴轉 &gt; 1.50m</p>
                  <p className="text-[10px] text-stone-400 leading-tight">可供一台輪椅進行 180 度迴轉或雙向錯車避讓。</p>
                </div>
                {checkWheelchairComfort ? (
                  <CheckCircle size={15} className="text-brand shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={15} className="text-brand opacity-60 shrink-0 mt-0.5" />
                )}
              </div>

              {/* Ceiling minimal legal height */}
              <div className="flex items-start justify-between gap-2 p-1.5 bg-bg-mid/30 border border-border-dark">
                <div className="space-y-0.5">
                  <p className="font-semibold text-stone-200">法規淨高淨寬 &gt; 2.10m</p>
                  <p className="text-[10px] text-stone-400 leading-tight">建築法規室內避難通路/樓梯最小淨高度。</p>
                </div>
                {checkCeilingPass ? (
                  <CheckCircle size={15} className="text-brand shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                )}
              </div>

              {/* Ceiling comfort height */}
              <div className="flex items-start justify-between gap-2 p-1.5 bg-bg-mid/30 border border-border-dark">
                <div className="space-y-0.5">
                  <p className="font-semibold text-stone-200">舒適天花板高 &gt; 2.80m</p>
                  <p className="text-[10px] text-stone-400 leading-tight">一般住宅之舒適非壓迫高度，有利於空間採光與氣流通暢。</p>
                </div>
                {checkCeilingComfort ? (
                  <CheckCircle size={15} className="text-brand shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={15} className="text-stone-500 shrink-0 mt-0.5" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Informative Footer */}
      <div className="p-3 border-t border-border-dark bg-bg-darker text-[10px] font-mono uppercase text-stone-400 flex items-start gap-1.5 leading-relaxed">
        <HelpCircle size={12} className="text-brand shrink-0 mt-0.5" />
        <span>[Drag & Drop GLB/GLTF model here to start real-time spatial experience emulation instantly]</span>
      </div>
    </div>
  );
};
