import React from 'react';
import { PlayerSettings } from '../../types';
import { SectionTitle, Checkbox } from './SharedComponents';

interface PlayerPanelProps {
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  playerCrosshairEnabled: boolean;
  setPlayerCrosshairEnabled: (val: boolean) => void;
  playerDirectionArrowEnabled: boolean;
  setPlayerDirectionArrowEnabled: (val: boolean) => void;
  playerEnvelopeEnabled: boolean;
  setPlayerEnvelopeEnabled: (val: boolean) => void;
  hudEnabledItems: Record<string, boolean>;
  setHudEnabledItems: React.Dispatch<React.SetStateAction<any>>;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  settings,
  onSettingsChange,
  playerCrosshairEnabled,
  setPlayerCrosshairEnabled,
  playerDirectionArrowEnabled,
  setPlayerDirectionArrowEnabled,
  playerEnvelopeEnabled,
  setPlayerEnvelopeEnabled,
  hudEnabledItems,
  setHudEnabledItems,
}) => {
  const overlays = [
    { 
      label: 'Compass 指北方位羅盤', 
      checked: settings.showCompass, 
      onChange: (val: boolean) => onSettingsChange({ showCompass: val }), 
      desc: '畫面右上角方位與角度羅盤' 
    },
    { 
      label: 'Crosshair 第一人稱準星', 
      checked: playerCrosshairEnabled, 
      onChange: setPlayerCrosshairEnabled, 
      desc: '螢幕正中央定位十字準星' 
    },
    { 
      label: 'Direction Arrow 角色前進方向', 
      checked: playerDirectionArrowEnabled, 
      onChange: setPlayerDirectionArrowEnabled, 
      desc: '角色腳底與胸前的行進與面朝指示箭頭' 
    },
    { 
      label: 'Body Envelope 人體包絡', 
      checked: playerEnvelopeEnabled, 
      onChange: (val: boolean) => {
        setPlayerEnvelopeEnabled(val);
        onSettingsChange({ showClearanceEnvelope: val });
      }, 
      desc: '顯示角色站立肩寬或輪椅安全活動碰撞包絡線' 
    },
  ];

  const hudSubscriptions = [
    { key: 'heading', label: '方位角 (Heading) 🧭' },
    { key: 'fps', label: '畫格速率 (FPS) ⚡' },
    { key: 'altitude', label: '相對高度 (Relative Altitude) 🔺' },
  ];

  const handleHudSubChange = (key: string, checked: boolean) => {
    setHudEnabledItems((prev: any) => ({
      ...prev,
      [key]: checked
    }));
  };

  return (
    <div className="space-y-3.5">
      <SectionTitle title="玩家抬頭顯示 HUD (Player Overlays)" />
      
      <div className="flex flex-col gap-3 bg-stone-900/20 border border-stone-900/60 p-3 rounded-sm">
        {overlays.map((elem, idx) => (
          <Checkbox 
            key={idx}
            label={elem.label}
            checked={elem.checked}
            onChange={elem.onChange}
            desc={elem.desc}
          />
        ))}
      </div>

      <div className="border-t border-stone-900 pt-3 flex flex-col gap-2">
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
