import React from 'react';
import { User, ChevronRight } from 'lucide-react';
import { PlayerSettings } from '../types';
import { HUMAN_PRESETS } from './TelemetryPanel';

interface SidebarPanelProps {
  isCharacterOpen: boolean;
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  setCharacterHovered: (hovered: boolean) => void;
  setCharacterClicked: (clicked: boolean) => void;
  characterClicked: boolean;
}

export function SidebarPanel({
  isCharacterOpen,
  settings,
  onSettingsChange,
  setCharacterHovered,
  setCharacterClicked,
  characterClicked,
}: SidebarPanelProps) {
  return (
    <div 
      className={`absolute top-0 left-0 h-full z-30 pointer-events-auto flex items-center transition-all duration-300 ${
        isCharacterOpen ? 'translate-x-0' : '-translate-x-[260px]'
      }`}
      onMouseEnter={() => setCharacterHovered(true)}
      onMouseLeave={() => setCharacterHovered(false)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Panel body */}
      <div className="w-[260px] h-full bg-stone-950/95 border-r border-stone-800/80 p-4 pt-16 flex flex-col gap-4 shadow-2xl overflow-y-auto">
        <div className="flex items-center gap-1.5 text-stone-200 font-bold border-b border-stone-800 pb-2 uppercase tracking-wider text-[11px]">
          <User size={13} className="text-[#F27D26]" />
          <span>模擬角色設定 (Character Dock)</span>
        </div>

        {/* Presets Horizontal Selector */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[9px] text-stone-500 uppercase tracking-wider block font-bold">人體尺度預設值 (Presets)</span>
          <div className="grid grid-cols-2 gap-1 font-sans">
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
                className={`py-1.5 px-1 border text-[9.5px] text-center transition-all cursor-pointer rounded-sm ${
                  settings.presetId === preset.id
                    ? 'bg-brand/20 border-brand text-brand font-bold'
                    : 'bg-stone-900/30 border-stone-900 hover:bg-stone-800 hover:border-stone-700 text-stone-400'
                }`}
              >
                <div className="font-bold truncate">{preset.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Movement Mode */}
        <div className="space-y-1.5 pt-1 border-t border-stone-800/50 pt-3">
          <span className="text-[9px] text-stone-500 uppercase tracking-wider block font-bold">漫遊移動模式 (Movement Mode)</span>
          <div className="grid grid-cols-2 gap-1 font-sans">
            <button
              type="button"
              onClick={() => onSettingsChange({ movementMode: 'architect' })}
              className={`py-1.5 px-1 border text-[9.5px] text-center transition-all cursor-pointer rounded-sm ${
                settings.movementMode === 'architect' || !settings.movementMode
                  ? 'bg-brand/20 border-brand text-brand font-bold'
                  : 'bg-stone-900/30 border-stone-900 hover:bg-stone-800 hover:border-stone-700 text-stone-400'
              }`}
            >
              <div className="font-bold truncate">🚶 Architect Walk</div>
            </button>
            <button
              type="button"
              onClick={() => onSettingsChange({ movementMode: 'explorer' })}
              className={`py-1.5 px-1 border text-[9.5px] text-center transition-all cursor-pointer rounded-sm ${
                settings.movementMode === 'explorer'
                  ? 'bg-brand/20 border-brand text-brand font-bold'
                  : 'bg-stone-900/30 border-stone-900 hover:bg-stone-800 hover:border-stone-700 text-stone-400'
              }`}
            >
              <div className="font-bold truncate">🏃 Explorer Mode</div>
            </button>
          </div>
          <p className="text-[8.5px] text-stone-500 leading-normal">
            {settings.movementMode === 'architect' || !settings.movementMode
              ? '🚶 建築漫遊（預設）：走路較慢 (1.45 m/s)，跳躍極低，平穩、真實步行，適合空間感知。'
              : '🏃 探索模式：走路較快 (2.2 m/s)，可快速跑步、正常跳躍，操作靈活，適合快速檢查。'}
          </p>
        </div>

        {/* Sliders */}
        <div className="space-y-3.5 border-t border-stone-800/50 pt-3 flex-1">
          {/* Eye height */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono items-center">
              <span className="text-stone-500">模擬眼高 (Eye Height)</span>
              <div className="flex items-center gap-0.5 bg-stone-900 px-1 border border-stone-800 rounded">
                <input 
                  type="number" 
                  min="0.5" 
                  max="2.2" 
                  step="0.01" 
                  value={settings.eyeHeight} 
                  onChange={(e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    val = Math.max(0.5, Math.min(2.2, val));
                    onSettingsChange({ eyeHeight: val });
                  }}
                  className="bg-transparent border-none focus:outline-none focus:ring-0 font-bold text-stone-200 text-center w-10 py-0 text-[10px]"
                />
                <span className="text-stone-500 text-[8.5px]">m</span>
              </div>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.01"
              value={settings.eyeHeight}
              onChange={(e) => onSettingsChange({ eyeHeight: parseFloat(e.target.value) })}
              className="w-full accent-brand h-1 bg-stone-900 appearance-none cursor-pointer"
            />
          </div>

          {/* Shoulder Width */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono items-center">
              <span className="text-stone-500">雙肩寬度 (Body Width)</span>
              <div className="flex items-center gap-0.5 bg-stone-900 px-1 border border-stone-800 rounded">
                <input 
                  type="number" 
                  min="0.4" 
                  max="1.2" 
                  step="0.01" 
                  value={settings.bodyWidth} 
                  onChange={(e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    val = Math.max(0.4, Math.min(1.2, val));
                    onSettingsChange({ bodyWidth: val });
                  }}
                  className="bg-transparent border-none focus:outline-none focus:ring-0 font-bold text-stone-200 text-center w-10 py-0 text-[10px]"
                />
                <span className="text-stone-500 text-[8.5px]">m</span>
              </div>
            </div>
            <input
              type="range"
              min="0.4"
              max="1.2"
              step="0.01"
              value={settings.bodyWidth}
              onChange={(e) => onSettingsChange({ bodyWidth: parseFloat(e.target.value) })}
              className="w-full accent-brand h-1 bg-stone-900 appearance-none cursor-pointer"
            />
          </div>

          {/* Walk Speed */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono items-center">
              <span className="text-stone-500">移動速度 (Move Speed)</span>
              <div className="flex items-center gap-0.5 bg-stone-900 px-1 border border-stone-800 rounded">
                <input 
                  type="number" 
                  min="0.5" 
                  max="8.0" 
                  step="0.1" 
                  value={settings.currentMoveSpeed} 
                  onChange={(e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    val = Math.max(0.5, Math.min(8.0, val));
                    onSettingsChange({ currentMoveSpeed: val });
                  }}
                  className="bg-transparent border-none focus:outline-none focus:ring-0 font-bold text-stone-200 text-center w-10 py-0 text-[10px]"
                />
                <span className="text-stone-500 text-[8.5px]">m/s</span>
              </div>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.1"
              value={settings.currentMoveSpeed}
              onChange={(e) => onSettingsChange({ currentMoveSpeed: parseFloat(e.target.value) })}
              className="w-full accent-brand h-1 bg-stone-900 appearance-none cursor-pointer"
            />
          </div>

          {/* Jump height */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono items-center">
              <span className="text-stone-500">跳躍推力 (Jump Power)</span>
              <div className="flex items-center gap-0.5 bg-stone-900 px-1 border border-stone-800 rounded">
                <input 
                  type="number" 
                  min="0.0" 
                  max="10.0" 
                  step="0.1" 
                  value={settings.jumpPower !== undefined ? settings.jumpPower : 4.2} 
                  onChange={(e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    val = Math.max(0.0, Math.min(10.0, val));
                    onSettingsChange({ jumpPower: val });
                  }}
                  className="bg-transparent border-none focus:outline-none focus:ring-0 font-bold text-stone-200 text-center w-10 py-0 text-[10px]"
                />
                <span className="text-stone-500 text-[8.5px]">m/s</span>
              </div>
            </div>
            <input
              type="range"
              min="0.0"
              max="10.0"
              step="0.1"
              value={settings.jumpPower !== undefined ? settings.jumpPower : 4.2}
              onChange={(e) => onSettingsChange({ jumpPower: parseFloat(e.target.value) })}
              className="w-full accent-brand h-1 bg-stone-900 appearance-none cursor-pointer"
            />
          </div>

          {/* Wheelchair Toggle */}
          <div className="flex justify-between items-center bg-stone-900/30 p-2 border border-stone-900/60 rounded mt-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-stone-300">輪椅友善模擬</span>
              <span className="text-[8px] text-stone-500 leading-normal">0.9m 面寬及干涉</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const isWheel = settings.presetId === 'wheelchair';
                if (isWheel) {
                  onSettingsChange({
                    presetId: 'adult',
                    eyeHeight: 1.65,
                    bodyWidth: 0.72,
                    reachRadius: 0.75,
                    currentMoveSpeed: 2.2
                  });
                } else {
                  onSettingsChange({
                    presetId: 'wheelchair',
                    eyeHeight: 1.20,
                    bodyWidth: 0.90,
                    reachRadius: 0.60,
                    currentMoveSpeed: 2.2 * 0.75
                  });
                }
              }}
              className={`px-2 py-1 border text-[9px] font-bold rounded-sm transition-all cursor-pointer ${
                settings.presetId === 'wheelchair'
                  ? 'bg-brand/20 border-brand text-brand shadow-sm shadow-brand/10'
                  : 'bg-stone-950 border-stone-800 text-stone-500 hover:text-stone-300'
              }`}
            >
              {settings.presetId === 'wheelchair' ? '已啟用' : '已停用'}
            </button>
          </div>
        </div>
      </div>

      {/* Vertical Tab Handle */}
      <div 
        onClick={() => setCharacterClicked(!characterClicked)}
        className={`w-8 py-6 bg-stone-950/90 border-y border-r border-stone-800/80 hover:border-brand/50 text-stone-400 hover:text-brand font-bold text-[9px] leading-[11px] uppercase tracking-widest flex flex-col items-center justify-center gap-1.5 rounded-r cursor-pointer transition-all shadow-xl select-none ${
          isCharacterOpen ? 'text-brand' : ''
        }`}
      >
        <User size={12} className={isCharacterOpen ? 'text-brand' : 'text-stone-500'} />
        <div className="flex flex-col gap-0.5 items-center">
          {"角色設定".split("").map((char, idx) => (
            <span key={idx}>{char}</span>
          ))}
        </div>
        <ChevronRight size={10} className={`mt-1 transition-transform ${isCharacterOpen ? 'rotate-180 text-brand' : ''}`} />
      </div>
    </div>
  );
}
