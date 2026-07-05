import React from 'react';
import { Scale } from 'lucide-react';
import { ModelUnit, PlayerSettings } from '../types';

interface LoadingOverlayProps {
  detectedUnit: ModelUnit | null;
  detectedDimensions: { x: number; y: number; z: number } | null;
  setDetectedUnit: (unit: ModelUnit | null) => void;
  loadError: string | null;
  setLoadError: (error: string | null) => void;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
}

export function LoadingOverlay({
  detectedUnit,
  detectedDimensions,
  setDetectedUnit,
  loadError,
  setLoadError,
  onSettingsChange,
}: LoadingOverlayProps) {
  return (
    <>
      {/* MODEL UNIT DETECTED ALERT OVERLAY */}
      {detectedUnit && detectedDimensions && (
        <div className="absolute top-16 left-4 right-4 bg-bg-dark/95 backdrop-blur border border-brand/50 p-4 shadow-xl z-20 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in select-text">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand/10 border border-brand/30 text-brand shrink-0">
              <Scale size={20} />
            </div>
            <div>
              <h4 className="text-brand font-bold text-xs tracking-wider flex items-center gap-1.5 font-mono uppercase">
                ✔ 自動偵測尺寸 (Auto-Detect Model Units)
              </h4>
              <p className="text-[11px] text-stone-300 mt-1.5 leading-relaxed font-sans">
                偵測到模型 Bounding Box 原始尺寸為：
                <span className="text-stone-100 font-mono font-bold bg-bg-mid border border-border-dark px-1.5 py-0.5 mx-1 rounded">
                  X = {detectedDimensions.x.toFixed(1)} | Y = {detectedDimensions.y.toFixed(1)} | Z = {detectedDimensions.z.toFixed(1)}
                </span>
                <br />
                這極度看起來像是以 <span className="text-brand font-bold uppercase font-mono">{detectedUnit === 'mm' ? '公釐 (mm)' : detectedUnit === 'cm' ? '公分 (cm)' : detectedUnit === 'ft' ? '英尺 (ft)' : '公尺 (m)'}</span> 為設計單位。是否採用此偵測到的模型單位？
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              onClick={() => {
                onSettingsChange({ modelUnit: detectedUnit });
                setDetectedUnit(null);
              }}
              className="px-3 py-1.5 bg-brand hover:bg-white text-black text-xs font-mono font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all border border-brand"
            >
              採用 ({detectedUnit.toUpperCase()})
            </button>
            <button
              onClick={() => setDetectedUnit(null)}
              className="px-3 py-1.5 bg-bg-mid/60 border border-border-dark hover:border-border-mid text-stone-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all"
            >
              保持原本
            </button>
          </div>
        </div>
      )}

      {/* LOADING INDICATOR OVERLAY */}
      {loadError && (
        <div className="absolute inset-0 bg-bg-darker/95 flex flex-col items-center justify-center text-center p-6 z-10">
          <div className="text-rose-500 text-3xl mb-3">⚠️</div>
          <h3 className="text-stone-100 font-bold text-xs uppercase tracking-wider font-mono">Model Loading Failed</h3>
          <p className="text-xs text-stone-400 mt-2 max-w-md leading-relaxed">
            {loadError}
          </p>
          <button 
            onClick={() => {
              setLoadError(null);
              onSettingsChange({ presetId: 'adult' });
            }}
            className="mt-4 px-3 py-1.5 bg-brand text-black hover:bg-white border border-brand font-bold text-xs uppercase tracking-wider rounded-sm transition-all cursor-pointer"
          >
            返回預設場景
          </button>
        </div>
      )}
    </>
  );
}
