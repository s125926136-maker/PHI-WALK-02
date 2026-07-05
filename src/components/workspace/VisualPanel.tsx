import React from 'react';
import { PlayerSettings } from '../../types';
import { SectionTitle, ToggleSwitch } from './SharedComponents';

interface VisualPanelProps {
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
}

export const VisualPanel: React.FC<VisualPanelProps> = ({ settings, onSettingsChange }) => {
  const options = [
    { 
      id: 'normal', 
      name: 'Normal 正常渲染', 
      desc: '標準三維光影與色調', 
      active: !settings.showNightVision && !settings.showSunAnalysis && !settings.showOrientationAnalysis && !settings.showWindAnalysis && !settings.showAccessibilityAnalysis 
    },
    { 
      id: 'solar', 
      name: 'Solar Study 日照模擬', 
      desc: '依地理經緯與日期精確模擬日光', 
      active: settings.showSunAnalysis 
    },
    { 
      id: 'orientation', 
      name: 'Surface Orientation 表面朝向', 
      desc: '水平與垂直物理朝向分析模式', 
      active: settings.showOrientationAnalysis 
    },
    { 
      id: 'night', 
      name: 'Night Vision 夜視模式', 
      desc: '微光增強及綠色磷光渲染', 
      active: settings.showNightVision 
    },
    { 
      id: 'wind', 
      name: 'Wind 微氣候風場', 
      desc: '行進廊道之流體風速模擬', 
      active: settings.showWindAnalysis 
    },
    { 
      id: 'accessibility', 
      name: 'Accessibility 障礙偵測', 
      desc: '無障礙通行包絡線法規檢核', 
      active: settings.showAccessibilityAnalysis 
    },
  ];

  const handleSelect = (id: string) => {
    onSettingsChange({
      showNightVision: id === 'night',
      showSunAnalysis: id === 'solar',
      showOrientationAnalysis: id === 'orientation',
      showWindAnalysis: id === 'wind',
      showAccessibilityAnalysis: id === 'accessibility',
      displayMode: id === 'night' 
        ? 'night-vision' 
        : id === 'orientation' 
          ? 'orientation' 
          : (id === 'solar' || id === 'accessibility' || id === 'wind') 
            ? 'analyze' 
            : 'real'
    });
  };

  return (
    <div className="space-y-3.5">
      <SectionTitle title="渲染模式選擇 (Visual Mode)" />
      
      <ToggleSwitch 
        options={options} 
        onSelect={handleSelect} 
        radioName="visual_mode_radio"
      />

      <div className="border-t border-stone-900/80 pt-3.5 space-y-2">
        <span className="text-[9px] text-stone-600 uppercase tracking-wider block font-bold">未來擴充分析模組 (Future)</span>
        <div className="opacity-45 space-y-2">
          <label className="flex items-center gap-2 text-stone-500 text-[10px] cursor-not-allowed">
            <input type="radio" disabled className="rounded-full w-3 h-3 accent-stone-700 cursor-not-allowed" />
            <span>熱舒適度模擬 (Thermal Comfort)</span>
          </label>
          <label className="flex items-center gap-2 text-stone-500 text-[10px] cursor-not-allowed">
            <input type="radio" disabled className="rounded-full w-3 h-3 accent-stone-700 cursor-not-allowed" />
            <span>聲學回音分析 (Acoustics)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
