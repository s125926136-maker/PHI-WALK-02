/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class ThreeSceneManager {
  public scene: THREE.Scene | null = null;
  public camera: THREE.PerspectiveCamera | null = null;
  public renderer: THREE.WebGLRenderer | null = null;
  public ambientLight: THREE.AmbientLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;
  public dirLight: THREE.DirectionalLight | null = null;
  public currentModelGroup: THREE.Group | null = null;
  public groundMesh: THREE.Mesh | null = null;

  // Loaders
  public gltfLoader: GLTFLoader;
  public dracoLoader: DRACOLoader;
  public textureLoader: THREE.TextureLoader;
  public objLoader: OBJLoader;
  public fbxLoader: FBXLoader;

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.dracoLoader = new DRACOLoader();
    // Use a standard public CDN decoder path
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    
    this.objLoader = new OBJLoader();
    this.fbxLoader = new FBXLoader();
  }

  /**
   * Initialize Scene, Camera, Renderer, Ground, and Lights
   */
  public initialize(canvas: HTMLCanvasElement, container: HTMLDivElement) {
    // 1. Create Scene & Background (Sky)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb4d2ff); // Blender default Sky Color

    // 2. Create Ground Plane
    const groundGeom = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x5a7850, // Matte light grass green
      roughness: 1.0,
      metalness: 0.0,
      flatShading: false,
      transparent: false,
      opacity: 1.0,
      depthTest: true,
      depthWrite: true,
    });
    this.groundMesh = new THREE.Mesh(groundGeom, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.01; // Avoid z-fighting with model floors
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // 3. Add Ambient Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(this.ambientLight);

    // 4. Add Hemisphere Lighting (Sky/Ground gradient)
    this.hemiLight = new THREE.HemisphereLight(0xb4d2ff, 0x5a7850, 0.45);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    // 5. Add Directional Lighting (Sun / ShadowMap)
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    this.dirLight.position.set(10, 15, 8);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.camera.left = -100;
    this.dirLight.shadow.camera.right = 100;
    this.dirLight.shadow.camera.top = 100;
    this.dirLight.shadow.camera.bottom = -100;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 2000;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 6. Set up Camera
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 3000);
    this.scene.add(this.camera);

    // 7. Set up WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      logarithmicDepthBuffer: false,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Set initial size
    const rect = container.getBoundingClientRect();
    this.resize(rect.width || 1, rect.height || 1);
  }

  /**
   * Handle resizing of the WebGL renderer
   */
  public resize(width: number, height: number) {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      this.renderer.setSize(width, height, false);
    }
  }

  /**
   * Environment management
   */
  public setEnvironment(texture: THREE.Texture | null) {
    if (this.scene) {
      this.scene.environment = texture;
    }
  }

  /**
   * Sky background management
   */
  public setSkyColor(color: THREE.Color) {
    if (this.scene) {
      this.scene.background = color;
    }
  }

  /**
   * Fog management
   */
  public setFog(color: THREE.Color | string | number, near?: number, far?: number) {
    if (this.scene) {
      this.scene.fog = new THREE.Fog(color, near ?? 1, far ?? 1000);
    }
  }

  public clearFog() {
    if (this.scene) {
      this.scene.fog = null;
    }
  }

  /**
   * Remove and clean up the current model group
   */
  public unloadModel() {
    if (this.scene && this.currentModelGroup) {
      this.scene.remove(this.currentModelGroup);
      this.currentModelGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this.currentModelGroup = null;
    }
  }

  /**
   * Dispose of all Three.js resources
   */
  public dispose() {
    this.unloadModel();

    if (this.scene) {
      if (this.groundMesh) {
        this.scene.remove(this.groundMesh);
        if (this.groundMesh.geometry) {
          this.groundMesh.geometry.dispose();
        }
        if (this.groundMesh.material) {
          if (Array.isArray(this.groundMesh.material)) {
            this.groundMesh.material.forEach((mat) => mat.dispose());
          } else {
            this.groundMesh.material.dispose();
          }
        }
        this.groundMesh = null;
      }

      if (this.ambientLight) {
        this.scene.remove(this.ambientLight);
        this.ambientLight = null;
      }

      if (this.hemiLight) {
        this.scene.remove(this.hemiLight);
        this.hemiLight = null;
      }

      if (this.dirLight) {
        this.scene.remove(this.dirLight.target);
        this.scene.remove(this.dirLight);
        this.dirLight = null;
      }

      if (this.camera) {
        this.scene.remove(this.camera);
        this.camera = null;
      }

      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.dracoLoader) {
      this.dracoLoader.dispose();
    }
  }
}
