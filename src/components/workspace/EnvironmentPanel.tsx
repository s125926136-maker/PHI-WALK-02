import React from 'react';
import { PlayerSettings } from '../../types';
import { SectionTitle, Slider } from './SharedComponents';

interface EnvironmentPanelProps {
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
}

export const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const currentTotalMinutes = React.useMemo(() => {
    const [h, m] = settings.analysisTime.split(':').map(Number);
    return h * 60 + m;
  }, [settings.analysisTime]);

  const handleTimeChange = (totalMin: number) => {
    const h = Math.floor(totalMin / 60);
    const m = Math.floor(totalMin % 60);
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    onSettingsChange({ analysisTime: timeStr });
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="環境與正北設定 (Geoloc & North)" />
      
      {/* Model North Offset Angle */}
      <Slider 
        label="正北偏移角度 (True North)"
        min={0}
        max={360}
        step={1}
        value={settings.modelNorth || 0}
        onChange={(val) => onSettingsChange({ modelNorth: Math.floor(val) })}
        suffix="°"
      />

      {/* Latitude */}
      <Slider 
        label="緯度 (Latitude)"
        min={-90}
        max={90}
        step={0.0001}
        value={settings.latitude}
        onChange={(val) => onSettingsChange({ latitude: val })}
        suffix="°"
      />

      {/* Longitude */}
      <Slider 
        label="經度 (Longitude)"
        min={-180}
        max={180}
        step={0.0001}
        value={settings.longitude}
        onChange={(val) => onSettingsChange({ longitude: val })}
        suffix="°"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-stone-500 font-mono text-[8px] uppercase tracking-wider font-bold">分析日期 DATE</span>
          <input 
            type="date" 
            value={settings.analysisDate} 
            onChange={(e) => onSettingsChange({ analysisDate: e.target.value })}
            className="bg-stone-950/40 border border-stone-800 text-stone-200 font-mono text-[10px] p-1.5 rounded focus:outline-none w-full cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-stone-500 font-mono text-[8px] uppercase tracking-wider font-bold">分析時間 TIME</span>
          <div className="bg-stone-950/40 border border-stone-800 text-stone-200 font-mono text-[10px] p-1.5 rounded text-center font-bold text-brand">
            {settings.analysisTime}
          </div>
        </div>
      </div>

      {/* Time slider for continuous solar feedback */}
      <Slider 
        label="模擬時間快速拉桿 (Time Sweep)"
        min={0}
        max={1439}
        step={1}
        value={currentTotalMinutes}
        onChange={handleTimeChange}
      />
    </div>
  );
};
