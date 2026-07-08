import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { disposeSimulatorObject3D } from './threeDisposal';

interface UseEnvironmentObjectsOptions {
  sceneBoundaryEnabled: boolean;
  sceneVegetationEnabled: boolean;
  sceneSpawnPointEnabled: boolean;
}

interface UpdateGroundEnvironmentParams {
  scene: THREE.Scene;
  groundMesh: THREE.Mesh;
  currentModelGroup: THREE.Group | null;
  siteMargin?: number;
}

function createSunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 256);

  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.12, 'rgba(254, 240, 138, 1.0)');
  grad.addColorStop(0.3, 'rgba(245, 158, 11, 0.9)');
  grad.addColorStop(0.6, 'rgba(239, 68, 68, 0.25)');
  grad.addColorStop(1.0, 'rgba(239, 68, 68, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function useEnvironmentObjects({
  sceneBoundaryEnabled,
  sceneVegetationEnabled,
  sceneSpawnPointEnabled,
}: UseEnvironmentObjectsOptions) {
  const siteBoundaryRef = useRef<THREE.LineSegments | null>(null);
  const vegetationGroupRef = useRef<THREE.Group | null>(null);
  const spawnPointMeshRef = useRef<THREE.Mesh | null>(null);
  const sunGroupRef = useRef<THREE.Group | null>(null);
  const sunSphereRef = useRef<THREE.Object3D | null>(null);
  const windGroupRef = useRef<THREE.Group | null>(null);
  const accessibilityGroupRef = useRef<THREE.Group | null>(null);
  const turningCircleRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (siteBoundaryRef.current) {
      siteBoundaryRef.current.visible = sceneBoundaryEnabled;
    }
  }, [sceneBoundaryEnabled]);

  useEffect(() => {
    if (vegetationGroupRef.current) {
      vegetationGroupRef.current.visible = sceneVegetationEnabled;
    }
  }, [sceneVegetationEnabled]);

  useEffect(() => {
    if (spawnPointMeshRef.current) {
      spawnPointMeshRef.current.visible = sceneSpawnPointEnabled;
    }
  }, [sceneSpawnPointEnabled]);

  const updateGroundEnvironment = ({
    scene,
    groundMesh,
    currentModelGroup,
    siteMargin,
  }: UpdateGroundEnvironmentParams): void => {
    const box = new THREE.Box3();
    if (currentModelGroup) {
      box.setFromObject(currentModelGroup);
    } else {
      box.set(
        new THREE.Vector3(-10, 0, -10),
        new THREE.Vector3(10, 4, 10)
      );
    }

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const margin = siteMargin !== undefined ? siteMargin : 10;
    const groundWidth = size.x + margin * 2;
    const groundDepth = size.z + margin * 2;

    if (groundMesh.geometry) {
      groundMesh.geometry.dispose();
    }
    groundMesh.geometry = new THREE.PlaneGeometry(groundWidth, groundDepth);
    groundMesh.position.set(center.x, -0.01, center.z);

    if (siteBoundaryRef.current) {
      disposeSimulatorObject3D(siteBoundaryRef.current);
      siteBoundaryRef.current = null;
    }

    const boundaryPoints = [];
    const halfW = groundWidth / 2;
    const halfD = groundDepth / 2;

    const p1 = new THREE.Vector3(center.x - halfW, 0.02, center.z - halfD);
    const p2 = new THREE.Vector3(center.x + halfW, 0.02, center.z - halfD);
    const p3 = new THREE.Vector3(center.x + halfW, 0.02, center.z + halfD);
    const p4 = new THREE.Vector3(center.x - halfW, 0.02, center.z + halfD);

    boundaryPoints.push(
      p1, p2,
      p2, p3,
      p3, p4,
      p4, p1
    );

    const boundaryGeom = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
    const boundaryMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.8,
      gapSize: 0.4,
      linewidth: 2,
    });
    const siteBoundary = new THREE.LineSegments(boundaryGeom, boundaryMat);
    siteBoundary.computeLineDistances();
    siteBoundary.visible = sceneBoundaryEnabled;
    scene.add(siteBoundary);
    siteBoundaryRef.current = siteBoundary;

    if (vegetationGroupRef.current) {
      disposeSimulatorObject3D(vegetationGroupRef.current);
      vegetationGroupRef.current = null;
    }

    const vegGroup = new THREE.Group();
    vegGroup.visible = sceneVegetationEnabled;

    const treePositions = [
      new THREE.Vector3(center.x - halfW + 1.5, 0, center.z - halfD + 1.5),
      new THREE.Vector3(center.x + halfW - 1.5, 0, center.z - halfD + 1.5),
      new THREE.Vector3(center.x - halfW + 1.5, 0, center.z + halfD - 1.5),
      new THREE.Vector3(center.x + halfW - 1.5, 0, center.z + halfD - 1.5),
      new THREE.Vector3(center.x - halfW + 1.5, 0, center.z),
      new THREE.Vector3(center.x + halfW - 1.5, 0, center.z),
      new THREE.Vector3(center.x, 0, center.z - halfD + 1.5),
      new THREE.Vector3(center.x, 0, center.z + halfD - 1.5),
    ];

    treePositions.forEach(pos => {
      const tree = new THREE.Group();
      tree.position.copy(pos);

      const trunkGeom = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.4;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const foliageGeom = new THREE.ConeGeometry(0.5, 1.4, 8);
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8, flatShading: true });
      const foliage = new THREE.Mesh(foliageGeom, foliageMat);
      foliage.position.y = 1.3;
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      tree.add(foliage);

      vegGroup.add(tree);
    });

    scene.add(vegGroup);
    vegetationGroupRef.current = vegGroup;

    if (spawnPointMeshRef.current) {
      disposeSimulatorObject3D(spawnPointMeshRef.current);
      spawnPointMeshRef.current = null;
    }
    const spawnZ = box.min.z - 5.0;
    const spawnGeom = new THREE.RingGeometry(0.4, 0.45, 32);
    spawnGeom.rotateX(-Math.PI / 2);
    const spawnMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const spawnMesh = new THREE.Mesh(spawnGeom, spawnMat);
    spawnMesh.position.set(center.x, 0.01, spawnZ);
    spawnMesh.visible = sceneSpawnPointEnabled;
    scene.add(spawnMesh);
    spawnPointMeshRef.current = spawnMesh;
  };

  const createAnalysisEnvironmentObjects = (scene: THREE.Scene): void => {
    const sunGroup = new THREE.Group();
    sunGroup.visible = false;
    scene.add(sunGroup);
    sunGroupRef.current = sunGroup;

    const sunPathPoints = [];
    const sunPathDistance = 1000;
    for (let theta = 0; theta <= Math.PI; theta += 0.05) {
      sunPathPoints.push(new THREE.Vector3(Math.cos(theta) * sunPathDistance, Math.sin(theta) * (sunPathDistance * 0.75), 0));
    }
    const sunPathGeom = new THREE.BufferGeometry().setFromPoints(sunPathPoints);
    const sunPathMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 50.0,
      gapSize: 25.0,
    });
    const sunPathLine = new THREE.Line(sunPathGeom, sunPathMat);
    sunPathLine.computeLineDistances();
    sunGroup.add(sunPathLine);

    const sunTexture = createSunTexture();
    const sunSpriteMat = new THREE.SpriteMaterial({
      map: sunTexture || undefined,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sunSprite = new THREE.Sprite(sunSpriteMat);
    sunSprite.scale.set(120, 120, 1);
    sunGroup.add(sunSprite);
    sunSphereRef.current = sunSprite;

    const windGroup = new THREE.Group();
    windGroup.visible = false;
    scene.add(windGroup);
    windGroupRef.current = windGroup;

    const windParticleGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6);
    windParticleGeom.rotateX(Math.PI / 2);

    for (let i = 0; i < 16; i++) {
      const windMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const windMesh = new THREE.Mesh(windParticleGeom, windMat);

      windMesh.userData = {
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          Math.random() * 2.2,
          (Math.random() - 0.5) * 10
        ),
        initialized: true
      };
      windGroup.add(windMesh);
    }

    const accessibilityGroup = new THREE.Group();
    accessibilityGroup.visible = false;
    scene.add(accessibilityGroup);
    accessibilityGroupRef.current = accessibilityGroup;

    const turningCircleGeom = new THREE.RingGeometry(0.74, 0.76, 48);
    const turningCircleMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const turningCircle = new THREE.Mesh(turningCircleGeom, turningCircleMat);
    turningCircle.rotation.x = -Math.PI / 2;
    turningCircle.position.y = 0.02;
    accessibilityGroup.add(turningCircle);
    turningCircleRef.current = turningCircle;

    const innerDiscGeom = new THREE.CircleGeometry(0.74, 32);
    const innerDiscMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerDisc = new THREE.Mesh(innerDiscGeom, innerDiscMat);
    innerDisc.rotation.x = -Math.PI / 2;
    innerDisc.position.y = 0.015;
    accessibilityGroup.add(innerDisc);
  };

  const cleanupEnvironmentObjects = (): void => {
    disposeSimulatorObject3D(siteBoundaryRef.current);
    siteBoundaryRef.current = null;
    disposeSimulatorObject3D(vegetationGroupRef.current);
    vegetationGroupRef.current = null;
    disposeSimulatorObject3D(spawnPointMeshRef.current);
    spawnPointMeshRef.current = null;
    disposeSimulatorObject3D(sunGroupRef.current);
    sunGroupRef.current = null;
    sunSphereRef.current = null;
    disposeSimulatorObject3D(windGroupRef.current);
    windGroupRef.current = null;
    disposeSimulatorObject3D(accessibilityGroupRef.current);
    accessibilityGroupRef.current = null;
    turningCircleRef.current = null;
  };

  return {
    siteBoundaryRef,
    vegetationGroupRef,
    spawnPointMeshRef,
    sunGroupRef,
    windGroupRef,
    accessibilityGroupRef,
    turningCircleRef,
    updateGroundEnvironment,
    createAnalysisEnvironmentObjects,
    cleanupEnvironmentObjects,
  };
}
