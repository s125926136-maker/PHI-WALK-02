import React from 'react';
import { SectionTitle, Checkbox } from './SharedComponents';

interface ScenePanelProps {
  sceneSkyEnabled: boolean;
  setSceneSkyEnabled: (val: boolean) => void;
  showGround: boolean;
  setShowGround: (val: boolean) => void;
  showShadow: boolean;
  setShowShadow: (val: boolean) => void;
  sceneSunEnabled: boolean;
  setSceneSunEnabled: (val: boolean) => void;
  sceneSunPathEnabled: boolean;
  setSceneSunPathEnabled: (val: boolean) => void;
  sceneBoundaryEnabled: boolean;
  setSceneBoundaryEnabled: (val: boolean) => void;
  sceneVegetationEnabled: boolean;
  setSceneVegetationEnabled: (val: boolean) => void;
  sceneSpawnPointEnabled: boolean;
  setSceneSpawnPointEnabled: (val: boolean) => void;
}

export const ScenePanel: React.FC<ScenePanelProps> = ({
  sceneSkyEnabled,
  setSceneSkyEnabled,
  showGround,
  setShowGround,
  showShadow,
  setShowShadow,
  sceneSunEnabled,
  setSceneSunEnabled,
  sceneSunPathEnabled,
  setSceneSunPathEnabled,
  sceneBoundaryEnabled,
  setSceneBoundaryEnabled,
  sceneVegetationEnabled,
  setSceneVegetationEnabled,
  sceneSpawnPointEnabled,
  setSceneSpawnPointEnabled,
}) => {
  const elements = [
    { label: 'Sky 天空背景', checked: sceneSkyEnabled, onChange: setSceneSkyEnabled, desc: '切換背景天空穹頂與純黑畫布' },
    { label: 'Ground 模擬分析地面', checked: showGround, onChange: setShowGround, desc: '控制基底與退縮邊界綠帶' },
    { label: 'Shadow 太陽光影投射', checked: showShadow, onChange: setShowShadow, desc: '動態太陽陰影遮蔽計算' },
    { label: 'Sun 太陽本體顯示', checked: sceneSunEnabled, onChange: setSceneSunEnabled, desc: '呈現光源實體與方向' },
    { label: 'Sun Path 日照軌跡線', checked: sceneSunPathEnabled, onChange: setSceneSunPathEnabled, desc: '全天太陽軌道環線繪製' },
    { label: 'Site Boundary 基地退縮界線', checked: sceneBoundaryEnabled, onChange: setSceneBoundaryEnabled, desc: '模擬建築基地退縮線' },
    { label: 'Vegetation 景觀綠化植栽', checked: sceneVegetationEnabled, onChange: setSceneVegetationEnabled, desc: '周邊低多邊形造景樹木' },
    { label: 'Spawn Point 起始重生點', checked: sceneSpawnPointEnabled, onChange: setSceneSpawnPointEnabled, desc: '初始角色重生點光環' },
  ];

  return (
    <div className="space-y-3.5">
      <SectionTitle title="場景物件開關 (Scene Elements)" />
      
      <div className="flex flex-col gap-3 bg-stone-900/20 border border-stone-900/60 p-3 rounded-sm">
        {elements.map((elem, idx) => (
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
        <span className="text-[9px] text-stone-600 uppercase tracking-wider block font-bold">未來擴充元素 (Future)</span>
        <div className="opacity-45 space-y-2">
          <label className="flex items-center gap-2 text-stone-500 text-[10px] cursor-not-allowed">
            <input type="checkbox" disabled className="rounded w-3 h-3 cursor-not-allowed" />
            <span>周邊道路 (Context Roads)</span>
          </label>
          <label className="flex items-center gap-2 text-stone-500 text-[10px] cursor-not-allowed">
            <input type="checkbox" disabled className="rounded w-3 h-3 cursor-not-allowed" />
            <span>鄰近建物環境 (Buildings)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
