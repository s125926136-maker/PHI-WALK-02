import React from 'react';
import { PlayerSettings } from '../types';

interface DebugOverlayProps {
  activeKeys: Record<string, boolean>;
  settings: PlayerSettings;
  showTimeControl: boolean;
  isLocked: boolean;
}

export function DebugOverlay({
  activeKeys,
  settings,
  showTimeControl,
  isLocked,
}: DebugOverlayProps) {
  return (
    <div 
      className="absolute bottom-6 left-6 z-20 pointer-events-none select-none flex flex-col gap-3.5 animate-fade-in font-mono hud-scale"
      onClick={(e) => e.stopPropagation()}
    >
      {/* WASD Cluster + Move Label */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div>
            <div className={`w-8 h-8 rounded border flex items-center justify-center font-bold text-xs transition-all pointer-events-none ${
              activeKeys['w'] 
                ? 'bg-[#F27D26] border-[#F27D26] text-black scale-95 shadow-lg shadow-[#F27D26]/20 opacity-100' 
                : 'bg-black/30 border-white/20 text-white/80 opacity-40'
            }`}>W</div>
          </div>
          <div className="flex gap-1">
            <div className={`w-8 h-8 rounded border flex items-center justify-center font-bold text-xs transition-all pointer-events-none ${
              activeKeys['a'] 
                ? 'bg-[#F27D26] border-[#F27D26] text-black scale-95 shadow-lg shadow-[#F27D26]/20 opacity-100' 
                : 'bg-black/30 border-white/20 text-white/80 opacity-40'
            }`}>A</div>
            <div className={`w-8 h-8 rounded border flex items-center justify-center font-bold text-xs transition-all pointer-events-none ${
              activeKeys['s'] 
                ? 'bg-[#F27D26] border-[#F27D26] text-black scale-95 shadow-lg shadow-[#F27D26]/20 opacity-100' 
                : 'bg-black/30 border-white/20 text-white/80 opacity-40'
            }`}>S</div>
            <div className={`w-8 h-8 rounded border flex items-center justify-center font-bold text-xs transition-all pointer-events-none ${
              activeKeys['d'] 
                ? 'bg-[#F27D26] border-[#F27D26] text-black scale-95 shadow-lg shadow-[#F27D26]/20 opacity-100' 
                : 'bg-black/30 border-white/20 text-white/80 opacity-40'
            }`}>D</div>
          </div>
        </div>
        
        <div className={`flex flex-col leading-tight transition-opacity duration-200 ${(activeKeys['w'] || activeKeys['a'] || activeKeys['s'] || activeKeys['d']) ? 'opacity-100' : 'opacity-40'}`}>
          <span className={`text-[10px] font-bold tracking-wider ${(activeKeys['w'] || activeKeys['a'] || activeKeys['s'] || activeKeys['d']) ? 'text-[#F27D26]' : 'text-stone-300'}`}>Move</span>
          <span className="text-[8px] text-stone-500 font-sans">WASD 移動</span>
        </div>
      </div>

      {/* Other HUD elements */}
      <div className="flex flex-col gap-1.5 pl-1">
        {[
          { key: 'SHIFT', label: 'Sprint', sub: '快走', active: activeKeys['shift'] },
          { key: 'CTRL', label: 'Crouch', sub: '蹲下 (Toggle)', active: settings.posture === 'crouching' },
          { key: 'SPACE', label: 'Jump', sub: '跳躍', active: activeKeys[' '] },
          { key: 'C', label: 'Sit', sub: '坐下 (Toggle)', active: settings.posture === 'sitting' },
          { key: 'E', label: 'Reach', sub: '伸手', active: activeKeys['e'] },
          { key: 'T', label: 'Time', sub: '時間 (Toggle)', active: showTimeControl },
          { key: 'TAB', label: 'Cursor', sub: '滑鼠游標', active: !isLocked },
          { key: '1', label: '1P', sub: '第一人稱', active: settings.viewMode === 'first-person' },
          { key: '3', label: 'Analysis', sub: '分析視角', active: settings.viewMode === 'third-person' },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className={`h-6 rounded border flex items-center justify-center font-bold font-mono text-[9px] transition-all px-2 pointer-events-none ${
              item.active 
                ? 'bg-[#F27D26] border-[#F27D26] text-black scale-95 shadow-md shadow-[#F27D26]/20 opacity-100' 
                : 'bg-black/30 border-white/20 text-white/80 opacity-40'
            } min-w-[48px]`}>
              {item.key}
            </div>
            <div className={`flex flex-col leading-tight transition-opacity duration-200 ${item.active ? 'opacity-100' : 'opacity-40'}`}>
              <span className={`text-[10px] font-bold tracking-wide ${item.active ? 'text-[#F27D26]' : 'text-stone-300'}`}>{item.label}</span>
              <span className="text-[8px] text-stone-500 font-sans">{item.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
