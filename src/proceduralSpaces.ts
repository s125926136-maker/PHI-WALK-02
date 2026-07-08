/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

// Create a materials helper to give a beautiful, clean architectural finish
const createArchitecturalMaterials = () => {
  return {
    wall: new THREE.MeshStandardMaterial({
      color: 0xf5f5f4, // Warm stone off-white
      roughness: 0.85,
      metalness: 0.05,
    }),
    wallAccent: new THREE.MeshStandardMaterial({
      color: 0x44403c, // Deep charcoal slate accent
      roughness: 0.7,
    }),
    floorWood: new THREE.MeshStandardMaterial({
      color: 0xcca47c, // Warm white oak wood
      roughness: 0.6,
    }),
    floorTile: new THREE.MeshStandardMaterial({
      color: 0xd6d3d1, // Concrete tile light grey
      roughness: 0.5,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: 0xfafaf9, // Soft plaster white
      roughness: 0.9,
    }),
    furnitureWood: new THREE.MeshStandardMaterial({
      color: 0x78350f, // Teak wood
      roughness: 0.5,
    }),
    furnitureFabric: new THREE.MeshStandardMaterial({
      color: 0x78716c, // Soft brown-grey fabric
      roughness: 0.9,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.3,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.3,
      metalness: 0.8,
    }),
  };
};

const disposeObjectResources = (object: THREE.Object3D): void => {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  object.traverse((child) => {
    const disposable = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    if (disposable.geometry && !disposedGeometries.has(disposable.geometry)) {
      disposedGeometries.add(disposable.geometry);
    }

    const materials = Array.isArray(disposable.material)
      ? disposable.material
      : disposable.material
        ? [disposable.material]
        : [];

    materials.forEach((material) => {
      if (!disposedMaterials.has(material)) {
        disposedMaterials.add(material);
      }

      Object.keys(material).forEach((key) => {
        const value = (material as unknown as Record<string, unknown>)[key];
        if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
          disposedTextures.add(value);
        }
      });
    });
  });

  disposedTextures.forEach((texture) => texture.dispose());
  disposedMaterials.forEach((material) => material.dispose());
  disposedGeometries.forEach((geometry) => geometry.dispose());
};

export const buildApartment = (scene: THREE.Scene): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'apartment';
  const mats = createArchitecturalMaterials();

  // Helper to add tagged items
  const addMesh = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    type: 'floor' | 'wall' | 'ceiling',
    room: string,
    rotation: [number, number, number] = [0, 0, 0]
  ) => {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, roomName: room };
    group.add(mesh);
    return mesh;
  };

  const height = 2.8; // Ceiling height in meters

  // 1. FLOORS (We represent floors as slightly thick boxes so raycasting is extremely robust)
  // Living Room: 6m x 6m, centered at (0, 0) -> x: -3 to 3, z: -3 to 3
  addMesh(new THREE.BoxGeometry(6, 0.1, 6), mats.floorWood, [0, -0.05, 0], 'floor', 'Living Room (客廳)');

  // Corridor: 0.9m wide x 4m long -> x: -0.45 to 0.45, z: 3 to 7
  addMesh(new THREE.BoxGeometry(0.9, 0.1, 4), mats.floorWood, [0, -0.05, 5], 'floor', 'Corridor (走廊 - 0.9m)');

  // Bedroom: 4m x 4m -> x: -2 to 2, z: 7 to 11
  addMesh(new THREE.BoxGeometry(4, 0.1, 4), mats.floorWood, [0, -0.05, 9], 'floor', 'Bedroom (臥室)');

  // Kitchen: 3.5m x 4m -> x: 3 to 6.5, z: -3 to 1
  addMesh(new THREE.BoxGeometry(3.5, 0.1, 4), mats.floorTile, [4.75, -0.05, -1], 'floor', 'Kitchen / Dining (廚房與餐廳)');

  // Bathroom: 2.2m x 2.2m -> x: -4.1 to -1.9, z: 3 to 5.2 (Doorway 0.75m wide)
  addMesh(new THREE.BoxGeometry(2.2, 0.1, 2.2), mats.floorTile, [-3.1, -0.05, 4.1], 'floor', 'Bathroom (浴室 - 窄門體驗)');


  // 2. CEILINGS
  addMesh(new THREE.BoxGeometry(6, 0.1, 6), mats.ceiling, [0, height + 0.05, 0], 'ceiling', 'Living Room (客廳)');
  addMesh(new THREE.BoxGeometry(0.9, 0.1, 4), mats.ceiling, [0, height + 0.05, 5], 'ceiling', 'Corridor (走廊 - 0.9m)');
  addMesh(new THREE.BoxGeometry(4, 0.1, 4), mats.ceiling, [0, height + 0.05, 9], 'ceiling', 'Bedroom (臥室)');
  addMesh(new THREE.BoxGeometry(3.5, 0.1, 4), mats.ceiling, [4.75, height + 0.05, -1], 'ceiling', 'Kitchen / Dining (廚房與餐廳)');
  addMesh(new THREE.BoxGeometry(2.2, 0.1, 2.2), mats.ceiling, [-3.1, height + 0.05, 4.1], 'ceiling', 'Bathroom (浴室 - 窄門體驗)');


  // 3. WALLS (Thick wall blocks to test spatial oppression and collision)
  const wallThick = 0.2;

  // Living Room Outer Walls
  addMesh(new THREE.BoxGeometry(wallThick, height, 6), mats.wall, [-3, height / 2, 0], 'wall', 'Living Room (客廳)'); // West wall
  addMesh(new THREE.BoxGeometry(6, height, wallThick), mats.wall, [0, height / 2, -3], 'wall', 'Living Room (客廳)'); // North wall

  // Partition Wall between Living Room & Kitchen (with a 1.2m opening)
  addMesh(new THREE.BoxGeometry(wallThick, height, 1.8), mats.wall, [3, height / 2, -2.1], 'wall', 'Living Room (客廳)');
  addMesh(new THREE.BoxGeometry(wallThick, height, 3.0), mats.wall, [3, height / 2, 1.5], 'wall', 'Living Room (客廳)'); // Leaves 1.2m gap at z = -0.6 to 0.6

  // Kitchen Outer Walls
  addMesh(new THREE.BoxGeometry(3.5, height, wallThick), mats.wall, [4.75, height / 2, -3], 'wall', 'Kitchen / Dining (廚房與餐廳)'); // North
  addMesh(new THREE.BoxGeometry(wallThick, height, 4), mats.wall, [6.5, height / 2, -1], 'wall', 'Kitchen / Dining (廚房與餐廳)'); // East
  addMesh(new THREE.BoxGeometry(3.5, height, wallThick), mats.wall, [4.75, height / 2, 1], 'wall', 'Kitchen / Dining (廚房與餐廳)'); // South

  // Corridor Walls (creating the narrow 0.9m walkway)
  // Left side wall of corridor (bordering Bathroom and empty space)
  addMesh(new THREE.BoxGeometry(wallThick, height, 1.8), mats.wall, [-0.45, height / 2, 6.1], 'wall', 'Corridor (走廊 - 0.9m)'); // Top section
  // Right side wall of corridor
  addMesh(new THREE.BoxGeometry(wallThick, height, 4), mats.wall, [0.45, height / 2, 5], 'wall', 'Corridor (走廊 - 0.9m)');

  // Bathroom Walls (Outer & Partition with a 0.75m wide door)
  addMesh(new THREE.BoxGeometry(2.2, height, wallThick), mats.wall, [-3.1, height / 2, 3], 'wall', 'Bathroom (浴室 - 窄門體驗)'); // South
  addMesh(new THREE.BoxGeometry(wallThick, height, 2.2), mats.wall, [-4.2, height / 2, 4.1], 'wall', 'Bathroom (浴室 - 窄門體驗)'); // West
  // Partition wall between corridor & bathroom:
  // Bathroom goes from z = 3 to 5.2. Right wall is at x = -2.0.
  // Doorway of 0.75m is placed between z = 3.2 and 3.95.
  addMesh(new THREE.BoxGeometry(wallThick, height, 0.2), mats.wall, [-2.0, height / 2, 3.1], 'wall', 'Bathroom (浴室 - 窄門體驗)');
  addMesh(new THREE.BoxGeometry(wallThick, height, 1.25), mats.wall, [-2.0, height / 2, 4.575], 'wall', 'Bathroom (浴室 - 窄門體驗)');

  // Bedroom Walls (4m x 4m, from z: 7 to 11)
  addMesh(new THREE.BoxGeometry(4, height, wallThick), mats.wall, [0, height / 2, 11], 'wall', 'Bedroom (臥室)'); // North
  addMesh(new THREE.BoxGeometry(wallThick, height, 4), mats.wall, [-2, height / 2, 9], 'wall', 'Bedroom (臥室)'); // West
  addMesh(new THREE.BoxGeometry(wallThick, height, 4), mats.wall, [2, height / 2, 9], 'wall', 'Bedroom (臥室)'); // East
  // Partition wall between bedroom & corridor (z = 7)
  // Corridor is x: -0.45 to 0.45. Doorway of 0.9m is between x: -0.45 and 0.45 (at the end of corridor)
  addMesh(new THREE.BoxGeometry(1.55, height, wallThick), mats.wall, [-1.225, height / 2, 7], 'wall', 'Bedroom (臥室)'); // Left partition
  addMesh(new THREE.BoxGeometry(1.55, height, wallThick), mats.wall, [1.225, height / 2, 7], 'wall', 'Bedroom (臥室)'); // Right partition


  // 4. FURNITURE (Beautifully proportioned blocks to test spatial restrictions)
  // Living Room Sofa Set
  // Main sofa: 2.2m wide x 0.9m deep x 0.7m high
  const sofaBase = addMesh(new THREE.BoxGeometry(2.2, 0.4, 0.9), mats.furnitureFabric, [-1.5, 0.2, -1.8], 'wall', 'Living Room (客廳)');
  addMesh(new THREE.BoxGeometry(2.2, 0.3, 0.15), mats.furnitureFabric, [-1.5, 0.55, -2.25], 'wall', 'Living Room (客廳)'); // Backrest
  addMesh(new THREE.BoxGeometry(0.15, 0.2, 0.9), mats.furnitureFabric, [-2.6, 0.5, -1.8], 'wall', 'Living Room (客廳)'); // Left armrest
  addMesh(new THREE.BoxGeometry(0.15, 0.2, 0.9), mats.furnitureFabric, [-0.4, 0.5, -1.8], 'wall', 'Living Room (客廳)'); // Right armrest

  // Coffee Table: 1.2m x 0.6m x 0.4m
  addMesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), mats.furnitureWood, [-1.5, 0.2, -0.6], 'wall', 'Living Room (客廳)');

  // TV Console: 1.8m x 0.4m x 0.5m
  addMesh(new THREE.BoxGeometry(1.8, 0.5, 0.45), mats.wallAccent, [-1.5, 0.25, 2.5], 'wall', 'Living Room (客廳)');

  // Dining Table: 1.4m x 0.8m x 0.75m
  addMesh(new THREE.BoxGeometry(1.4, 0.75, 0.8), mats.furnitureWood, [4.75, 0.375, -1.5], 'wall', 'Kitchen / Dining (廚房與餐廳)');
  // Chairs (4 chairs around table)
  addMesh(new THREE.BoxGeometry(0.4, 0.45, 0.4), mats.metal, [4.1, 0.225, -1.5], 'wall', 'Kitchen / Dining (廚房與餐廳)');
  addMesh(new THREE.BoxGeometry(0.4, 0.45, 0.4), mats.metal, [5.4, 0.225, -1.5], 'wall', 'Kitchen / Dining (廚房與餐廳)');

  // Kitchen Counter (L-shape)
  addMesh(new THREE.BoxGeometry(2.5, 0.85, 0.6), mats.floorTile, [5.25, 0.425, 0.7], 'wall', 'Kitchen / Dining (廚房與餐廳)'); // Back counter

  // Bedroom Bed: 1.6m wide x 2.0m long x 0.45m high
  // Centered in bedroom (which is x: -2 to 2, z: 7 to 11) -> Bed placed at x: 0, z: 9.5
  addMesh(new THREE.BoxGeometry(1.6, 0.45, 2.0), mats.furnitureWood, [0.8, 0.225, 9.5], 'wall', 'Bedroom (臥室)');
  addMesh(new THREE.BoxGeometry(1.6, 0.45, 1.9), mats.ceiling, [0.8, 0.25, 9.45], 'wall', 'Bedroom (臥室)'); // Mattress

  // Bedroom Wardrobe: 1.5m wide x 0.6m deep x 2.1m high
  addMesh(new THREE.BoxGeometry(1.5, 2.1, 0.6), mats.furnitureWood, [-1.2, 1.05, 8.5], 'wall', 'Bedroom (臥室)');

  // Bathroom Sink Counter
  addMesh(new THREE.BoxGeometry(0.6, 0.8, 0.8), mats.wallAccent, [-3.1, 0.4, 4.8], 'wall', 'Bathroom (浴室 - 窄門體驗)');


  scene.add(group);
  return group;
};

export const buildGallery = (scene: THREE.Scene): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'gallery';
  const mats = createArchitecturalMaterials();

  const addMesh = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    type: 'floor' | 'wall' | 'ceiling',
    room: string,
    rotation: [number, number, number] = [0, 0, 0]
  ) => {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, roomName: room };
    group.add(mesh);
    return mesh;
  };

  const highCeiling = 6.0; // 6 meters
  const lowCeiling = 2.8;  // 2.8 meters under mezzanine

  // 1. MAIN FLOOR (15m x 20m centered at (0, 0)) -> x: -7.5 to 7.5, z: -10 to 10
  addMesh(new THREE.BoxGeometry(15, 0.1, 20), mats.floorTile, [0, -0.05, 0], 'floor', 'Double-Height Exhibition Hall (挑高展覽大廳)');

  // 2. MEZZANINE FLOOR (15m wide x 8m deep, covering z: 2 to 10 at height 3.0m)
  addMesh(new THREE.BoxGeometry(15, 0.15, 8), mats.floorWood, [0, 3.0, 6], 'floor', 'Mezzanine Platform (夾層平台 - 3.0m高)');

  // 3. CEILINGS
  // High Ceiling over open area (z: -10 to 2) -> 15m x 12m
  addMesh(new THREE.BoxGeometry(15, 0.1, 12), mats.ceiling, [0, highCeiling + 0.05, -4], 'ceiling', 'Exhibition Hall Ceiling (挑高6.0m)');
  // Ceiling under Mezzanine is the bottom of the mezzanine floor (already added as floor for Mezzanine at height 3.0m!)
  // Mezzanine Ceiling (z: 2 to 10 at height 6.0m)
  addMesh(new THREE.BoxGeometry(15, 0.1, 8), mats.ceiling, [0, highCeiling + 0.05, 6], 'ceiling', 'Mezzanine Ceiling (夾層上方天花板)');

  // 4. OUTER WALLS (6m high all around)
  const wallThick = 0.3;
  addMesh(new THREE.BoxGeometry(wallThick, highCeiling, 20), mats.wall, [-7.5, highCeiling / 2, 0], 'wall', 'Gallery Hall (展覽廳)'); // West
  addMesh(new THREE.BoxGeometry(wallThick, highCeiling, 20), mats.wall, [7.5, highCeiling / 2, 0], 'wall', 'Gallery Hall (展覽廳)'); // East
  addMesh(new THREE.BoxGeometry(15, highCeiling, wallThick), mats.wall, [0, highCeiling / 2, -10], 'wall', 'Gallery Hall (展覽廳)'); // North
  addMesh(new THREE.BoxGeometry(15, highCeiling, wallThick), mats.wall, [0, highCeiling / 2, 10], 'wall', 'Gallery Hall (展覽廳)'); // South

  // 5. COLUMNS (Supporting the mezzanine, creating structural walk-around blocks)
  // Two large rectangular pillars at the edge of the mezzanine (z = 2)
  addMesh(new THREE.BoxGeometry(0.8, 3.0, 0.8), mats.wallAccent, [-4.5, 1.5, 2], 'wall', 'Exhibition Column (結構柱)');
  addMesh(new THREE.BoxGeometry(0.8, 3.0, 0.8), mats.wallAccent, [4.5, 1.5, 2], 'wall', 'Exhibition Column (結構柱)');

  // 6. PARTITION SCREEN WALLS (To experience spatial pathing and enclosure)
  // A large central partition wall (diagonal or off-center) to guide movement
  addMesh(new THREE.BoxGeometry(4.5, 3.5, 0.2), mats.wall, [-2.0, 1.75, -4.0], 'wall', 'Exhibition Partition (展出隔牆)');
  addMesh(new THREE.BoxGeometry(0.2, 3.5, 5.0), mats.wallAccent, [3.0, 1.75, -2.0], 'wall', 'Exhibition Partition (展出隔牆)');

  // Mezzanine guard rail (solid barrier 1.1m high to avoid falling, and to feel real enclosure)
  addMesh(new THREE.BoxGeometry(15, 1.1, 0.1), mats.wallAccent, [0, 3.55, 2.0], 'wall', 'Mezzanine Guard Rail (夾層護欄)');

  // 7. WALKABLE STAIRCASE (Each step is exactly 0.25m deep, 0.15m high, and 1.5m wide)
  // Reaches from floor y=0 to Mezzanine floor y=3.0. Number of steps = 3.0 / 0.15 = 20 steps.
  // We place the stairs running along the West wall from z = 6 to z = 1.
  const stepWidth = 1.5;
  const stepHeight = 0.15;
  const stepDepth = 0.25;
  const stairStartX = -6.5; // near west wall
  const stairStartZ = 8.0; // starts deep

  for (let i = 0; i < 20; i++) {
    const sH = stepHeight * (i + 1);
    const geom = new THREE.BoxGeometry(stepWidth, sH, stepDepth);
    // Align step box so its top surface sits at stepHeight * i
    const sY = sH / 2;
    const sZ = stairStartZ - (i * stepDepth);
    addMesh(geom, mats.metal, [stairStartX, sY, sZ], 'floor', 'Staircase Step (樓梯階步)');
  }

  // 8. EXHIBITS / SCULPTURES (Acting as furniture)
  // Large plinth in open space: 2m x 2m x 1m
  addMesh(new THREE.BoxGeometry(2, 1.0, 2), mats.wallAccent, [0, 0.5, -6], 'wall', 'Exhibition Plinth (展示基座)');
  // A vertical sculpture pillar: 0.6m x 0.6m x 3.0m
  addMesh(new THREE.BoxGeometry(0.6, 3.0, 0.6), mats.metal, [0, 1.5, -6], 'wall', 'Center Exhibit (中央展品)');

  // Plinth under mezzanine: 1.2m x 1.2m x 0.8m
  addMesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), mats.furnitureWood, [4.5, 0.4, 6], 'wall', 'Sub-Mezzanine Gallery Box (夾層下展品)');


  scene.add(group);
  return group;
};

// Procedural Interactive Accessibility Corridor
// Allows live resizing of ceiling height and corridor width via parameters.
export const buildInteractiveCorridor = (
  scene: THREE.Scene,
  width: number = 1.2,
  ceilingHeight: number = 2.4
): THREE.Group => {
  // Remove any previous corridor if it exists in scene
  const existing = scene.getObjectByName('corridor');
  if (existing) {
    disposeObjectResources(existing);
    scene.remove(existing);
  }

  const group = new THREE.Group();
  group.name = 'corridor';
  const mats = createArchitecturalMaterials();

  const addMesh = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    type: 'floor' | 'wall' | 'ceiling',
    room: string
  ) => {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, roomName: room };
    group.add(mesh);
    return mesh;
  };

  const corridorLength = 12.0;

  // 1. FLOOR (length: 12m, width: custom width plus extra for wall placement)
  // We make floor slightly wider so boundaries are clean
  addMesh(new THREE.BoxGeometry(width, 0.1, corridorLength), mats.floorWood, [0, -0.05, 0], 'floor', 'Testing Corridor (走道感知體驗區)');

  // 2. CEILING (moves up and down based on parameter)
  addMesh(new THREE.BoxGeometry(width, 0.1, corridorLength), mats.ceiling, [0, ceilingHeight + 0.05, 0], 'ceiling', 'Testing Corridor (走道感知體驗區)');

  // 3. LEFT & RIGHT WALLS (re-positioned dynamically based on width)
  const wallThick = 0.25;
  const leftX = -width / 2 - wallThick / 2;
  const rightX = width / 2 + wallThick / 2;

  // Left Wall
  addMesh(new THREE.BoxGeometry(wallThick, ceilingHeight, corridorLength), mats.wall, [leftX, ceilingHeight / 2, 0], 'wall', 'Testing Corridor Left Wall (左側壁)');

  // Right Wall
  addMesh(new THREE.BoxGeometry(wallThick, ceilingHeight, corridorLength), mats.wall, [rightX, ceilingHeight / 2, 0], 'wall', 'Testing Corridor Right Wall (右側壁)');

  // 4. CLOSING END WALLS (to keep user contained in test corridor, but with entrance/exit gaps)
  // Far North Wall (z = -6)
  addMesh(new THREE.BoxGeometry(width, ceilingHeight, wallThick), mats.wall, [0, ceilingHeight / 2, -corridorLength / 2 - wallThick / 2], 'wall', 'End Wall (端牆)');
  // South Wall (z = 6)
  addMesh(new THREE.BoxGeometry(width, ceilingHeight, wallThick), mats.wall, [0, ceilingHeight / 2, corridorLength / 2 + wallThick / 2], 'wall', 'End Wall (端牆)');

  // 5. PROTRUDING FURNITURE/RESTRICTIONS (to test narrow navigation and wheelchair turning radius)
  // A narrow console table sticking out 0.35m from the right wall, placed at z = -2.0
  const consoleWidth = 0.35;
  const consoleHeight = 0.75;
  const consoleLength = 1.2;
  const consoleX = width / 2 - consoleWidth / 2;
  addMesh(
    new THREE.BoxGeometry(consoleWidth, consoleHeight, consoleLength),
    mats.furnitureWood,
    [consoleX, consoleHeight / 2, -2.0],
    'wall',
    'Wall-Mounted Console (突出壁面矮櫃 - 阻礙動線測試)'
  );

  // A column-like structural block sticking out 0.25m from the left wall at z = 2.0
  const pierWidth = 0.25;
  const pierLength = 0.8;
  const pierX = -width / 2 + pierWidth / 2;
  addMesh(
    new THREE.BoxGeometry(pierWidth, ceilingHeight, pierLength),
    mats.wallAccent,
    [pierX, ceilingHeight / 2, 2.0],
    'wall',
    'Structural Wall Pier (壁柱突出物)'
  );


  scene.add(group);
  return group;
};
