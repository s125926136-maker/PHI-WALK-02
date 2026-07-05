import React from 'react';
import { User } from 'lucide-react';
import { PlayerSettings } from '../types';
import { HUMAN_PRESETS } from './TelemetryPanel';

interface TelemetryHUDProps {
  settings: PlayerSettings;
}

export function TelemetryHUD({ settings }: TelemetryHUDProps) {
  const currentPresetName = HUMAN_PRESETS.find(x => x.id === settings.presetId)?.name || '自訂 (Custom)';
  const currentPosture = settings.posture === 'crouching' ? '蹲下 (Crouching)' : 
                         settings.posture === 'sitting' ? '坐下 (Sitting)' : 
                         settings.presetId === 'wheelchair' ? '輪椅 (Wheelchair)' : '站立 (Standing)';

  return (
    <div 
      className="absolute top-6 left-6 z-20 pointer-events-none select-none flex flex-col gap-1.5 font-mono hud-scale bg-black/35 backdrop-blur-md p-3 border border-white/10 rounded-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 text-stone-300 font-extrabold border-b border-white/10 pb-1 mb-1 text-[10px] uppercase tracking-wider">
        <User size={12} className="text-[#F27D26] animate-pulse" />
        <span>Character HUD</span>
      </div>
      <div className="flex flex-col gap-1 text-[10px]">
        <div className="flex justify-between gap-8 items-center">
          <span className="text-stone-400 font-sans">身份 Role</span>
          <span className="text-[#F27D26] font-bold">{currentPresetName}</span>
        </div>
        <div className="flex justify-between gap-8 items-center">
          <span className="text-stone-400 font-sans">視線高度 Eye Height</span>
          <span className="text-white font-bold">{settings.eyeHeight.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between gap-8 items-center">
          <span className="text-stone-400 font-sans">目前狀態 State</span>
          <span className="text-emerald-400 font-bold">{currentPosture}</span>
        </div>
      </div>
    </div>
  );
}
