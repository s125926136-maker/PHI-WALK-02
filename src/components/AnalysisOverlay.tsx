import React from 'react';
import { PlayerSettings } from '../types';

interface AnalysisOverlayProps {
  settings: PlayerSettings;
  playerHeading: number;
  sunAzimuthDeg: number;
}

export function AnalysisOverlay({
  settings,
  playerHeading,
  sunAzimuthDeg,
}: AnalysisOverlayProps) {
  if (!settings.showCompass) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 animate-fade-in select-none">
      {/* Compass Graphic */}
      <div className="bg-bg-darker/80 backdrop-blur-md border border-border-dark/65 p-1.5 rounded-full shadow-lg flex items-center justify-center relative">
        <svg width="108" height="108" viewBox="0 0 120 120" className="overflow-visible">
          {/* Outer glass background */}
          <circle cx="60" cy="60" r="48" className="fill-bg-dark/30 stroke-border-dark/40 stroke-[1.5px]" />
          <circle cx="60" cy="60" r="44" className="fill-none stroke-stone-800/60 stroke-[1px]" />
          
          {/* Rotating / Fixed Dial Group */}
          <g transform={`rotate(${settings.viewMode === 'first-person' ? -playerHeading : 0}, 60, 60)`}>
            {/* Tick marks every 30 degrees */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
              const rad = (deg - 90) * Math.PI / 180;
              const isCardinal = deg % 90 === 0;
              const length = isCardinal ? 8 : 4;
              const x1 = 60 + Math.cos(rad) * 44;
              const y1 = 60 + Math.sin(rad) * 44;
              const x2 = 60 + Math.cos(rad) * (44 - length);
              const y2 = 60 + Math.sin(rad) * (44 - length);
              return (
                <line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={isCardinal ? "stroke-brand/70 stroke-[1.5px]" : "stroke-stone-600/50 stroke-[1px]"}
                />
              );
            })}

            {/* Cardinal direction labels inside the dial */}
            <text x="60" y="27" className="text-[11px] font-bold fill-stone-100 font-sans" textAnchor="middle">N</text>
            <text x="96" y="64" className="text-[10px] font-medium fill-stone-300 font-sans" textAnchor="middle">E</text>
            <text x="60" y="101" className="text-[10px] font-medium fill-stone-300 font-sans" textAnchor="middle">S</text>
            <text x="24" y="64" className="text-[10px] font-medium fill-stone-300 font-sans" textAnchor="middle">W</text>

            {/* Sub-cardinal labels inside the dial */}
            <text x="85" y="40" className="text-[8px] font-medium fill-stone-500 font-sans" textAnchor="middle">NE</text>
            <text x="85" y="87" className="text-[8px] font-medium fill-stone-500 font-sans" textAnchor="middle">SE</text>
            <text x="35" y="87" className="text-[8px] font-medium fill-stone-500 font-sans" textAnchor="middle">SW</text>
            <text x="35" y="40" className="text-[8px] font-medium fill-stone-500 font-sans" textAnchor="middle">NW</text>

            {/* Sun Icon on the dial in First-Person mode, so it rotates with the dial relative to player */}
            {settings.viewMode === 'first-person' && (
              (() => {
                const sunRad = (sunAzimuthDeg - 90) * Math.PI / 180;
                const sx = 60 + Math.cos(sunRad) * 33;
                const sy = 60 + Math.sin(sunRad) * 33;
                return (
                  <g>
                    <circle cx={sx} cy={sy} r="5" className="fill-amber-400/20 stroke-amber-500 stroke-[1px]" />
                    <text x={sx} y={sy + 3.5} className="text-[10px] fill-amber-400 font-bold" textAnchor="middle">☀</text>
                  </g>
                );
              })()
            )}
          </g>

          {/* needle pointer or fixed reference elements */}
          {settings.viewMode === 'first-person' ? (
            <>
              {/* First person: Fixed pointer pointing to the top of the HUD */}
              <polygon points="60,6 55,15 65,15" className="fill-brand stroke-none" />
              <circle cx="60" cy="60" r="3.5" className="fill-brand/90 stroke-bg-darker stroke-[1px]" />
            </>
          ) : (
            <>
              {/* Third person (Analysis View): North is fixed at top (0 rotation of dial).
                  Draw indicators for Player Heading and Model Rotation, and Sun! */}
              
              {/* Player Heading needle */}
              {(() => {
                const rad = (playerHeading - 90) * Math.PI / 180;
                const px = 60 + Math.cos(rad) * 34;
                const py = 60 + Math.sin(rad) * 34;
                return (
                  <g>
                    <line x1="60" y1="60" x2={px} y2={py} className="stroke-rose-500 stroke-[1.5px]" />
                    <polygon
                      points={`${px},${py} ${px - Math.cos(rad - 0.4) * 6},${py - Math.sin(rad - 0.4) * 6} ${px - Math.cos(rad + 0.4) * 6},${py - Math.sin(rad + 0.4) * 6}`}
                      className="fill-rose-500 stroke-none"
                    />
                  </g>
                );
              })()}

              {/* Model/Building Rotation indicator line/pointer */}
              {(() => {
                const bRot = settings.modelRotation || 0;
                const rad = (bRot - 90) * Math.PI / 180;
                const bx = 60 + Math.cos(rad) * 38;
                const by = 60 + Math.sin(rad) * 38;
                return (
                  <g>
                    <line x1="60" y1="60" x2={bx} y2={by} className="stroke-brand/80 stroke-[1.5px]" strokeDasharray="2 1" />
                    <circle cx={bx} cy={by} r="2.5" className="fill-brand stroke-none" />
                  </g>
                );
              })()}

              {/* Sun Icon in world coordinates */}
              {(() => {
                const sunRad = (sunAzimuthDeg - 90) * Math.PI / 180;
                const sx = 60 + Math.cos(sunRad) * 33;
                const sy = 60 + Math.sin(sunRad) * 33;
                return (
                  <g>
                    <circle cx={sx} cy={sy} r="5" className="fill-amber-400/20 stroke-amber-500 stroke-[1px]" />
                    <text x={sx} y={sy + 3.5} className="text-[10px] fill-amber-400 font-bold" textAnchor="middle">☀</text>
                  </g>
                );
              })()}
              
              <circle cx="60" cy="60" r="3.5" className="fill-stone-300 stroke-bg-darker stroke-[1px]" />
            </>
          )}
        </svg>
      </div>

      {/* Heading Readout */}
      <div className="mt-1 px-2 py-0.5 bg-bg-darker/90 backdrop-blur-sm border border-border-dark/65 rounded-none font-mono text-[9px] font-bold text-stone-200 tracking-wider flex items-center gap-1.5 shadow">
        <span className="text-stone-400">Heading</span>
        <span className="text-brand font-bold">{playerHeading}°</span>
        <span className="text-brand font-extrabold bg-brand/10 px-1 rounded-sm">
          {(() => {
            const d = playerHeading;
            if (d >= 337.5 || d < 22.5) return 'N';
            if (d >= 22.5 && d < 67.5) return 'NE';
            if (d >= 67.5 && d < 112.5) return 'E';
            if (d >= 112.5 && d < 157.5) return 'SE';
            if (d >= 157.5 && d < 202.5) return 'S';
            if (d >= 202.5 && d < 247.5) return 'SW';
            if (d >= 247.5 && d < 292.5) return 'W';
            if (d >= 292.5 && d < 337.5) return 'NW';
            return 'N';
          })()}
        </span>
      </div>
    </div>
  );
}
