import React from 'react';
import { TelemetryData } from '../../types';
import { SectionTitle, Checkbox } from './SharedComponents';

interface AccessibilityPanelProps {
  telemetry: TelemetryData;
  hudEnabledItems: Record<string, boolean>;
  setHudEnabledItems: React.Dispatch<React.SetStateAction<any>>;
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({
  telemetry,
  hudEnabledItems,
  setHudEnabledItems,
}) => {
  const handleHudSubChange = (key: string, checked: boolean) => {
    setHudEnabledItems((prev: any) => ({
      ...prev,
      [key]: checked
    }));
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="即時空間幾何與無障礙 (ADA Telemetry)" />
      
      {/* Realtime oppression progress */}
      <div className="space-y-1.5 p-2.5 bg-stone-950/40 border border-stone-900 rounded-sm">
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-stone-500 uppercase tracking-wider block font-bold">空間壓迫感指數 (Oppression)</span>
          <span className="font-bold font-mono text-xs text-stone-200">
            {telemetry.oppressionIndex.toFixed(0)} / 100
          </span>
        </div>

        <div className="h-1.5 w-full bg-stone-900 rounded-full overflow-hidden flex">
          <div 
            style={{ width: `${telemetry.oppressionIndex}%` }}
            className={`h-full transition-all duration-300 ${
              telemetry.oppressionIndex < 30 ? 'bg-emerald-500' :
              telemetry.oppressionIndex < 60 ? 'bg-sky-500' :
              telemetry.oppressionIndex < 80 ? 'bg-amber-500' : 'bg-red-500'
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-[9px] font-sans">
          <span className="text-stone-500">空間體驗感受:</span>
          {telemetry.oppressionLevel === 'spacious' && <span className="text-emerald-400 font-bold">開敞 (Spacious)</span>}
          {telemetry.oppressionLevel === 'comfortable' && <span className="text-sky-400 font-bold">舒適 (Comfortable)</span>}
          {telemetry.oppressionLevel === 'cozy' && <span className="text-amber-400 font-bold">緊湊 (Cozy)</span>}
          {telemetry.oppressionLevel === 'oppressive' && <span className="text-red-400 font-bold">壓迫 (Oppressive)</span>}
        </div>
      </div>

      {/* Accessibility status flag */}
      <div className="flex items-center justify-between p-2.5 bg-stone-950/40 border border-stone-900 rounded-sm">
        <div className="flex items-center gap-1 text-[8px] text-stone-400 font-sans font-bold">
          <span className={`w-1.5 h-1.5 rounded-full ${telemetry.isSafeForWheelchair ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span>輪椅無障礙通行 (ADA)</span>
        </div>
        <span className={`text-[8px] font-bold px-1 py-0.2 rounded-xs ${telemetry.isSafeForWheelchair ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {telemetry.isSafeForWheelchair ? '符合 PASS' : '受限 LIMITED'}
        </span>
      </div>

      {/* HUD Output Subscriptions */}
      <div className="border-t border-stone-900 pt-3 flex flex-col gap-2">
        <span className="text-[9px] text-stone-500 uppercase tracking-wider font-bold">輸出至 HUD (Data Output to HUD)</span>
        <div className="grid grid-cols-1 gap-1.5 bg-stone-900/30 p-2.5 rounded-sm border border-stone-900/60 font-sans text-[10.5px]">
          <Checkbox
            label="壓迫感 (Oppression) 🧠"
            checked={!!hudEnabledItems.oppression}
            onChange={(checked) => handleHudSubChange('oppression', checked)}
          />
          <Checkbox
            label="無障礙通行標準符合度 (ADA PASS) ♿"
            checked={!!hudEnabledItems.ada}
            onChange={(checked) => handleHudSubChange('ada', checked)}
          />
        </div>
      </div>
    </div>
  );
};
