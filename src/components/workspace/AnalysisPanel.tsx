import React from 'react';
import { SectionTitle, Slider } from './SharedComponents';

interface AnalysisPanelProps {
  windSpeed: number;
  setWindSpeed: (val: number) => void;
  windAngle: number;
  setWindAngle: (val: number) => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  windSpeed,
  setWindSpeed,
  windAngle,
  setWindAngle,
}) => {
  return (
    <div className="space-y-4">
      <SectionTitle title="微氣候流場與風向設定 (Wind Config)" />
      
      {/* Wind Speed */}
      <Slider 
        label="風速大小 (Wind Velocity)"
        min={0}
        max={15}
        step={0.1}
        value={windSpeed}
        onChange={setWindSpeed}
        suffix=" m/s"
        accentClass="accent-cyan-400"
        minLabel="0.0 (靜風)"
        maxLabel="15.0 (強風)"
      />

      {/* Wind Angle Direction */}
      <Slider 
        label="風向角度 (Wind Azimuth)"
        min={0}
        max={360}
        step={1}
        value={windAngle}
        onChange={setWindAngle}
        suffix="°"
        accentClass="accent-cyan-400"
        minLabel="N 0°"
        maxLabel="W 270°"
      />

      {/* Dynamic microclimate evaluation */}
      <div className="p-3 bg-stone-950/40 border border-stone-900 rounded-sm space-y-2">
        <span className="text-[8px] text-stone-500 uppercase tracking-wider font-bold block">風場微氣候評等 (Ventilation Evaluation)</span>
        
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-stone-300 font-sans">空氣流通效益</span>
          {windSpeed === 0 ? (
            <span className="text-red-400 font-bold text-[10px]">無風停滯 (Stagnant)</span>
          ) : windSpeed < 2 ? (
            <span className="text-amber-400 font-bold text-[10px]">微風流通 (Slight)</span>
          ) : windSpeed < 6 ? (
            <span className="text-emerald-400 font-bold text-[10px]">優良通風 (Excellent)</span>
          ) : (
            <span className="text-sky-400 font-bold text-[10px]">強風吹襲 (High Draft)</span>
          )}
        </div>
        
        <p className="text-[8px] text-stone-500 leading-normal font-sans">
          {windSpeed === 0 && '當前風速為零，局部區域可能產生悶熱或懸浮微粒停滯積聚。'}
          {windSpeed > 0 && windSpeed < 2 && '局部空氣緩慢交換。適合靜態休閒，但高密度人群中散熱能效有限。'}
          {windSpeed >= 2 && windSpeed < 6 && '理想的建築微氣候通風。提供適度的對流降溫效能，無吹拂不適感。'}
          {windSpeed >= 6 && '高廊道風速。可能會對步行者者遮陽傘、輕質戶外傢俱造成中度干涉影響。'}
        </p>
      </div>
    </div>
  );
};
