import React from 'react';
import { SectionTitle, Checkbox, Slider } from './SharedComponents';
import { EngineRegistry } from '../../analysis/framework';
import { FPSMonitorEngine } from '../../analysis/dummy';
import { BenchmarkRunner } from '../../core/BenchmarkRunner';
import { exportToJson } from '../../core/BenchmarkReport';

interface HUDPanelProps {
  hudEnabled: boolean;
  setHudEnabled: (val: boolean) => void;
  isHudPinned: boolean;
  setIsHudPinned: (val: boolean) => void;
  isSmartPlacementEnabled: boolean;
  setIsSmartPlacementEnabled: (val: boolean) => void;
  setHudOffset: (val: any) => void;
  hudOpacity: number;
  setHudOpacity: (val: number) => void;
  hudTheme: 'dark' | 'light' | 'glass' | 'cyberpunk';
  setHudTheme: (theme: 'dark' | 'light' | 'glass' | 'cyberpunk') => void;
  hudSize: 'small' | 'medium' | 'large';
  setHudSize: (size: 'small' | 'medium' | 'large') => void;
  hudPreferredCorner: 'BR' | 'BL' | 'TR' | 'TL' | 'BCL' | 'TCL';
  setHudPreferredCorner: (corner: 'BR' | 'BL' | 'TR' | 'TL' | 'BCL' | 'TCL') => void;
  hudDebugInfo: {
    visible: boolean;
    position: string;
    opacity: number;
    zIndex: number;
    safeArea: boolean;
    collision: boolean;
  };
}

export const HUDPanel: React.FC<HUDPanelProps> = ({
  hudEnabled,
  setHudEnabled,
  isHudPinned,
  setIsHudPinned,
  isSmartPlacementEnabled,
  setIsSmartPlacementEnabled,
  setHudOffset,
  hudOpacity,
  setHudOpacity,
  hudTheme,
  setHudTheme,
  hudSize,
  setHudSize,
  hudPreferredCorner,
  setHudPreferredCorner,
  hudDebugInfo,
}) => {
  const [isTestEngineEnabled, setIsTestEngineEnabled] = React.useState(() => {
    return EngineRegistry.getInstance().getEngine('fps-monitor-engine') !== undefined;
  });

  const [isBenchmarking, setIsBenchmarking] = React.useState(false);
  const [benchmarkResult, setBenchmarkResult] = React.useState<any | null>(null);
  const [benchmarkTab, setBenchmarkTab] = React.useState<'summary' | 'regressions' | 'json'>('summary');
  const [benchmarkProgress, setBenchmarkProgress] = React.useState('');

  const handleRunBenchmarks = async () => {
    setIsBenchmarking(true);
    setBenchmarkProgress('Initializing context & offscreen canvas...');
    try {
      const result = await BenchmarkRunner.runBenchmarks(30);
      setBenchmarkResult(result);
    } catch (err) {
      console.error('Benchmark execution failed:', err);
    } finally {
      setIsBenchmarking(false);
      setBenchmarkProgress('');
    }
  };

  const handleToggleTestEngine = () => {
    const registry = EngineRegistry.getInstance();
    if (isTestEngineEnabled) {
      registry.unregister('fps-monitor-engine');
      setIsTestEngineEnabled(false);
    } else {
      const engine = new FPSMonitorEngine();
      registry.register(engine);
      engine.onEnable();
      setIsTestEngineEnabled(true);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <SectionTitle title="即時 HUD 集中控制中心 (HUD Control Center)" />

      {/* 1. HUD Enable Toggle */}
      <div className="p-3 bg-stone-900/20 border border-stone-900 rounded-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-sans font-medium text-stone-200">啟用即時感知 HUD</span>
          <button
            onClick={() => setHudEnabled(!hudEnabled)}
            className={`px-2.5 py-1 text-[9.5px] font-bold rounded-sm border transition-all cursor-pointer ${
              hudEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-stone-950 border-stone-800 text-stone-500 hover:text-stone-300'
            }`}
          >
            {hudEnabled ? '● 運作中 (ON)' : '○ 已停用 (OFF)'}
          </button>
        </div>
        <p className="text-[8.5px] text-stone-500 leading-normal font-sans">
          主開關。關閉後將全面停用並隱藏畫面上的浮動 HUD，保持場景絕對純淨。
        </p>
      </div>

      {hudEnabled && (
        <>
          {/* 2. Pin and Smart Placement Controls */}
          <div className="p-3 bg-stone-900/20 border border-stone-900 rounded-sm space-y-3">
            <div className="flex items-center justify-between border-b border-stone-900 pb-2">
              <span className="text-[10px] font-mono text-stone-400">基本行為設定</span>
            </div>
            
            {/* Pinned Control */}
            <Checkbox 
              label="釘選至畫面最上層 (Pin HUD)"
              checked={isHudPinned}
              onChange={setIsHudPinned}
              desc="使其常駐顯示於模擬場景。"
            />

            {/* Smart Placement Control */}
            <Checkbox 
              label="啟用智慧碰撞避讓 (Smart Placement)"
              checked={isSmartPlacementEnabled}
              onChange={setIsSmartPlacementEnabled}
              desc="自動計算側邊欄與時間控制列的邊界，動態切換空閒角落防止重疊。"
            />

            {/* Reset position for Manual drag */}
            {!isSmartPlacementEnabled && (
              <div className="pt-1">
                <button
                  onClick={() => {
                    setHudOffset(null);
                    localStorage.removeItem('phi-walk-hud-pos');
                  }}
                  className="w-full py-1.5 bg-stone-950 hover:bg-stone-900 border border-stone-800 text-stone-300 text-[9px] font-mono rounded-sm transition-all cursor-pointer"
                >
                  🔄 重置手動拖曳位置
                </button>
              </div>
            )}
          </div>

          {/* 3. Opacity Slider */}
          <Slider 
            label="不透明度 (HUD Opacity)"
            min={20}
            max={100}
            step={1}
            value={hudOpacity}
            onChange={setHudOpacity}
            suffix="%"
          />

          {/* 4. Theme Preset */}
          <div className="p-3 bg-stone-900/20 border border-stone-900 rounded-sm space-y-2">
            <span className="text-[10px] font-mono text-stone-400 block border-b border-stone-900 pb-1.5">視覺主題 Preset</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'dark', label: '深色碳黑', desc: '石磨碳黑 85%' },
                { id: 'light', label: '優雅明亮', desc: '簡約純白 90%' },
                { id: 'glass', label: '毛玻璃', desc: '半透高光 Glass' },
                { id: 'cyberpunk', label: '賽博霓虹', desc: '暗黑黃底 Cyber' },
              ].map((themeItem) => (
                <button
                  key={themeItem.id}
                  onClick={() => setHudTheme(themeItem.id as any)}
                  className={`p-1.5 border text-left rounded-sm transition-all cursor-pointer ${
                    hudTheme === themeItem.id
                      ? 'bg-brand/10 border-brand text-brand'
                      : 'bg-stone-950/40 border-stone-900 text-stone-400 hover:text-stone-200 hover:border-stone-800'
                  }`}
                >
                  <div className="text-[9.5px] font-bold font-sans">{themeItem.label}</div>
                  <div className="text-[7.5px] opacity-60 font-mono mt-0.5">{themeItem.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Scale Size */}
          <div className="p-3 bg-stone-900/20 border border-stone-900 rounded-sm space-y-2">
            <span className="text-[10px] font-mono text-stone-400 block border-b border-stone-900 pb-1.5">顯示比例 Size</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'small', label: '緊湊 (S)' },
                { id: 'medium', label: '標準 (M)' },
                { id: 'large', label: '放大 (L)' },
              ].map((sizeItem) => (
                <button
                  key={sizeItem.id}
                  onClick={() => setHudSize(sizeItem.id as any)}
                  className={`py-1.5 border text-center rounded-sm text-[9.5px] font-sans font-medium transition-all cursor-pointer ${
                    hudSize === sizeItem.id
                      ? 'bg-brand/10 border-brand text-brand font-bold'
                      : 'bg-stone-950/40 border-stone-900 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {sizeItem.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Origin Position Preference */}
          {isSmartPlacementEnabled && (
            <div className="p-3 bg-stone-900/20 border border-stone-900 rounded-sm space-y-2">
              <span className="text-[10px] font-mono text-stone-400 block border-b border-stone-900 pb-1.5">起始避讓角落 Position</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'TL', label: '左上' },
                  { id: 'TCL', label: '中左上' },
                  { id: 'TR', label: '右上' },
                  { id: 'BL', label: '左下' },
                  { id: 'BCL', label: '中左下' },
                  { id: 'BR', label: '右下' },
                ].map((cornerItem) => (
                  <button
                    key={cornerItem.id}
                    onClick={() => setHudPreferredCorner(cornerItem.id as any)}
                    className={`py-1 border text-center rounded-sm text-[9px] font-sans transition-all cursor-pointer ${
                      hudPreferredCorner === cornerItem.id
                        ? 'bg-brand/15 border-brand text-brand font-bold shadow-xs'
                        : 'bg-stone-950/40 border-stone-900 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {cornerItem.label}
                  </button>
                ))}
              </div>
              <p className="text-[7.5px] text-stone-500 leading-normal font-sans">
                * 智慧避讓起算原點。若該原點被側邊欄或選單遮擋，HUD 會依序移往其他安全角落。
              </p>
            </div>
          )}
        </>
      )}

      {/* 7. HUD DEBUG DIAGNOSTICS */}
      {hudEnabled && (
        <div className="p-3 bg-stone-900/30 border border-stone-800/80 rounded-sm space-y-2">
          <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-stone-400 block border-b border-stone-800/60 pb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F27D26] animate-pulse" />
            <span>HUD 系統偵錯 (HUD Debug Diagnostics)</span>
          </div>
          <div className="space-y-1.5 font-mono text-[9px] text-stone-400">
            <div className="flex justify-between items-center">
              <span>HUD Visible :</span>
              <span className={`font-bold ${hudDebugInfo.visible ? 'text-emerald-400' : 'text-red-400'}`}>
                {hudDebugInfo.visible ? 'TRUE' : 'FALSE'}
              </span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span>HUD Position :</span>
              <span className="text-stone-300 font-bold text-right truncate max-w-[150px]" title={hudDebugInfo.position}>
                {hudDebugInfo.position}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>HUD Opacity :</span>
              <span className="text-stone-300 font-bold">
                {hudDebugInfo.opacity.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>HUD Z-index :</span>
              <span className="text-stone-300 font-bold">
                {hudDebugInfo.zIndex}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>HUD Safe Area :</span>
              <span className={`font-bold ${hudDebugInfo.safeArea ? 'text-emerald-400' : 'text-amber-400'}`}>
                {hudDebugInfo.safeArea ? 'TRUE' : 'FALSE'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>HUD Collision :</span>
              <span className={`font-bold ${hudDebugInfo.collision ? 'text-red-400' : 'text-emerald-400'}`}>
                {hudDebugInfo.collision ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Plug-and-Play Engine Test */}
      <div className="p-3 bg-[#F27D26]/5 border border-[#F27D26]/20 rounded-sm space-y-2">
        <span className="text-[10px] font-mono font-bold text-[#F27D26] block border-b border-[#F27D26]/10 pb-1.5">
          🔌 Plug-and-Play 驗證測試
        </span>
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-sans text-stone-300">啟用 FPSMonitorEngine 測試</span>
          <button
            onClick={handleToggleTestEngine}
            className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-sm border transition-all cursor-pointer ${
              isTestEngineEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-stone-950 border-stone-800 text-stone-500 hover:text-stone-300'
            }`}
          >
            {isTestEngineEnabled ? 'ACTIVE 運作中' : 'REGISTER 註冊'}
          </button>
        </div>
        <p className="text-[8px] text-stone-500 leading-normal font-sans">
          測試「即插即用」架構。點擊【註冊】後，全新的 FPSMonitorEngine 
          將在背景自動開始運行，且 HUD 與 telemetry 系統將直接自動顯示「引擎心跳 (Engine Tick)」欄位，完全無須修改 HUD 渲染代碼。
        </p>
      </div>

      {/* 📊 Engine Performance Benchmark Suite */}
      <div className="p-3 bg-cyan-950/5 border border-cyan-800/30 rounded-sm space-y-2.5">
        <span className="text-[10px] font-mono font-bold text-cyan-400 block border-b border-cyan-800/20 pb-1.5">
          📊 引擎效能基準測試 (Performance Benchmarking)
        </span>

        {isBenchmarking ? (
          <div className="py-4 text-center space-y-2">
            <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[9.5px] font-mono text-cyan-300 animate-pulse">{benchmarkProgress}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleRunBenchmarks}
              className="w-full py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/60 hover:border-cyan-600 text-cyan-300 text-[10px] font-mono font-bold rounded-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              🚀 {benchmarkResult ? '重新執行基準測試' : '執行效能基準與迴歸測試'}
            </button>

            {benchmarkResult ? (
              <div className="space-y-2 border-t border-cyan-800/20 pt-2">
                {/* Tab Controls */}
                <div className="flex border border-cyan-900 rounded-sm overflow-hidden text-[8px] font-mono">
                  <button
                    onClick={() => setBenchmarkTab('summary')}
                    className={`flex-1 py-1 text-center transition-all ${
                      benchmarkTab === 'summary' ? 'bg-cyan-800 text-cyan-100 font-bold' : 'bg-stone-950 text-cyan-600 hover:text-cyan-400'
                    }`}
                  >
                    報告 Summary
                  </button>
                  <button
                    onClick={() => setBenchmarkTab('regressions')}
                    className={`flex-1 py-1 text-center transition-all ${
                      benchmarkTab === 'regressions' ? 'bg-cyan-800 text-cyan-100 font-bold' : 'bg-stone-950 text-cyan-600 hover:text-cyan-400'
                    }`}
                  >
                    比對 Regression
                  </button>
                  <button
                    onClick={() => setBenchmarkTab('json')}
                    className={`flex-1 py-1 text-center transition-all ${
                      benchmarkTab === 'json' ? 'bg-cyan-800 text-cyan-100 font-bold' : 'bg-stone-950 text-cyan-600 hover:text-cyan-400'
                    }`}
                  >
                    資料 JSON
                  </button>
                </div>

                {/* Tab Contents */}
                {benchmarkTab === 'summary' && (
                  <div className="bg-stone-950 border border-cyan-950 p-2 rounded-sm max-h-[220px] overflow-y-auto scrollbar-thin">
                    <pre className="text-[8.5px] font-mono text-cyan-200 leading-relaxed whitespace-pre-wrap">
                      {benchmarkResult.markdown}
                    </pre>
                  </div>
                )}

                {benchmarkTab === 'regressions' && (
                  <div className="bg-stone-950 border border-cyan-950 p-2 rounded-sm max-h-[220px] overflow-y-auto scrollbar-thin">
                    {benchmarkResult.regressionMarkdown ? (
                      <pre className="text-[8.5px] font-mono text-cyan-200 leading-relaxed whitespace-pre-wrap">
                        {benchmarkResult.regressionMarkdown}
                      </pre>
                    ) : (
                      <div className="text-center py-4 space-y-1.5">
                        <p className="text-[9px] font-mono text-stone-500">尚無歷史基準資料</p>
                        <p className="text-[8px] text-stone-600 leading-normal font-sans px-2">
                          這是您在此瀏覽器的工作階段中首次執行測試。請再次點擊「重新執行基準測試」來將第二次執行的結果與本次結果比對，即可產出完整的迴歸分析。
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {benchmarkTab === 'json' && (
                  <div className="space-y-1.5">
                    <div className="bg-stone-950 border border-cyan-950 p-2 rounded-sm max-h-[160px] overflow-y-auto scrollbar-thin">
                      <pre className="text-[8px] font-mono text-cyan-400 leading-normal">
                        {exportToJson(benchmarkResult.report)}
                      </pre>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(exportToJson(benchmarkResult.report));
                        alert('已複製基準測試 JSON 報告至剪貼簿！');
                      }}
                      className="w-full py-1 bg-stone-900 border border-cyan-900/30 hover:border-cyan-800 text-cyan-500 hover:text-cyan-400 text-[8.5px] font-mono font-bold rounded-sm transition-colors cursor-pointer"
                    >
                      📋 複製 JSON 報告
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[8px] text-stone-500 leading-normal font-sans">
                透過模擬包含 Empty Scene、Apartment、Gallery、Corridor 及各型 GLB/BIM 模型的七大測試場景，對底層物理、渲染、日照、風場、Telemetry 等九大子系統進行各 30 幀的 programmatically 模擬測試，並產出高密度的 JSON 及 Markdown 報告。
              </p>
            )}
          </div>
        )}
      </div>

      {/* 8. Reset Layout Button */}
      <div className="pt-1.5">
        <button
          onClick={() => {
            setIsSmartPlacementEnabled(false);
            setHudOffset(null);
            setHudOpacity(85);
            localStorage.removeItem('phi-walk-hud-pos');
            localStorage.removeItem('phi-walk-hud-smart');
            localStorage.removeItem('phi-walk-hud-opacity');
          }}
          className="w-full py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/50 hover:border-red-800 text-red-200 text-[10px] font-mono font-bold rounded-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
        >
          🔄 重設 HUD 位置 (Reset HUD Position)
        </button>
      </div>
    </div>
  );
};
