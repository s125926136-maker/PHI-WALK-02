import React from 'react';
import { PlayerSettings } from '../../types';
import { SectionTitle, Checkbox } from './SharedComponents';

interface MeasurePanelProps {
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  analysisCeilingHeightEnabled: boolean;
  setAnalysisCeilingHeightEnabled: (val: boolean) => void;
  analysisWalkwayWidthEnabled: boolean;
  setAnalysisWalkwayWidthEnabled: (val: boolean) => void;
  analysisWallDistanceEnabled: boolean;
  setAnalysisWallDistanceEnabled: (val: boolean) => void;
  analysisEyeRayEnabled: boolean;
  setAnalysisEyeRayEnabled: (val: boolean) => void;
  analysisEyeLevelEnabled: boolean;
  setAnalysisEyeLevelEnabled: (val: boolean) => void;
  analysisDimensionLabelsEnabled: boolean;
  setAnalysisDimensionLabelsEnabled: (val: boolean) => void;
  analysisMeasureArrowEnabled: boolean;
  setAnalysisMeasureArrowEnabled: (val: boolean) => void;
  hudEnabledItems: Record<string, boolean>;
  setHudEnabledItems: React.Dispatch<React.SetStateAction<any>>;
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({
  onSettingsChange,
  analysisCeilingHeightEnabled,
  setAnalysisCeilingHeightEnabled,
  analysisWalkwayWidthEnabled,
  setAnalysisWalkwayWidthEnabled,
  analysisWallDistanceEnabled,
  setAnalysisWallDistanceEnabled,
  analysisEyeRayEnabled,
  setAnalysisEyeRayEnabled,
  analysisEyeLevelEnabled,
  setAnalysisEyeLevelEnabled,
  analysisDimensionLabelsEnabled,
  setAnalysisDimensionLabelsEnabled,
  analysisMeasureArrowEnabled,
  setAnalysisMeasureArrowEnabled,
  hudEnabledItems,
  setHudEnabledItems,
}) => {
  const helpers = [
    {
      label: 'Eye-to-Ceiling 視線至天花板',
      checked: analysisCeilingHeightEnabled,
      onChange: (val: boolean) => {
        setAnalysisCeilingHeightEnabled(val);
        if (val) onSettingsChange({ showMeasureVisualization: true });
      },
      desc: '垂直向上 Raycast 量測眼睛（視線）到天花板的即時淨空距離'
    },
    {
      label: 'Walkway Width 走道淨寬',
      checked: analysisWalkwayWidthEnabled,
      onChange: (val: boolean) => {
        setAnalysisWalkwayWidthEnabled(val);
        if (val) onSettingsChange({ showMeasureVisualization: true });
      },
      desc: '偵測並標註通道左右兩側實體淨寬'
    },
    {
      label: 'Closest Wall (Sweep) 最近牆面環掃',
      checked: analysisWallDistanceEnabled,
      onChange: (val: boolean) => {
        setAnalysisWallDistanceEnabled(val);
        if (val) onSettingsChange({ showMeasureVisualization: true });
      },
      desc: '360 度環向掃描偵測並標註與最近牆面或障礙物之距離'
    },
    {
      label: 'Wall Distance Ray 最近牆面測距',
      checked: analysisEyeRayEnabled,
      onChange: (val: boolean) => {
        setAnalysisEyeRayEnabled(val);
        if (val) onSettingsChange({ showMeasureVisualization: true });
      },
      desc: '從眼睛（Eye Level）沿視線方向發射 Ray，擊中第一面牆後顯示雷射線、命中點與距離'
    },
    {
      label: 'Eye Level Above Ground 眼睛至地面淨高',
      checked: analysisEyeLevelEnabled,
      onChange: (val: boolean) => {
        setAnalysisEyeLevelEnabled(val);
        if (val) onSettingsChange({ showMeasureVisualization: true });
      },
      desc: '垂直向下 Raycast 即時量測眼睛至地面或樓梯面的真實高度'
    },
    {
      label: 'Dimension Labels 尺寸標籤',
      checked: analysisDimensionLabelsEnabled,
      onChange: (val: boolean) => {
        setAnalysisDimensionLabelsEnabled(val);
        if (val) onSettingsChange({ showMeasureVisualization: true });
      },
      desc: '浮動 3D 尺寸數值看板面'
    },
    {
      label: 'Measure Arrow 標註引線箭頭',
      checked: analysisMeasureArrowEnabled,
      onChange: (val: boolean) => {
        setAnalysisMeasureArrowEnabled(val);
        if (val) onSettingsChange({ showMeasureVisualization: true });
      },
      desc: '量測標註引線兩端箭頭顯示'
    }
  ];

  const hudSubscriptions = [
    { key: 'eyeToCeiling', label: '視線至天花板 (Eye-to-Ceiling) 👀⬆️' },
    { key: 'eyeToGround', label: '視線至地面 (Eye-to-Ground) 👀⬇️' },
    { key: 'walkwayWidth', label: '走道淨寬 (Walkway Width) ↔️' },
    { key: 'wallDistance', label: '最近牆距 (Wall Distance) 🔍' },
  ];

  const handleHudSubChange = (key: string, checked: boolean) => {
    setHudEnabledItems((prev: any) => ({
      ...prev,
      [key]: checked
    }));
  };

  return (
    <div className="space-y-3.5">
      <SectionTitle title="空間量測分析 (Spatial Measurement)" />
      
      <div className="flex flex-col gap-3 bg-stone-900/20 border border-stone-900/60 p-3 rounded-sm">
        {helpers.map((elem, idx) => (
          <Checkbox 
            key={idx}
            label={elem.label}
            checked={elem.checked}
            onChange={elem.onChange}
            desc={elem.desc}
          />
        ))}
      </div>

      <div className="border-t border-stone-900/80 pt-3.5 space-y-2">
        <span className="text-[9px] text-stone-600 uppercase tracking-wider block font-bold">未來擴充工具 (Future)</span>
        <div className="opacity-45 space-y-2">
          <label className="flex items-center gap-2 text-stone-500 text-[10px] cursor-not-allowed">
            <input type="checkbox" disabled className="rounded w-3 h-3 cursor-not-allowed" />
            <span>避難逃生動線 (Evacuation Path)</span>
          </label>
        </div>
      </div>

      <div className="border-t border-stone-900/80 pt-3.5 flex flex-col gap-2">
        <span className="text-[9px] text-stone-500 uppercase tracking-wider font-bold">輸出至 HUD (Data Output to HUD)</span>
        <div className="grid grid-cols-1 gap-1.5 bg-stone-900/30 p-2.5 rounded-sm border border-stone-900/60 font-sans text-[10.5px]">
          {hudSubscriptions.map((item) => (
            <Checkbox
              key={item.key}
              label={item.label}
              checked={!!hudEnabledItems[item.key]}
              onChange={(checked) => handleHudSubChange(item.key, checked)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
