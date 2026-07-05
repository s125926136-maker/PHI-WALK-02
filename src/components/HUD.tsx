/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TelemetryData, HUDSettings, DEFAULT_HUD_SETTINGS } from '../types';
import { eventBus } from '../core/EventSystem';
import { PerformanceProfiler, PerformanceSnapshot } from '../core/PerformanceProfiler';

interface HUDProps {
  telemetry: TelemetryData;
}

export default function HUD(props: HUDProps) {
  const { telemetry } = props;

  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [showPerfOverlay, setShowPerfOverlay] = useState(false);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      if (PerformanceProfiler.isEnabled()) {
        setSnapshot(PerformanceProfiler.getSnapshot());
      } else {
        setSnapshot(null);
      }
      requestAnimationFrame(update);
    };
    update();
    return () => {
      active = false;
    };
  }, []);

  const [hudSettings, setHudSettings] = useState<HUDSettings>(() => {
    try {
      const enabled = localStorage.getItem('phi-walk-hud-enabled');
      const pinned = localStorage.getItem('phi-walk-hud-pinned');
      const collapsed = localStorage.getItem('phi-walk-hud-collapsed');
      const mini = localStorage.getItem('phi-walk-hud-mini');
      const smart = localStorage.getItem('phi-walk-hud-smart');
      const opacity = localStorage.getItem('phi-walk-hud-opacity');
      const theme = localStorage.getItem('phi-walk-hud-theme');
      const size = localStorage.getItem('phi-walk-hud-size');
      const corner = localStorage.getItem('phi-walk-hud-pref-corner');
      const pos = localStorage.getItem('phi-walk-hud-pos');
      const items = localStorage.getItem('phi-walk-hud-items');

      return {
        enabled: enabled !== null ? JSON.parse(enabled) : DEFAULT_HUD_SETTINGS.enabled,
        pinned: pinned !== null ? JSON.parse(pinned) : DEFAULT_HUD_SETTINGS.pinned,
        collapsed: collapsed !== null ? JSON.parse(collapsed) : DEFAULT_HUD_SETTINGS.collapsed,
        mini: mini !== null ? JSON.parse(mini) : DEFAULT_HUD_SETTINGS.mini,
        smartPlacement: smart !== null ? JSON.parse(smart) : DEFAULT_HUD_SETTINGS.smartPlacement,
        opacity: opacity !== null ? JSON.parse(opacity) : DEFAULT_HUD_SETTINGS.opacity,
        theme: theme !== null ? JSON.parse(theme) : DEFAULT_HUD_SETTINGS.theme,
        size: size !== null ? JSON.parse(size) : DEFAULT_HUD_SETTINGS.size,
        preferredCorner: corner !== null ? JSON.parse(corner) : DEFAULT_HUD_SETTINGS.preferredCorner,
        offset: pos ? JSON.parse(pos) : DEFAULT_HUD_SETTINGS.offset,
        enabledItems: items ? JSON.parse(items) : DEFAULT_HUD_SETTINGS.enabledItems,
      };
    } catch (e) {
      return DEFAULT_HUD_SETTINGS;
    }
  });

  const [layout, setLayout] = useState({
    leftDockOpen: false,
    rightDockOpen: true,
    bottomTimeOpen: false,
    activeWorkspaceTab: 'visual' as string | null,
    isWorkspaceExpanded: true
  });

  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const [hudLayoutState, setHudLayoutState] = useState<{
    style: React.CSSProperties;
    hidden: boolean;
    forceCollapse: boolean;
  }>({
    style: {
      right: '16px',
      bottom: '64px',
      left: 'auto',
      top: 'auto',
      position: 'absolute' as const,
    },
    hidden: false,
    forceCollapse: false,
  });

  const hudRef = useRef<HTMLDivElement | null>(null);

  // Listen to HUD settings changes from the external control tab
  useEffect(() => {
    const unsub = eventBus.on('hud-settings-change', (updated: Partial<HUDSettings>) => {
      setHudSettings(prev => ({ ...prev, ...updated }));
    });
    return unsub;
  }, []);

  // Listen to UI layout changes from SimulatorCanvas to update boundaries
  useEffect(() => {
    const unsub = eventBus.on('layout-change', (newLayout: any) => {
      setLayout(prev => ({ ...prev, ...newLayout }));
    });
    return unsub;
  }, []);

  // Track window size for boundaries
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update central state and broadcast to ensure other tabs stay in sync
  const updateSettings = (updated: Partial<HUDSettings>) => {
    setHudSettings(prev => {
      const next = { ...prev, ...updated };
      
      // Persist to localStorage individually
      if (updated.enabled !== undefined) localStorage.setItem('phi-walk-hud-enabled', JSON.stringify(next.enabled));
      if (updated.pinned !== undefined) localStorage.setItem('phi-walk-hud-pinned', JSON.stringify(next.pinned));
      if (updated.collapsed !== undefined) localStorage.setItem('phi-walk-hud-collapsed', JSON.stringify(next.collapsed));
      if (updated.mini !== undefined) localStorage.setItem('phi-walk-hud-mini', JSON.stringify(next.mini));
      if (updated.smartPlacement !== undefined) localStorage.setItem('phi-walk-hud-smart', JSON.stringify(next.smartPlacement));
      if (updated.opacity !== undefined) localStorage.setItem('phi-walk-hud-opacity', JSON.stringify(next.opacity));
      if (updated.theme !== undefined) localStorage.setItem('phi-walk-hud-theme', JSON.stringify(next.theme));
      if (updated.size !== undefined) localStorage.setItem('phi-walk-hud-size', JSON.stringify(next.size));
      if (updated.preferredCorner !== undefined) localStorage.setItem('phi-walk-hud-pref-corner', JSON.stringify(next.preferredCorner));
      if (updated.offset !== undefined) localStorage.setItem('phi-walk-hud-pos', JSON.stringify(next.offset));
      if (updated.enabledItems !== undefined) localStorage.setItem('phi-walk-hud-items', JSON.stringify(next.enabledItems));

      // Broadcast event so settings tab can react
      eventBus.emit('hud-settings-change', updated);
      return next;
    });
  };

  // Drag and Touch Handlers for Floating Overlay
  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }
    
    e.preventDefault();
    
    const hudElement = hudRef.current;
    if (!hudElement) return;

    const rect = hudElement.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    
    const initialLeft = rect.left;
    const initialTop = rect.top;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const hudWidth = rect.width;
      const hudHeight = rect.height;

      if (newLeft < 0) newLeft = 0;
      if (newLeft + hudWidth > viewportWidth) newLeft = viewportWidth - hudWidth;
      if (newTop < 0) newTop = 0;
      if (newTop + hudHeight > viewportHeight) newTop = viewportHeight - hudHeight;

      updateSettings({ offset: { x: newLeft, y: newTop }, smartPlacement: false });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const currentHud = hudRef.current;
      if (!currentHud) return;
      const currentRect = currentHud.getBoundingClientRect();
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const hudWidth = currentRect.width;
      const hudHeight = currentRect.height;
      
      let snappedLeft = currentRect.left;
      let snappedTop = currentRect.top;

      const SNAP_THRESHOLD = 40;
      const PADDING = 16;

      // Snap horizontally
      if (snappedLeft < SNAP_THRESHOLD) {
        snappedLeft = PADDING;
      } else if (viewportWidth - (snappedLeft + hudWidth) < SNAP_THRESHOLD) {
        snappedLeft = viewportWidth - hudWidth - PADDING;
      }

      // Snap vertically
      if (snappedTop < SNAP_THRESHOLD) {
        snappedTop = PADDING;
      } else if (viewportHeight - (snappedTop + hudHeight) < SNAP_THRESHOLD) {
        snappedTop = viewportHeight - hudHeight - PADDING;
      }

      const finalOffset = { x: snappedLeft, y: snappedTop };
      updateSettings({ offset: finalOffset, smartPlacement: false });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleHeaderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }
    
    const touch = e.touches[0];
    const hudElement = hudRef.current;
    if (!hudElement) return;

    const rect = hudElement.getBoundingClientRect();
    const startX = touch.clientX;
    const startY = touch.clientY;
    const initialLeft = rect.left;
    const initialTop = rect.top;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const touchMove = moveEvent.touches[0];
      const deltaX = touchMove.clientX - startX;
      const deltaY = touchMove.clientY - startY;

      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const hudWidth = rect.width;
      const hudHeight = rect.height;

      if (newLeft < 0) newLeft = 0;
      if (newLeft + hudWidth > viewportWidth) newLeft = viewportWidth - hudWidth;
      if (newTop < 0) newTop = 0;
      if (newTop + hudHeight > viewportHeight) newTop = viewportHeight - hudHeight;

      updateSettings({ offset: { x: newLeft, y: newTop }, smartPlacement: false });
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      const currentHud = hudRef.current;
      if (!currentHud) return;
      const currentRect = currentHud.getBoundingClientRect();
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const hudWidth = currentRect.width;
      const hudHeight = currentRect.height;
      
      let snappedLeft = currentRect.left;
      let snappedTop = currentRect.top;

      const SNAP_THRESHOLD = 40;
      const PADDING = 16;

      if (snappedLeft < SNAP_THRESHOLD) {
        snappedLeft = PADDING;
      } else if (viewportWidth - (snappedLeft + hudWidth) < SNAP_THRESHOLD) {
        snappedLeft = viewportWidth - hudWidth - PADDING;
      }

      if (snappedTop < SNAP_THRESHOLD) {
        snappedTop = PADDING;
      } else if (viewportHeight - (snappedTop + hudHeight) < SNAP_THRESHOLD) {
        snappedTop = viewportHeight - hudHeight - PADDING;
      }

      const finalOffset = { x: snappedLeft, y: snappedTop };
      updateSettings({ offset: finalOffset, smartPlacement: false });
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Layout Collision Avoidance Effect
  useEffect(() => {
    // 1. If HUD is disabled globally, hide it completely
    if (!hudSettings.enabled) {
      setHudLayoutState({
        style: { display: 'none' },
        hidden: true,
        forceCollapse: false,
      });
      eventBus.emit('hud-debug-update', {
        visible: false,
        position: 'N/A',
        opacity: hudSettings.opacity / 100,
        zIndex: 50,
        safeArea: false,
        collision: false,
        mode: hudSettings.smartPlacement ? 'Smart' : 'Manual',
      });
      return;
    }

    const rightDockOpen = layout.isWorkspaceExpanded && layout.activeWorkspaceTab !== null;
    const leftDockOpen = layout.leftDockOpen;
    const bottomTimeOpen = layout.bottomTimeOpen;

    // 2. If smart placement is disabled, use manual offset (dragged position)
    if (!hudSettings.smartPlacement) {
      if (hudSettings.offset) {
        setHudLayoutState({
          style: {
            left: `${hudSettings.offset.x}px`,
            top: `${hudSettings.offset.y}px`,
            right: 'auto',
            bottom: 'auto',
            position: 'absolute' as const,
            opacity: hudSettings.opacity / 100,
          },
          hidden: false,
          forceCollapse: false,
        });
        eventBus.emit('hud-debug-update', {
          visible: hudSettings.pinned || layout.activeWorkspaceTab === 'hud',
          position: `Manual Offset: (${hudSettings.offset.x.toFixed(0)}, ${hudSettings.offset.y.toFixed(0)})`,
          opacity: hudSettings.opacity / 100,
          zIndex: 50,
          safeArea: true,
          collision: false,
          mode: 'Manual',
        });
      } else {
        setHudLayoutState({
          style: {
            right: '16px',
            bottom: '64px',
            left: 'auto',
            top: 'auto',
            position: 'absolute' as const,
            opacity: hudSettings.opacity / 100,
          },
          hidden: false,
          forceCollapse: false,
        });
        eventBus.emit('hud-debug-update', {
          visible: hudSettings.pinned || layout.activeWorkspaceTab === 'hud',
          position: 'Default (Right: 16px, Bottom: 64px)',
          opacity: hudSettings.opacity / 100,
          zIndex: 50,
          safeArea: true,
          collision: false,
          mode: 'Manual (Default)',
        });
      }
      return;
    }

    // 3. Smart Collision Avoidance with Preferred Corner Sorting
    const vw = windowSize.w;
    const vh = windowSize.h;

    const leftDockRect = leftDockOpen ? { x1: 0, y1: 0, x2: 260, y2: vh } : null;
    const rightDockRect = rightDockOpen ? { x1: vw - 280, y1: 0, x2: vw, y2: vh } : null;
    const timeConsoleRect = bottomTimeOpen ? { x1: vw / 2 - 240, y1: vh - 180, x2: vw / 2 + 240, y2: vh } : null;
    const topPanelRect = { x1: vw / 2 - 200, y1: 0, x2: vw / 2 + 200, y2: 64 };

    const rectsOverlap = (a: { x1: number, y1: number, x2: number, y2: number }, b: { x1: number, y1: number, x2: number, y2: number }) => {
      return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
    };

    const isOverlapWithAny = (cand: { x1: number, y1: number, x2: number, y2: number }) => {
      if (leftDockRect && rectsOverlap(cand, leftDockRect)) return true;
      if (rightDockRect && rectsOverlap(cand, rightDockRect)) return true;
      if (timeConsoleRect && rectsOverlap(cand, timeConsoleRect)) return true;
      if (rectsOverlap(cand, topPanelRect)) return true;
      if (cand.x1 < 0 || cand.x2 > vw || cand.y1 < 0 || cand.y2 > vh) return true;
      return false;
    };

    // Calculate dimensions of HUD based on size state
    let w = 288;
    let h = hudSettings.collapsed ? 36 : (hudSettings.mini ? 220 : 420);

    if (hudSettings.size === 'small') {
      w = 256;
      h = hudSettings.collapsed ? 36 : (hudSettings.mini ? 190 : 370);
    } else if (hudSettings.size === 'large') {
      w = 320;
      h = hudSettings.collapsed ? 36 : (hudSettings.mini ? 240 : 470);
    }

    const createCandidates = (cw: number, ch: number) => {
      const BR = { name: 'BR', x1: vw - cw - 16, y1: vh - ch - 64, x2: vw - 16, y2: vh - 64, style: { right: '16px', bottom: '64px', left: 'auto', top: 'auto' } };
      const BL = { name: 'BL', x1: 16, y1: vh - ch - 64, x2: 16 + cw, y2: vh - 64, style: { left: '16px', bottom: '64px', right: 'auto', top: 'auto' } };
      const TR = { name: 'TR', x1: vw - cw - 16, y1: 72, x2: vw - 16, y2: 72 + ch, style: { right: '16px', top: '72px', left: 'auto', bottom: 'auto' } };
      const TL = { name: 'TL', x1: 16, y1: 72, x2: 16 + cw, y2: 72 + ch, style: { left: '16px', top: '72px', right: 'auto', bottom: 'auto' } };
      const BCL = { name: 'BCL', x1: 276, y1: vh - ch - 64, x2: 276 + cw, y2: vh - 64, style: { left: '276px', bottom: '64px', right: 'auto', top: 'auto' } };
      const TCL = { name: 'TCL', x1: 276, y1: 72, x2: 276 + cw, y2: 72 + ch, style: { left: '276px', top: '72px', right: 'auto', bottom: 'auto' } };

      const all = [BR, BL, TR, TL, BCL, TCL];
      return [
        ...all.filter(c => c.name === hudSettings.preferredCorner),
        ...all.filter(c => c.name !== hudSettings.preferredCorner),
      ];
    };

    const candidates = createCandidates(w, h);

    let chosen = candidates.find(cand => !isOverlapWithAny(cand));
    let finalForceCollapse = false;
    let finalScale = 1;
    let collisionDetected = false;

    if (!chosen) {
      collisionDetected = true;
      finalScale = 0.85;
      const sh = h * 0.85;
      const sw = w * 0.85;
      const scaledCandidates = createCandidates(sw, sh);
      chosen = scaledCandidates.find(cand => !isOverlapWithAny(cand));
    }

    if (!chosen) {
      finalForceCollapse = true;
      finalScale = 1;
      const ch = 36;
      const collapsedCandidates = createCandidates(w, ch);
      chosen = collapsedCandidates.find(cand => !isOverlapWithAny(cand));
    }

    const finalStyle = chosen ? chosen.style : { right: '16px', bottom: '64px', left: 'auto', top: 'auto' };

    setHudLayoutState({
      style: {
        ...finalStyle,
        position: 'absolute' as const,
        transform: finalScale < 1 ? `scale(${finalScale})` : undefined,
        transformOrigin: finalStyle.right !== 'auto' ? 'bottom right' : 'bottom left',
        opacity: hudSettings.opacity / 100,
      },
      hidden: false,
      forceCollapse: finalForceCollapse,
    });

    eventBus.emit('hud-debug-update', {
      visible: hudSettings.pinned || layout.activeWorkspaceTab === 'hud',
      position: chosen 
        ? `Corner: ${chosen.name} (${chosen.style.left !== 'auto' ? `left: ${chosen.style.left}` : `right: ${chosen.style.right}`}, ${chosen.style.top !== 'auto' ? `top: ${chosen.style.top}` : `bottom: ${chosen.style.bottom}`})`
        : 'Fallback (Right: 16px, Bottom: 64px)',
      opacity: hudSettings.opacity / 100,
      zIndex: 50,
      safeArea: !collisionDetected && chosen !== undefined,
      collision: collisionDetected || !chosen,
      mode: `Smart (Scale: ${finalScale.toFixed(2)}${finalForceCollapse ? ', Collapsed' : ''})`,
    });
  }, [
    hudSettings.enabled,
    hudSettings.smartPlacement,
    layout.activeWorkspaceTab,
    layout.isWorkspaceExpanded,
    layout.leftDockOpen,
    layout.bottomTimeOpen,
    hudSettings.collapsed,
    hudSettings.mini,
    hudSettings.opacity,
    hudSettings.theme,
    hudSettings.size,
    hudSettings.preferredCorner,
    hudSettings.offset,
    windowSize,
    hudSettings.pinned,
  ]);

  if (hudLayoutState.hidden) return null;
  if (!hudSettings.pinned && layout.activeWorkspaceTab !== 'hud') return null;

  const currentTheme = hudSettings.theme;
  const currentSize = hudSettings.size;
  const isMini = hudSettings.mini;
  const isCollapsed = hudSettings.collapsed || hudLayoutState.forceCollapse;
  const isSmart = hudSettings.smartPlacement;

  return (
    <div 
      ref={hudRef}
      style={hudLayoutState.style}
      className={`z-40 flex flex-col pointer-events-auto select-none ${
        isSmart ? 'transition-all duration-300 ease-out' : ''
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {isCollapsed ? (
        /* COLLAPSED HUD BUTTON */
        <button
          onMouseDown={handleHeaderMouseDown}
          onTouchStart={handleHeaderTouchStart}
          onClick={() => {
            if (!hudLayoutState.forceCollapse) {
              updateSettings({ collapsed: false });
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md border rounded-full shadow-lg transition-all ${
            hudLayoutState.forceCollapse 
              ? 'cursor-not-allowed border-red-900/50 bg-red-950/20 text-red-200' 
              : 'cursor-grab active:cursor-grabbing hover:opacity-90'
          } ${
            currentTheme === 'light' 
              ? 'bg-stone-100/95 border-stone-300 text-stone-800' 
              : currentTheme === 'glass' 
                ? 'bg-stone-950/40 border-white/20 text-white' 
                : currentTheme === 'cyberpunk' 
                  ? 'bg-black border-amber-400 text-amber-300' 
                  : 'bg-stone-950/85 border-stone-800 text-stone-200'
          }`}
          title={hudLayoutState.forceCollapse ? "畫面空間不足，自動收合中 (Auto-collapsed due to limited space)" : "拖曳可移動，點擊展開 (Drag to move, Click to expand)"}
        >
          <span className="text-[#F27D26]">📌</span>
          <span>即時感知 HUD</span>
          {hudLayoutState.forceCollapse ? (
            <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full ml-1 animate-pulse font-sans">🚫 空間受限</span>
          ) : isSmart ? (
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.2 rounded-xs ml-0.5">AUTO</span>
          ) : null}
          {!hudLayoutState.forceCollapse && (
            <span className="text-[9px] text-[#F27D26] bg-[#F27D26]/10 px-1 py-0.2 rounded-xs ml-0.5 font-sans font-normal">展開 ▼</span>
          )}
        </button>
      ) : (
        /* EXPANDED HUD WINDOW */
        <div className={`rounded shadow-2xl overflow-hidden font-mono text-[11px] flex flex-col transition-all duration-300 ${
          currentSize === 'small' ? 'w-64' : currentSize === 'large' ? 'w-80' : 'w-72'
        } ${
          currentTheme === 'light' ? 'bg-stone-50/95 backdrop-blur-md border border-stone-300 text-stone-800 shadow-2xl shadow-stone-400/30' :
          currentTheme === 'glass' ? 'bg-stone-950/30 backdrop-blur-lg border border-white/20 text-stone-100 shadow-2xl shadow-black/50 ring-1 ring-white/10' :
          currentTheme === 'cyberpunk' ? 'bg-black border-2 border-amber-400 text-amber-300 shadow-2xl shadow-amber-500/20' :
          'bg-stone-950/85 backdrop-blur-md border border-stone-800 text-stone-200'
        }`}>
          {/* Header - Make it draggable */}
          <div 
            onMouseDown={handleHeaderMouseDown}
            onTouchStart={handleHeaderTouchStart}
            className={`px-3 py-2 border-b flex items-center justify-between cursor-grab active:cursor-grabbing select-none ${
              currentTheme === 'light' ? 'bg-stone-100 border-stone-200 text-stone-900' :
              currentTheme === 'glass' ? 'bg-white/10 border-white/10 text-white' :
              currentTheme === 'cyberpunk' ? 'bg-amber-400/10 border-amber-400 text-amber-400 font-extrabold' :
              'bg-stone-900/80 border-stone-800/60 text-stone-100'
            }`}
            title="按住拖曳 HUD (Drag to move HUD)"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[#F27D26] animate-pulse">📌</span>
              <span className="font-bold tracking-wider">即時感知 HUD</span>
            </div>
            
            {/* Mode toggle + window action buttons */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Smart Placement Toggle Button */}
              <button
                onClick={() => updateSettings({ smartPlacement: !isSmart })}
                className={`px-1.5 py-0.5 rounded-xs border text-[8.5px] font-sans transition-all cursor-pointer ${
                  isSmart
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                    : 'bg-stone-900/50 border-stone-800/80 text-stone-500 hover:text-stone-300'
                }`}
                title={isSmart ? "智慧避讓已啟用 (Smart Placement Active)" : "啟用智慧避讓，自動選擇空白區 (Enable Smart Placement)"}
              >
                ⚡ {isSmart ? '智慧' : '手動'}
              </button>

              {/* Standard / Mini Mode Segmented Control */}
              <div className="flex bg-stone-950/85 p-0.5 border border-stone-800/80 rounded-sm text-[8.5px]">
                <button
                  onClick={() => updateSettings({ mini: false })}
                  className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                    !isMini
                      ? 'bg-[#F27D26]/20 text-[#F27D26]'
                      : 'text-stone-500 hover:text-stone-300'
                  }`}
                  title="標準模式 (Standard Mode)"
                >
                  標準
                </button>
                <button
                  onClick={() => updateSettings({ mini: true })}
                  className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                    isMini
                      ? 'bg-[#F27D26]/20 text-[#F27D26]'
                      : 'text-stone-500 hover:text-stone-300'
                  }`}
                  title="極簡模式 (Mini HUD Mode)"
                >
                  迷你
                </button>
              </div>

              {/* Unpin Button */}
              <button
                onClick={() => {
                  updateSettings({ pinned: false });
                  eventBus.emit('hud-unpin-trigger');
                }}
                className="text-stone-500 hover:text-stone-300 transition-colors cursor-pointer px-1 py-0.5 hover:bg-stone-800 rounded-xs text-[10px]"
                title="解除釘選，回歸主面板 (Unpin HUD)"
              >
                🔓
              </button>

              {/* Collapse Button */}
              <button
                onClick={() => updateSettings({ collapsed: true })}
                className="text-stone-500 hover:text-white transition-colors cursor-pointer px-1 py-0.5 text-[9px] font-bold"
                title="收合 HUD (Collapse)"
              >
                ▲
              </button>
            </div>
          </div>

          {/* Data Items Area */}
          <div className="p-3 space-y-2.5">
            {isMini ? (
              /* MINI MODE: Show 4 core items in extremely clean inline layout */
              <div className="space-y-2">
                {/* 1. Oppression */}
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>壓迫感 (Oppression)</span>
                  <span className={`font-bold ${
                    telemetry.oppressionIndex > 75 ? 'text-red-400 font-extrabold' :
                    telemetry.oppressionIndex > 50 ? 'text-amber-400 font-extrabold' :
                    currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'
                  }`}>{telemetry.oppressionIndex.toFixed(0)}/100</span>
                </div>

                {/* 2. Eye-to-Ceiling */}
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>視線至天花板 (Eye-to-Ceiling)</span>
                  <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'}`}>
                    {telemetry.ceilingHeight !== null ? `${telemetry.ceilingHeight.toFixed(2)}m` : 'N/A'}
                  </span>
                </div>

                {/* 3. Walkway Width */}
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>走道淨寬 (Walkway Width)</span>
                  <span className={`font-bold ${
                    telemetry.walkwayWidth !== null && telemetry.walkwayWidth < 0.9 
                      ? 'text-red-400 font-extrabold' 
                      : currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'
                  }`}>
                    {telemetry.walkwayWidth !== null ? `${telemetry.walkwayWidth.toFixed(2)}m` : 'N/A'}
                  </span>
                </div>

                {/* 4. Wall Distance */}
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>最近牆距 (Wall Distance)</span>
                  <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'}`}>
                    {telemetry.nearestWall !== null ? `${telemetry.nearestWall.toFixed(2)}m` : 'N/A'}
                  </span>
                </div>

                {/* Dynamic Plug-and-Play custom engine results in Mini Mode */}
                {telemetry.consolidatedResults && Object.entries(telemetry.consolidatedResults).map(([key, result]) => {
                  const standardKeys = ['eye-level-above-ground', 'ceiling-height', 'walkway-width', 'wall-distance', 'eye-ray'];
                  if (standardKeys.includes(key)) return null;
                  const displayValue = result.unit ? `${result.value} ${result.unit}` : String(result.value);
                  return (
                    <div key={key} className="flex justify-between items-center text-[10.5px] border-t border-stone-800/10 pt-1 mt-1">
                      <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>
                        {result.name}
                      </span>
                      <span className={`font-bold ${
                        result.status === 'error' ? 'text-red-400 font-extrabold' :
                        result.status === 'warning' ? 'text-amber-400' :
                        currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'
                      }`}>
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* STANDARD MODE: Show all checked custom items */
              <div className="space-y-2 text-[10.5px]">
                {hudSettings.enabledItems.oppression && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>壓迫感 (Oppression)</span>
                    <span className={`font-bold ${
                      telemetry.oppressionIndex > 75 ? 'text-red-400 font-extrabold' :
                      telemetry.oppressionIndex > 50 ? 'text-amber-400 font-extrabold' :
                      currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'
                    }`}>{telemetry.oppressionIndex.toFixed(0)}/100</span>
                  </div>
                )}
                {hudSettings.enabledItems.eyeToCeiling && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>視線至天花板 (Eye-to-Ceiling) ⬆️</span>
                    <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'}`}>
                      {telemetry.ceilingHeight !== null ? `${telemetry.ceilingHeight.toFixed(2)}m` : 'N/A'}
                    </span>
                  </div>
                )}
                {hudSettings.enabledItems.eyeToGround && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>視線至地面 (Eye-to-Ground) ⬇️</span>
                    <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'}`}>
                      {telemetry.eyeLevelAboveGround !== null ? `${telemetry.eyeLevelAboveGround.toFixed(2)}m` : 'N/A'}
                    </span>
                  </div>
                )}
                {hudSettings.enabledItems.walkwayWidth && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>走道淨寬 (Walkway Width) ↔️</span>
                    <span className={`font-bold ${
                      telemetry.walkwayWidth !== null && telemetry.walkwayWidth < 0.9 
                        ? 'text-red-400 font-extrabold' 
                        : currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'
                    }`}>
                      {telemetry.walkwayWidth !== null ? `${telemetry.walkwayWidth.toFixed(2)}m` : 'N/A'}
                    </span>
                  </div>
                )}
                {hudSettings.enabledItems.wallDistance && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>最近牆距 (Wall Distance) 🔍</span>
                    <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'}`}>
                      {telemetry.nearestWall !== null ? `${telemetry.nearestWall.toFixed(2)}m` : 'N/A'}
                    </span>
                  </div>
                )}
                {hudSettings.enabledItems.heading && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>方位角 (Heading) 🧭</span>
                    <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-950 font-extrabold' : 'text-stone-100'}`}>
                      {telemetry.playerHeading !== undefined ? telemetry.playerHeading : 0}°
                    </span>
                  </div>
                )}
                {hudSettings.enabledItems.fps && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>畫格速率 (FPS) ⚡</span>
                    <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-950 font-extrabold' : 'text-stone-100'}`}>{telemetry.fps} FPS</span>
                  </div>
                )}
                {hudSettings.enabledItems.altitude && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>相對高度 (Relative Altitude) 🔺</span>
                    <span className={`font-bold ${currentTheme === 'light' ? 'text-stone-950 font-extrabold' : 'text-stone-100'}`}>{(telemetry.eyeHeight - 1.65).toFixed(2)}m</span>
                  </div>
                )}
                {hudSettings.enabledItems.ada && (
                  <div className="flex justify-between items-center">
                    <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>無障礙通行標準 (ADA) ♿</span>
                    <span className={`font-bold ${telemetry.isSafeForWheelchair ? 'text-emerald-400' : 'text-red-400 font-extrabold'}`}>
                      {telemetry.isSafeForWheelchair ? 'PASS 符合' : 'LIMITED 受限'}
                    </span>
                  </div>
                )}

                {/* Dynamic Plug-and-Play custom engine results in Standard Mode */}
                {telemetry.consolidatedResults && Object.entries(telemetry.consolidatedResults).map(([key, result]) => {
                  const standardKeys = ['eye-level-above-ground', 'ceiling-height', 'walkway-width', 'wall-distance', 'eye-ray'];
                  if (standardKeys.includes(key)) return null;
                  const displayValue = result.unit ? `${result.value} ${result.unit}` : String(result.value);
                  return (
                    <div key={key} className="flex justify-between items-center border-t border-stone-800/10 pt-1.5 mt-1.5">
                      <span className={`font-sans ${currentTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>
                        {result.name}
                      </span>
                      <span className={`font-bold ${
                        result.status === 'error' ? 'text-red-400 font-extrabold' :
                        result.status === 'warning' ? 'text-amber-400' :
                        currentTheme === 'light' ? 'text-stone-900 font-extrabold' : 'text-[#F27D26]'
                      }`}>
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Performance Profiler Section */}
            <div className={`mt-2.5 pt-2.5 border-t ${currentTheme === 'light' ? 'border-stone-200' : 'border-stone-800/60'}`}>
              <button
                onClick={() => setShowPerfOverlay(!showPerfOverlay)}
                className={`w-full flex items-center justify-between text-[9px] uppercase tracking-wider font-bold hover:opacity-80 transition-opacity cursor-pointer ${
                  currentTheme === 'light' ? 'text-stone-500' : 'text-stone-400'
                }`}
              >
                <span>⚡ 效能診錯與探針 (Engine Profiler)</span>
                <span>{showPerfOverlay ? '收合 ▲' : '展開 ▼'}</span>
              </button>

              {showPerfOverlay && snapshot && (
                <div className={`mt-2 p-2 rounded text-[10px] space-y-1 font-mono ${
                  currentTheme === 'light' ? 'bg-stone-100 text-stone-700' : 'bg-stone-900/50 text-stone-300'
                }`}>
                  <div className="flex justify-between border-b border-stone-800/10 pb-1 mb-1 font-bold">
                    <span>Subsystem 子系統</span>
                    <span>Last Frame 耗時</span>
                  </div>
                  <div className="flex justify-between text-emerald-500 font-bold">
                    <span>⚡ FPS</span>
                    <span>{snapshot.FPS} FPS</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Frame Time 畫格</span>
                    <span>{snapshot.frameTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Physics Time 物理</span>
                    <span>{snapshot.physicsTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Collision Time 碰撞</span>
                    <span>{snapshot.collisionTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Camera Time 鏡頭</span>
                    <span>{snapshot.cameraTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Measurement Time 測量</span>
                    <span>{snapshot.measurementTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Solar Study Time 日照</span>
                    <span>{snapshot.solarTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wind Study Time 模擬風</span>
                    <span>{snapshot.windTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Telemetry Time 遙測</span>
                    <span>{snapshot.telemetryTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Render Time 渲染</span>
                    <span>{snapshot.renderTime.toFixed(2)} ms</span>
                  </div>

                  <div className="pt-1.5 mt-1 border-t border-stone-800/10 text-[8.5px] text-stone-500 flex justify-between items-center">
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => PerformanceProfiler.reset()}
                        className="px-1.5 py-0.5 rounded bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                      <button 
                        onClick={() => {
                          if (PerformanceProfiler.isEnabled()) {
                            PerformanceProfiler.disable();
                          } else {
                            PerformanceProfiler.enable();
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                          PerformanceProfiler.isEnabled() ? 'bg-emerald-800/30 text-emerald-400 hover:bg-emerald-700/40 font-bold' : 'bg-stone-800/80 text-stone-500 hover:bg-stone-700'
                        }`}
                      >
                        {PerformanceProfiler.isEnabled() ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                    <span className="text-[8px]">Zero Allocation</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
