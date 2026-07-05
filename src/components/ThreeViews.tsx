/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { SpaceType } from '../types';
import { buildApartment, buildGallery, buildInteractiveCorridor } from '../proceduralSpaces';

interface ThreeViewsProps {
  currentSpace: SpaceType;
  uploadedFile: File | null;
  corridorWidth: number;
  corridorHeight: number;
  modelNorth: number;
  onModelNorthChange: (deg: number) => void;
}

export const ThreeViews: React.FC<ThreeViewsProps> = ({
  currentSpace,
  uploadedFile,
  corridorWidth,
  corridorHeight,
  modelNorth,
  onModelNorthChange,
}) => {
  const planCanvasRef = useRef<HTMLCanvasElement>(null);
  const northCanvasRef = useRef<HTMLCanvasElement>(null);
  const westCanvasRef = useRef<HTMLCanvasElement>(null);

  const planContainerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dragging states for Plan View North Arrow
  const [isDraggingArrow, setIsDraggingArrow] = useState(false);

  // Two-way binding state for Numeric Input
  const [inputValue, setInputValue] = useState(modelNorth.toString());

  // Keep local input state synchronized with prop changes from Slider, Arrow drags, or parent changes
  useEffect(() => {
    if (parseFloat(inputValue) !== modelNorth) {
      setInputValue(modelNorth.toString());
    }
  }, [modelNorth]);

  // Helper to adjust angle by delta and wrap safely 0-360
  const adjustAngle = (delta: number) => {
    let val = modelNorth + delta;
    val = (val % 360 + 360) % 360;
    val = Math.round(val * 100) / 100;
    onModelNorthChange(val);
    setInputValue(val.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setInputValue(valStr);
    
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      let normalized = parsed;
      if (normalized < 0) {
        normalized = (normalized % 360 + 360) % 360;
      } else if (normalized > 360) {
        normalized = normalized % 360;
      }
      normalized = Math.round(normalized * 100) / 100;
      onModelNorthChange(normalized);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      setInputValue(modelNorth.toString());
    } else {
      let normalized = parsed;
      if (normalized < 0) {
        normalized = (normalized % 360 + 360) % 360;
      } else if (normalized > 360) {
        normalized = normalized % 360;
      }
      normalized = Math.round(normalized * 100) / 100;
      onModelNorthChange(normalized);
      setInputValue(normalized.toString());
    }
  };

  // Helper to calculate angle from mouse position on plan container
  const handleArrowRotation = (clientX: number, clientY: number) => {
    if (!planContainerRef.current) return;
    const rect = planContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    let angleDegrees = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI));
    if (angleDegrees < 0) angleDegrees += 360;

    onModelNorthChange(angleDegrees);
  };

  const handleArrowMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingArrow(true);
    handleArrowRotation(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!isDraggingArrow) return;

    const onMouseMove = (e: MouseEvent) => {
      handleArrowRotation(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      setIsDraggingArrow(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingArrow]);

  useEffect(() => {
    let isDestroyed = false;
    let fileUrl: string | null = null;

    const run = async () => {
      const modelKey = `${currentSpace}_${uploadedFile?.name || ''}_${uploadedFile?.lastModified || ''}_${corridorWidth}_${corridorHeight}`;

      // 1. Check if model needs reloading or rebuilding (use cache ref)
      if (loadedModelKeyRef.current !== modelKey || !loadedModelRef.current) {
        setIsLoading(true);
        setLoadError(null);

        // Dispose previous model resources if any
        if (loadedModelRef.current) {
          loadedModelRef.current.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              if (node.geometry) node.geometry.dispose();
              if (node.material) {
                if (Array.isArray(node.material)) {
                  node.material.forEach((m) => m.dispose());
                } else {
                  node.material.dispose();
                }
              }
            }
          });
          loadedModelRef.current = null;
        }

        const modelGroup = new THREE.Group();

        try {
          const tempScene = new THREE.Scene();

          if (currentSpace === 'apartment') {
            buildApartment(tempScene);
            const created = tempScene.children.find(child => child.name === 'apartment');
            if (created) {
              modelGroup.add(created);
            }
          } else if (currentSpace === 'gallery') {
            buildGallery(tempScene);
            const created = tempScene.children.find(child => child.name === 'gallery');
            if (created) {
              modelGroup.add(created);
            }
          } else if (currentSpace === 'corridor') {
            const corridorGroup = buildInteractiveCorridor(tempScene, corridorWidth, corridorHeight);
            if (corridorGroup) {
              modelGroup.add(corridorGroup);
            }
          } else if (currentSpace === 'uploaded' && uploadedFile) {
            const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
            fileUrl = URL.createObjectURL(uploadedFile);

            const manager = new THREE.LoadingManager();
            const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
              if (extension === 'gltf' || extension === 'glb') {
                const loader = new GLTFLoader(manager);
                loader.load(fileUrl!, (gltf) => resolve(gltf.scene), undefined, reject);
              } else if (extension === 'obj') {
                const loader = new OBJLoader(manager);
                loader.load(fileUrl!, (obj) => resolve(obj), undefined, reject);
              } else if (extension === 'fbx') {
                const loader = new FBXLoader(manager);
                loader.load(fileUrl!, (fbx) => resolve(fbx), undefined, reject);
              } else {
                reject(new Error('不支援的檔案格式'));
              }
            });

            const loadedScene = await loadPromise;
            modelGroup.add(loadedScene);
          } else {
            const geom = new THREE.BoxGeometry(4, 3, 4);
            const mat = new THREE.MeshStandardMaterial({ color: 0x444444, wireframe: true });
            const mesh = new THREE.Mesh(geom, mat);
            modelGroup.add(mesh);
          }

          // Apply visual standard material tuning
          modelGroup.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              if (node.material) {
                const originalColor = (node.material as any).color || new THREE.Color(0xffffff);
                node.material = new THREE.MeshStandardMaterial({
                  color: originalColor,
                  roughness: 0.9,
                  metalness: 0.05,
                  flatShading: true,
                  polygonOffset: true,
                  polygonOffsetFactor: 1,
                  polygonOffsetUnits: 1
                });
              }
            }
          });

          if (!isDestroyed) {
            loadedModelRef.current = modelGroup;
            loadedModelKeyRef.current = modelKey;
          }
        } catch (err: any) {
          console.error("ThreeViews model loading failed: ", err);
          if (!isDestroyed) {
            setLoadError(err?.message || "無法載入該模型檔案。");
          }
        } finally {
          if (!isDestroyed) {
            setIsLoading(false);
          }
        }
      }

      // If we don't have a model loaded, stop rendering
      if (!loadedModelRef.current) return;

      // 2. Render views instantly
      if (isDestroyed) return;

      const scene = new THREE.Scene();
      
      // Sky color: RGB(180, 210, 255) = #b4d2ff
      scene.background = new THREE.Color(180 / 255, 210 / 255, 255 / 255);

      // Setup Ground Plane based on bounding box
      const box = new THREE.Box3().setFromObject(loadedModelRef.current);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 10;

      // Ground size: Bounding Box plus 10 meters on each side
      const groundSizeX = (size.x || 10) + 20;
      const groundSizeZ = (size.z || 10) + 20;
      const groundGeom = new THREE.PlaneGeometry(groundSizeX, groundSizeZ);
      
      // Grass color: RGB(90, 120, 80) = #5a7850
      const groundMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(90 / 255, 120 / 255, 80 / 255),
        roughness: 1.0,
        metalness: 0.0,
        flatShading: true,
      });
      const groundMesh = new THREE.Mesh(groundGeom, groundMat);
      groundMesh.rotation.x = -Math.PI / 2;
      // Align ground with the lowest point of the model (box.min.y)
      groundMesh.position.set(center.x, box.min.y - 0.01, center.z);
      scene.add(groundMesh);

      // Lighting configuration
      // Hemisphere Light (sky light: #b4d2ff, ground light: #5a7850, intensity: 0.65)
      const hemiLight = new THREE.HemisphereLight(
        new THREE.Color(180 / 255, 210 / 255, 255 / 255),
        new THREE.Color(90 / 255, 120 / 255, 80 / 255),
        0.65
      );
      scene.add(hemiLight);

      // Directional Lights
      const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
      dirLight1.position.set(20, 40, 20);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.35);
      dirLight2.position.set(-20, 20, -20);
      scene.add(dirLight2);

      // Add our cached model group to the scene (it is managed as single reference)
      scene.add(loadedModelRef.current);

      // Set up viewport sizes
      const width = 220;
      const height = 180;
      const aspect = width / height;

      // Plan camera (Top-down)
      const frustumSize = maxDim * 1.25;
      const planCam = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
      );
      planCam.position.set(center.x, center.y + maxDim, center.z);
      planCam.up.set(0, 0, -1); // Up is north (-Z)
      planCam.lookAt(center);

      // North Elevation camera (Looking towards center from the user-defined True North)
      const modelNorthRad = (modelNorth || 0) * (Math.PI / 180);
      const northDx = Math.sin(modelNorthRad);
      const northDz = -Math.cos(modelNorthRad);

      const northCam = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
      );
      northCam.position.set(
        center.x + northDx * maxDim * 1.5,
        center.y + (size.y / 2 || 1.5),
        center.z + northDz * maxDim * 1.5
      );
      northCam.lookAt(center);

      // West Elevation camera (Looking towards center from the user-defined True West, 90 degrees CCW)
      const westDx = -Math.cos(modelNorthRad);
      const westDz = -Math.sin(modelNorthRad);

      const westCam = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
      );
      westCam.position.set(
        center.x + westDx * maxDim * 1.5,
        center.y + (size.y / 2 || 1.5),
        center.z + westDz * maxDim * 1.5
      );
      westCam.lookAt(center);

      // Render Plan
      if (planCanvasRef.current) {
        const r1 = new THREE.WebGLRenderer({ canvas: planCanvasRef.current, antialias: true });
        r1.setSize(width, height);
        r1.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        r1.render(scene, planCam);
        r1.dispose();
      }

      // Render North Elevation
      if (northCanvasRef.current) {
        const r2 = new THREE.WebGLRenderer({ canvas: northCanvasRef.current, antialias: true });
        r2.setSize(width, height);
        r2.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        r2.render(scene, northCam);
        r2.dispose();
      }

      // Render West Elevation
      if (westCanvasRef.current) {
        const r3 = new THREE.WebGLRenderer({ canvas: westCanvasRef.current, antialias: true });
        r3.setSize(width, height);
        r3.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        r3.render(scene, westCam);
        r3.dispose();
      }
    };

    run();

    return () => {
      isDestroyed = true;
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [currentSpace, uploadedFile, corridorWidth, corridorHeight, modelNorth]);

  // Keep references to loaded model to support lightning fast re-renders
  const loadedModelRef = useRef<THREE.Group | null>(null);
  const loadedModelKeyRef = useRef<string>('');

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="p-3 bg-bg-dark border border-border-dark text-xs text-brand animate-pulse font-mono flex items-center justify-center gap-2">
          <span>🔄 載入 3D 模型圖面中 (Loading Blueprint views)...</span>
        </div>
      )}
      
      {loadError && (
        <div className="p-3 bg-red-950/40 border border-red-500/50 text-xs text-red-400 font-mono rounded-sm">
          ⚠️ 載入出錯: {loadError}
        </div>
      )}

      {/* Grid of Three Views */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* View 1: Plan View */}
        <div className="flex flex-col border border-border-dark/80 bg-bg-darker rounded-sm overflow-hidden">
          <div className="px-2 py-1 bg-bg-dark text-[10px] font-bold text-stone-300 font-mono flex justify-between items-center select-none border-b border-border-dark/60">
            <span>平面圖 PLAN (TOP-DOWN)</span>
            <span className="text-brand font-mono font-bold">2D ORTHO</span>
          </div>
          
          <div 
            ref={planContainerRef}
            className="relative flex items-center justify-center h-48 w-full bg-[#b4d2ff] cursor-grab active:cursor-grabbing overflow-hidden"
          >
            <canvas ref={planCanvasRef} className="w-[220px] h-[180px] pointer-events-none" />

            {/* Architectural Info Overlay */}
            <div className="absolute top-2 right-2 px-1.5 py-1 bg-black/85 border border-stone-800 rounded-sm text-[8px] font-mono leading-tight text-stone-300 text-right select-none pointer-events-none shadow-md">
              <div className="font-extrabold text-white uppercase tracking-wider">PLAN VIEW</div>
              <div className="text-stone-400">Orthographic</div>
              <div className="text-orange-400 font-bold">Scale 1:500</div>
            </div>

            {/* Compass overlay with fixed Model Forward and rotatable True North */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <div className="w-36 h-36 rounded-full border border-stone-600/30 flex items-center justify-center relative">
                
                {/* 1. Fixed Model Forward Arrow (Grey, 0deg pointing straight up) */}
                <div className="absolute top-0 flex flex-col items-center select-none pointer-events-none" style={{ transform: 'translateY(-50%)' }}>
                  <div className="text-[7.5px] font-mono font-bold text-stone-600 bg-white/95 px-1.5 py-0.5 border border-stone-300 rounded shadow-sm flex items-center gap-1">
                    <span className="text-stone-400 font-bold">▲</span>
                    <span>原始前方 (Model Forward 0°)</span>
                  </div>
                  <div className="w-0.5 h-4 bg-stone-500/60 mt-0.5"></div>
                </div>

                {/* 2. Rotatable True North Arrow (Orange, rotates by modelNorth degrees) */}
                <div 
                  style={{ transform: `rotate(${modelNorth}deg)` }}
                  className="absolute inset-0 flex items-center justify-center transition-transform duration-75 pointer-events-none"
                >
                  <div 
                    onMouseDown={handleArrowMouseDown}
                    className="absolute top-0 flex flex-col items-center cursor-grab active:cursor-grabbing pointer-events-auto group"
                    style={{ transform: 'translateY(-50%)' }}
                    title="拖曳以旋轉正北方 (Drag to rotate True North)"
                  >
                    <div className="text-[9px] font-extrabold text-white bg-orange-600 px-2 py-0.5 border border-orange-500 rounded shadow-lg group-hover:bg-orange-500 transition-all font-mono flex items-center gap-1">
                      <span>↑</span>
                      <span>正北 (True North N)</span>
                    </div>
                    <div className="w-1.5 h-5 bg-orange-600 group-hover:bg-orange-500 shadow-md"></div>
                  </div>
                </div>

                {/* Center dot reference */}
                <div className="w-2 h-2 rounded-full bg-stone-800/60 border border-white/50"></div>
              </div>
            </div>

            {/* Hint overlay */}
            <div className="absolute bottom-1 right-2 pointer-events-none text-[8px] text-stone-700 font-sans">
              [ 拖曳橘色指針設定正北 ]
            </div>
          </div>
        </div>

        {/* View 2: North Elevation */}
        <div className="flex flex-col border border-border-dark/80 bg-bg-darker rounded-sm overflow-hidden">
          <div className="px-2 py-1 bg-bg-dark text-[10px] font-bold text-stone-300 font-mono flex justify-between items-center select-none border-b border-border-dark/60">
            <span>北方立面 NORTH ELEVATION</span>
            <span className="text-brand font-mono font-bold">LIVE UPDATE</span>
          </div>
          <div className="relative flex items-center justify-center h-48 bg-[#b4d2ff] overflow-hidden">
            <canvas ref={northCanvasRef} className="w-[220px] h-[180px]" />

            {/* Architectural Info Overlay */}
            <div className="absolute top-2 right-2 px-1.5 py-1 bg-black/85 border border-stone-800 rounded-sm text-[8px] font-mono leading-tight text-stone-300 text-right select-none pointer-events-none shadow-md">
              <div className="font-extrabold text-white uppercase tracking-wider">NORTH ELEVATION</div>
              <div className="text-stone-400">Orthographic</div>
              <div className="text-orange-400 font-bold">Facing True North</div>
            </div>

            <div className="absolute bottom-1.5 left-2 pointer-events-none text-[9px] text-stone-700 font-sans flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
              <span>隨指北針同步更新</span>
            </div>
          </div>
        </div>

        {/* View 3: West Elevation */}
        <div className="flex flex-col border border-border-dark/80 bg-bg-darker rounded-sm overflow-hidden">
          <div className="px-2 py-1 bg-bg-dark text-[10px] font-bold text-stone-300 font-mono flex justify-between items-center select-none border-b border-border-dark/60">
            <span>西方立面 WEST ELEVATION</span>
            <span className="text-brand font-mono font-bold">LIVE UPDATE</span>
          </div>
          <div className="relative flex items-center justify-center h-48 bg-[#b4d2ff] overflow-hidden">
            <canvas ref={westCanvasRef} className="w-[220px] h-[180px]" />

            {/* Architectural Info Overlay */}
            <div className="absolute top-2 right-2 px-1.5 py-1 bg-black/85 border border-stone-800 rounded-sm text-[8px] font-mono leading-tight text-stone-300 text-right select-none pointer-events-none shadow-md">
              <div className="font-extrabold text-white uppercase tracking-wider">WEST ELEVATION</div>
              <div className="text-stone-400">Orthographic</div>
              <div className="text-orange-400 font-bold">Facing True West</div>
            </div>

            <div className="absolute bottom-1.5 left-2 pointer-events-none text-[9px] text-stone-700 font-sans flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
              <span>同步更新 (90° 偏移)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Rotation degrees slider & Double-bound numeric input */}
      <div className="bg-bg-dark/60 border border-border-dark/80 p-4 rounded-sm space-y-3 shadow-md">
        
        {/* Row 1: Header and Double-Bound Decimal Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-border-dark/50 pb-2.5">
          <div className="flex flex-col">
            <span className="text-stone-300 font-bold font-sans">正北方朝向校正 (True North Alignment)</span>
            <span className="text-[10px] text-stone-500 font-mono">STEP 3 MODEL ORIENTATION OFFSET</span>
          </div>
          
          {/* Numeric Input container */}
          <div className="flex items-center gap-2">
            <span className="text-stone-400 font-mono text-[11px]">Angle</span>
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="w-20 bg-bg-darker border border-border-dark px-2.5 py-1 text-center text-brand font-mono font-bold text-xs rounded-sm focus:outline-none focus:border-brand"
                placeholder="0.0"
              />
              <span className="absolute right-2 text-stone-500 font-mono pointer-events-none">°</span>
            </div>
            
            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                onModelNorthChange(0);
                setInputValue("0");
              }}
              className="px-2 py-1 bg-stone-900 border border-border-dark text-[10px] text-stone-400 hover:text-brand hover:border-brand/50 rounded-sm font-mono cursor-pointer transition-colors"
            >
              重設 (0°)
            </button>
          </div>
        </div>

        {/* Row 2: Slider + Micro-Tuning Buttons */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          
          {/* Slider (10cols in large screen) */}
          <div className="lg:col-span-7 flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="360"
              step="0.1"
              value={modelNorth}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onModelNorthChange(val);
                setInputValue(val.toString());
              }}
              className="flex-1 accent-brand h-1 bg-bg-darker appearance-none cursor-pointer rounded-sm"
            />
          </div>

          {/* Micro tuning buttons (5cols in large screen) */}
          <div className="lg:col-span-5 flex items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => adjustAngle(-5)}
              className="px-2 py-1 bg-stone-900 border border-border-dark hover:border-orange-500/30 hover:text-orange-400 text-[10px] text-stone-400 rounded-sm font-mono cursor-pointer transition-colors"
              title="-5 Degrees"
            >
              ↺ -5°
            </button>
            <button
              type="button"
              onClick={() => adjustAngle(-1)}
              className="px-2 py-1 bg-stone-900 border border-border-dark hover:border-orange-500/30 hover:text-orange-400 text-[10px] text-stone-400 rounded-sm font-mono cursor-pointer transition-colors"
              title="-1 Degree"
            >
              ◀ -1°
            </button>
            <button
              type="button"
              onClick={() => adjustAngle(1)}
              className="px-2 py-1 bg-stone-900 border border-border-dark hover:border-orange-500/30 hover:text-orange-400 text-[10px] text-stone-400 rounded-sm font-mono cursor-pointer transition-colors"
              title="+1 Degree"
            >
              ▶ +1°
            </button>
            <button
              type="button"
              onClick={() => adjustAngle(5)}
              className="px-2 py-1 bg-stone-900 border border-border-dark hover:border-orange-500/30 hover:text-orange-400 text-[10px] text-stone-400 rounded-sm font-mono cursor-pointer transition-colors"
              title="+5 Degrees"
            >
              ↻ +5°
            </button>
          </div>
        </div>

        <p className="text-[10px] text-stone-500 font-sans leading-relaxed">
          💡 設計原理: 平面圖中的建築保持靜止，拖曳橘色指針、調整滑桿、或輸入數值可調整地理正北朝向。此時北立面與西立面相機將同步旋轉更新，使預覽畫面能與日照模擬、天空與地面關係完美同步，即時掌握建築量體的受光立面關係。
        </p>
      </div>
    </div>
  );
};
