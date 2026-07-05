import React from 'react';
import { Clock } from 'lucide-react';
import { PlayerSettings } from '../types';

interface TimeControlPanelProps {
  showTimeControl: boolean;
  setShowTimeControl: (show: boolean) => void;
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  isTimePlaying: boolean;
  setIsTimePlaying: (playing: boolean) => void;
  timeSpeed: '1x' | '2x' | '5x' | '10x';
  setTimeSpeed: (speed: '1x' | '2x' | '5x' | '10x') => void;
}

export function TimeControlPanel({
  showTimeControl,
  setShowTimeControl,
  settings,
  onSettingsChange,
  isTimePlaying,
  setIsTimePlaying,
  timeSpeed,
  setTimeSpeed,
}: TimeControlPanelProps) {
  if (!showTimeControl) return null;

  return (
    <div 
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-black/85 backdrop-blur-md border border-stone-800 rounded-sm px-6 py-4 flex flex-col gap-3 shadow-2xl min-w-[440px] animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center border-b border-stone-800/60 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-brand" />
          <span className="text-stone-200 font-bold font-mono text-xs uppercase tracking-wider">Time Console (時間分析控制台)</span>
        </div>
        <button 
          onClick={() => {
            setShowTimeControl(false);
            onSettingsChange({ viewMode: 'first-person' });
          }}
          className="text-stone-500 hover:text-white font-bold font-sans text-[10px] cursor-pointer"
        >
          [ 關閉 CLOSE ]
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Date Picker Component */}
        <div className="flex flex-col gap-1">
          <span className="text-stone-500 font-mono text-[9px] uppercase tracking-wider font-bold">DATE 分析日期</span>
          <div className="flex items-center justify-between border border-stone-800 bg-stone-950/40 rounded px-2.5 py-1 text-xs">
            <input 
              type="date" 
              value={settings.analysisDate} 
              onChange={(e) => onSettingsChange({ analysisDate: e.target.value })}
              className="bg-transparent border-none text-stone-200 focus:outline-none focus:ring-0 font-mono text-[11px] cursor-pointer w-full"
            />
          </div>
        </div>

        {/* Time Indicator & Picker */}
        <div className="flex flex-col gap-1">
          <span className="text-stone-500 font-mono text-[9px] uppercase tracking-wider font-bold">TIME 分析時間</span>
          <div className="flex items-center justify-between border border-stone-800 bg-stone-950/40 rounded px-2.5 py-1 text-xs text-brand font-bold font-mono">
            {settings.analysisTime}
          </div>
        </div>
      </div>

      {/* Time slider */}
      <div className="space-y-1 mt-1">
        <input 
          type="range"
          min="0"
          max="1439"
          value={(() => {
            const [h, m] = settings.analysisTime.split(':').map(Number);
            return h * 60 + m;
          })()}
          onChange={(e) => {
            const mins = parseInt(e.target.value, 10);
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            onSettingsChange({ analysisTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}` });
          }}
          className="w-full accent-brand h-1 bg-stone-900 appearance-none cursor-pointer"
        />
      </div>

      {/* Playback speed & Controls */}
      <div className="flex items-center justify-between pt-1 border-t border-stone-800/40">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsTimePlaying(!isTimePlaying)}
            className={`flex items-center justify-center w-8 h-8 rounded border transition-all cursor-pointer ${
              isTimePlaying 
                ? 'bg-brand border-brand text-black shadow-lg shadow-brand/20' 
                : 'bg-stone-900 border-stone-800 hover:border-stone-700 text-stone-300'
            }`}
          >
            {isTimePlaying ? <span className="text-[9px] font-bold">PAUSE</span> : <span className="text-[9px] font-bold">PLAY</span>}
          </button>

          <span className="text-stone-600 font-mono text-[9px] uppercase tracking-wider font-bold ml-2">SPEED:</span>
          <div className="flex gap-0.5 bg-stone-950 border border-stone-900 rounded p-0.5">
            {(['1x', '2x', '5x', '10x'] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setTimeSpeed(spd)}
                className={`px-2 py-1 rounded-xs text-[9px] font-mono font-bold transition-all cursor-pointer ${
                  timeSpeed === spd 
                    ? 'bg-brand text-black font-extrabold' 
                    : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'
                }`}
              >
                {spd}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[9px] text-stone-500 font-sans">
          * 時間快進將自動更新太陽陰影。
        </div>
      </div>
    </div>
  );
}
