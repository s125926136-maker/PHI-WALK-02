/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Info,
  Globe,
  Calendar,
  Clock,
  Building,
  Compass
} from 'lucide-react';
import { HumanScalePreset, PlayerSettings, TelemetryData } from '../types';
import { formatToDMS, parseDMS } from '../utils/solarCalculator';

const TIMEZONES = [
  { value: -12, label: 'GMT-12 (IDLW)' },
  { value: -11, label: 'GMT-11 (SST)' },
  { value: -10, label: 'GMT-10 (HST)' },
  { value: -9, label: 'GMT-9 (AKST)' },
  { value: -8, label: 'GMT-8 (PST)' },
  { value: -7, label: 'GMT-7 (MST)' },
  { value: -6, label: 'GMT-6 (CST)' },
  { value: -5, label: 'GMT-5 (EST)' },
  { value: -4, label: 'GMT-4 (AST)' },
  { value: -3, label: 'GMT-3 (BRT)' },
  { value: -2, label: 'GMT-2 (FNT)' },
  { value: -1, label: 'GMT-1 (AZOT)' },
  { value: 0, label: 'GMT+0 (GMT/UTC)' },
  { value: 1, label: 'GMT+1 (CET)' },
  { value: 2, label: 'GMT+2 (EET)' },
  { value: 3, label: 'GMT+3 (MSK)' },
  { value: 4, label: 'GMT+4 (GST)' },
  { value: 5, label: 'GMT+5 (PKT)' },
  { value: 6, label: 'GMT+6 (ALMT)' },
  { value: 7, label: 'GMT+7 (WIB)' },
  { value: 8, label: 'GMT+8 (Taipei/HK/SGP)' },
  { value: 9, label: 'GMT+9 (JST)' },
  { value: 10, label: 'GMT+10 (AEST)' },
  { value: 11, label: 'GMT+11 (SBDT)' },
  { value: 12, label: 'GMT+12 (NZST)' },
  { value: 13, label: 'GMT+13 (TKT)' },
  { value: 14, label: 'GMT+14 (LINT)' },
];

export const HUMAN_PRESETS: HumanScalePreset[] = [
  {
    id: 'child',
    name: '兒童 (Child)',
    eyeHeight: 1.10,
    bodyWidth: 0.55,
    reachRadius: 0.50,
    speedMultiplier: 0.8,
    description: '眼高 1.1m。探索從兒童視角看世界的尺度與安全感，通常桌櫃邊角、把手高度、天花板高度在此視角下會顯得更加巨大。',
  },
  {
    id: 'teen',
    name: '青少年 (Teen)',
    eyeHeight: 1.45,
    bodyWidth: 0.65,
    reachRadius: 0.65,
    speedMultiplier: 1.0,
    description: '眼高 1.45m。過渡期人體尺度，適用於中學、育樂設施、公共交通等空間體驗與動線感知。',
  },
  {
    id: 'adult',
    name: '成人 (Adult)',
    eyeHeight: 1.65,
    bodyWidth: 0.72,
    reachRadius: 0.75,
    speedMultiplier: 1.0,
    description: '眼高 1.65m。標準人體工學常模（人體立姿平均視線高度約 1.6-1.7m），用以規劃住宅、辦公、公共空間之主要動線基準。',
  },
  {
    id: 'elderly',
    name: '老人 (Elderly)',
    eyeHeight: 1.55,
    bodyWidth: 0.70,
    reachRadius: 0.70,
    speedMultiplier: 0.7,
    description: '眼高 1.55m。考量年長者生理特徵，行進速度稍緩。便於規劃高齡友善空間、防跌止滑扶手、防眩光視角。',
  },
  {
    id: 'wheelchair',
    name: '輪椅使用者 (Wheelchair)',
    eyeHeight: 1.20,
    bodyWidth: 0.90,
    reachRadius: 0.60,
    speedMultiplier: 0.75,
    description: '眼高 1.2m。寬度包絡線擴至 0.9m。用於驗證無障礙通道寬度、斜坡坡度感知、高低差及門扇迴轉淨空間。',
  },
];

interface TelemetryPanelProps {
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  telemetry: TelemetryData;
  onResetPosition: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <div className="flex flex-col h-full bg-bg-dark border-l border-border-dark text-stone-200 select-none text-sm w-full font-mono">
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        
        {/* Header Title */}
        <div className="flex items-center gap-2 border-b border-border-dark/80 pb-3">
          <div className="w-5 h-5 border border-brand flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 bg-brand"></div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-widest font-mono">
              PROJECT SETTINGS (專案設定)
            </h2>
            <p className="text-[10px] text-stone-500 font-sans mt-0.5">
              專案預設值，設定完成後進入模擬進行即時分析
            </p>
          </div>
        </div>

        {/* 1. PROJECT NAME */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
            專案名稱 (Project Name)
          </label>
          <div className="relative">
            <Building size={13} className="absolute left-2.5 top-2 text-stone-500" />
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => onSettingsChange({ siteName: e.target.value })}
              className="w-full bg-bg-dark border border-border-dark/80 pl-8 pr-3 py-1.5 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-sans"
              placeholder="輸入專案或基地名稱..."
            />
          </div>
        </div>

        {/* 2. LATITUDE & LONGITUDE */}
        <div className="space-y-3 pt-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
              專案座標 (Coordinates)
            </label>
            {/* Format toggle */}
            <div className="flex gap-1 bg-bg-dark/80 p-0.5 border border-border-dark/60 text-[9px] rounded-xs">
              <button
                type="button"
                onClick={() => onSettingsChange({ coordsFormat: 'decimal' })}
                className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                  settings.coordsFormat === 'decimal'
                    ? 'bg-brand/20 text-brand'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                十進位
              </button>
              <button
                type="button"
                onClick={() => onSettingsChange({ coordsFormat: 'dms' })}
                className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                  settings.coordsFormat === 'dms'
                    ? 'bg-brand/20 text-brand'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                度分秒
              </button>
            </div>
          </div>

          {settings.coordsFormat === 'decimal' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-stone-500 block">緯度 Latitude (-90~90)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={settings.latitude}
                  onChange={(e) => {
                    const lat = parseFloat(e.target.value);
                    if (!isNaN(lat)) {
                      onSettingsChange({
                        latitude: lat,
                        latitudeDMS: formatToDMS(lat, false)
                      });
                    }
                  }}
                  className="w-full bg-bg-dark border border-border-dark/80 px-2 py-1 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-stone-500 block">經度 Longitude (-180~180)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={settings.longitude}
                  onChange={(e) => {
                    const lng = parseFloat(e.target.value);
                    if (!isNaN(lng)) {
                      onSettingsChange({
                        longitude: lng,
                        longitudeDMS: formatToDMS(lng, true)
                      });
                    }
                  }}
                  className="w-full bg-bg-dark border border-border-dark/80 px-2 py-1 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] text-stone-500 block">緯度 (DMS)</label>
                  {settings.latitudeDMS.trim() !== '' && parseDMS(settings.latitudeDMS) === null && (
                    <span className="text-[8px] text-red-400 font-bold">Error</span>
                  )}
                </div>
                <input
                  type="text"
                  value={settings.latitudeDMS}
                  onChange={(e) => {
                    const valStr = e.target.value;
                    const parsed = parseDMS(valStr);
                    if (parsed !== null && parsed >= -90 && parsed <= 90) {
                      onSettingsChange({
                        latitudeDMS: valStr,
                        latitude: parsed
                      });
                    } else {
                      onSettingsChange({ latitudeDMS: valStr });
                    }
                  }}
                  placeholder={"23°41'45\"N"}
                  className={`w-full bg-bg-dark border px-2 py-1 text-stone-200 focus:outline-none rounded-sm text-xs font-mono ${
                    settings.latitudeDMS.trim() !== '' && parseDMS(settings.latitudeDMS) === null
                      ? 'border-red-500/80 focus:border-red-500'
                      : 'border-border-dark/80 focus:border-brand'
                  }`}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] text-stone-500 block">經度 (DMS)</label>
                  {settings.longitudeDMS.trim() !== '' && parseDMS(settings.longitudeDMS) === null && (
                    <span className="text-[8px] text-red-400 font-bold">Error</span>
                  )}
                </div>
                <input
                  type="text"
                  value={settings.longitudeDMS}
                  onChange={(e) => {
                    const valStr = e.target.value;
                    const parsed = parseDMS(valStr);
                    if (parsed !== null && parsed >= -180 && parsed <= 180) {
                      onSettingsChange({
                        longitudeDMS: valStr,
                        longitude: parsed
                      });
                    } else {
                      onSettingsChange({ longitudeDMS: valStr });
                    }
                  }}
                  placeholder={"120°32'05\"E"}
                  className={`w-full bg-bg-dark border px-2 py-1 text-stone-200 focus:outline-none rounded-sm text-xs font-mono ${
                    settings.longitudeDMS.trim() !== '' && parseDMS(settings.longitudeDMS) === null
                      ? 'border-red-500/80 focus:border-red-500'
                      : 'border-border-dark/80 focus:border-brand'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Paste Coordinates Row */}
          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                const matches = text.match(/(-?\d+(?:\.\d+)?)\s*[\s,]\s*(-?\d+(?:\.\d+)?)/);
                if (matches && matches.length >= 3) {
                  const lat = parseFloat(matches[1]);
                  const lng = parseFloat(matches[2]);
                  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    onSettingsChange({
                      latitude: lat,
                      longitude: lng,
                      siteName: 'Custom',
                      latitudeDMS: formatToDMS(lat, false),
                      longitudeDMS: formatToDMS(lng, true)
                    });
                  } else {
                    alert(`座標值超出世界範圍: Lat ${lat}, Lng ${lng}`);
                  }
                } else {
                  alert("剪貼簿不包含有效座標 (e.g. 23.6959, 120.5346)");
                }
              } catch (err) {
                const input = prompt("請手動貼上經緯度 (e.g. 23.6959, 120.5346):");
                if (input) {
                  const matches = input.match(/(-?\d+(?:\.\d+)?)\s*[\s,]\s*(-?\d+(?:\.\d+)?)/);
                  if (matches && matches.length >= 3) {
                    const lat = parseFloat(matches[1]);
                    const lng = parseFloat(matches[2]);
                    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                      onSettingsChange({
                        latitude: lat,
                        longitude: lng,
                        siteName: 'Custom',
                        latitudeDMS: formatToDMS(lat, false),
                        longitudeDMS: formatToDMS(lng, true)
                      });
                    } else {
                      alert(`座標值超出範圍`);
                    }
                  }
                }
              }
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-bg-dark/40 hover:bg-bg-mid border border-border-dark/60 hover:border-brand/40 text-[10px] font-mono text-stone-300 hover:text-brand rounded-sm transition-all cursor-pointer"
          >
            <span>📋 貼上剪貼簿經緯度 (Paste Coordinates)</span>
          </button>
        </div>

        {/* 3. MODEL NORTH */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px] text-stone-500 font-bold uppercase tracking-wider">
            <span>正北偏差 (Model North)</span>
            <span className="text-brand font-bold">{settings.modelNorth}°</span>
          </div>
          <div className="flex items-center gap-3 bg-bg-dark border border-border-dark/80 p-2 rounded-sm">
            <Compass size={14} className="text-stone-500 shrink-0" />
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={settings.modelNorth}
              onChange={(e) => onSettingsChange({ modelNorth: parseInt(e.target.value, 10) })}
              className="flex-1 accent-brand h-1 bg-bg-mid appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* 4. TIME ZONE */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
            預設時區 (Time Zone)
          </label>
          <div className="relative">
            <Globe size={13} className="absolute left-2.5 top-2 text-stone-500" />
            <select
              value={settings.timezone}
              onChange={(e) => onSettingsChange({ timezone: parseInt(e.target.value, 10) })}
              className="w-full bg-bg-dark border border-border-dark/80 pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-brand rounded-sm font-mono cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 5 & 6. DEFAULT STUDY DATE & TIME */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1">
            <label className="text-[9px] text-stone-500 font-bold flex items-center gap-1 uppercase tracking-wider">
              <Calendar size={11} className="text-stone-500" />
              <span>預設分析日期 (Default Date)</span>
            </label>
            <input
              type="date"
              value={settings.analysisDate}
              onChange={(e) => onSettingsChange({ analysisDate: e.target.value })}
              className="w-full bg-bg-dark border border-border-dark/80 px-2 py-1 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-stone-500 font-bold flex items-center gap-1 uppercase tracking-wider">
              <Clock size={11} className="text-stone-500" />
              <span>預設分析時間 (Default Time)</span>
            </label>
            <input
              type="time"
              value={settings.analysisTime}
              onChange={(e) => onSettingsChange({ analysisTime: e.target.value })}
              className="w-full bg-bg-dark border border-border-dark/80 px-2 py-1 text-stone-200 focus:outline-none focus:border-brand rounded-sm text-xs font-mono"
            />
          </div>
        </div>

        {/* Explanation Alert Box */}
        <div className="p-3 bg-bg-darker border border-border-dark/80 rounded-sm space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-stone-400 font-bold font-mono text-[9px] uppercase tracking-wider">
            <Info size={12} className="text-brand shrink-0" />
            <span>專案建置與預設值 (Project Initialization)</span>
          </div>
          <p className="text-stone-400 text-[11px] leading-relaxed font-sans">
            此處為「專案預設值」，不進行即時分析。設定完成後，若欲進行即時日照模擬、模型朝向、尺寸量測或空間壓迫度量測，請點擊畫面下方的「第一人稱體驗」或按 <strong>[Tab]</strong> 鍵開啟「模擬分析儀表板 (Floating Analysis Dock)」。
          </p>
        </div>

      </div>

      {/* Footer advice */}
      <div className="p-3 border-t border-border-dark/80 bg-bg-darker text-[9px] font-mono uppercase text-stone-500 flex items-start gap-1 leading-normal">
        <Info size={11} className="text-brand shrink-0 mt-0.5" />
        <span>PHI WALK 空間模擬與專案設定分流架構</span>
      </div>
    </div>
  );
};
