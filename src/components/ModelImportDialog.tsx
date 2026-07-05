import React from 'react';
import { Settings } from 'lucide-react';

interface ModelImportDialogProps {
  showSetupConfirm: boolean;
  setShowSetupConfirm: (show: boolean) => void;
  onBackToSetup: () => void;
}

export function ModelImportDialog({
  showSetupConfirm,
  setShowSetupConfirm,
  onBackToSetup,
}: ModelImportDialogProps) {
  if (!showSetupConfirm) return null;

  return (
    <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in pointer-events-auto">
      <div className="bg-stone-950 border border-stone-800 p-6 max-w-sm w-full mx-4 shadow-2xl flex flex-col gap-4 font-mono">
        <div className="flex items-center gap-2 text-[#F27D26] font-bold border-b border-stone-800 pb-2 text-[11px] uppercase tracking-wider">
          <Settings size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
          <span>專案設定？ (Project Setup?)</span>
        </div>
        
        <p className="text-xs text-stone-300 leading-relaxed font-sans">
          返回專案設定頁面。目前專案設定與已匯入的模型不會遺失，您可以隨時修改設定後再次進入模擬。
        </p>
        
        <div className="flex gap-2 justify-end mt-2 text-[10px]">
          <button
            type="button"
            onClick={() => setShowSetupConfirm(false)}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-white rounded-sm font-bold cursor-pointer transition-colors"
          >
            取消 (Cancel)
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSetupConfirm(false);
              if (onBackToSetup) {
                onBackToSetup();
              }
            }}
            className="px-3 py-1.5 bg-[#F27D26] hover:bg-white text-black hover:text-black rounded-sm font-bold cursor-pointer transition-all"
          >
            專案設定 (Project Setup)
          </button>
        </div>
      </div>
    </div>
  );
}
