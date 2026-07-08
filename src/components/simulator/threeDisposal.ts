import * as THREE from 'three';

export function disposeSimulatorObject3D(object: THREE.Object3D | null): void {
  if (!object) return;

  object.parent?.remove(object);

  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();
  const textureKeys = [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
  ];

  const disposeMaterial = (material: THREE.Material) => {
    if (disposedMaterials.has(material)) return;

    for (const key of textureKeys) {
      const texture = (material as unknown as Record<string, unknown>)[key];
      if (texture instanceof THREE.Texture && !disposedTextures.has(texture)) {
        texture.dispose();
        disposedTextures.add(texture);
      }
    }

    material.dispose();
    disposedMaterials.add(material);
  };

  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Sprite) {
      if (child.geometry && !disposedGeometries.has(child.geometry)) {
        child.geometry.dispose();
        disposedGeometries.add(child.geometry);
      }

      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else if (child.material) {
        disposeMaterial(child.material);
      }
    }
  });
}
