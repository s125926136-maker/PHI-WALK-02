import React from 'react';
import { Minimize, Maximize, Settings } from 'lucide-react';
import { SpaceType } from '../types';

interface TopToolbarProps {
  projectName: string;
  currentSpace: SpaceType;
  isLocked: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  onOpenSetupConfirm: () => void;
}

export function TopToolbar({
  projectName,
  currentSpace,
  isLocked,
  isFullscreen,
  toggleFullscreen,
  onOpenSetupConfirm,
}: TopToolbarProps) {
  return (
    <div 
      className="absolute top-4 left-1/2 -translate-x-1/2 p-2 bg-stone-950/85 backdrop-blur-md border border-stone-800/80 rounded-full z-40 pointer-events-auto text-stone-300 font-sans text-xs flex items-center gap-4 px-4 shadow-xl select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-r border-stone-800 pr-3">
        <span className="font-extrabold text-white tracking-wide uppercase text-[11px]">
          {projectName || "PHI WALK V1.0"}
        </span>
        <span className="text-[10px] text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded-full font-mono">
          {currentSpace === 'corridor' ? '走廊廊道' : '客廳空間'}
        </span>
      </div>

      {/* Pointer Lock Help Indicator */}
      <div className="flex items-center gap-2 text-stone-400 text-[10.5px]">
        <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        <span>
          {isLocked ? '視角鎖定中 (按 Tab 釋放游標)' : '游標已釋放 (按 Tab/點擊 鎖定)'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 border-l border-stone-800 pl-3">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 rounded-full hover:bg-stone-900 transition-colors text-stone-300 hover:text-white cursor-pointer"
          title="全螢幕模式"
        >
          {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
        </button>

        <button
          type="button"
          onClick={onOpenSetupConfirm}
          className="flex items-center gap-1 bg-brand/10 hover:bg-brand text-brand hover:text-black border border-brand/30 hover:border-brand px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase transition-all cursor-pointer animate-pulse"
          style={{ animationDuration: '3s' }}
        >
          <Settings size={10} />
          <span>專案設定</span>
        </button>
      </div>
    </div>
  );
}
