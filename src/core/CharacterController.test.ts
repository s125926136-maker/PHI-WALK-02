import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CharacterController, type CharacterInputState, type CharacterPhysicsConfig } from './CharacterController';
import { CollisionSystem } from './CollisionSystem';

describe('CharacterController Unit Tests', () => {
  let controller: CharacterController;
  let defaultConfig: CharacterPhysicsConfig;
  let defaultInput: CharacterInputState;

  beforeEach(() => {
    controller = new CharacterController(new CollisionSystem());
    
    defaultConfig = {
      gravityEnabled: true,
      collisionEnabled: true,
      eyeHeight: 1.65,
      bodyWidth: 0.6,
      moveSpeed: 5.0,
      jumpPower: 5.5,
      posture: 'standing'
    };

    defaultInput = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      shift: false
    };
  });

  // 1. Gravity Test
  describe('Gravity Test', () => {
    it('should pull player down and apply gravity acceleration over time', () => {
      // Position is initially at (0, 1.65, 0). Let's set it high in the air.
      controller.setPosition(0, 10, 0);
      
      // First update with delta time = 0.1s
      // Since it is above floor height (0), gravity should accelerate downwards
      controller.update(0.1, defaultInput, defaultConfig, []);

      // Gravity: v_y = v_y0 - 9.8 * dt = 0 - 0.98 = -0.98 m/s
      // Position: y = y0 + v_y * dt = 10 + (-0.98) * 0.1 = 9.902 m
      expect(controller.velocity.y).toBeCloseTo(-0.98, 4);
      expect(controller.position.y).toBeCloseTo(9.902, 4);
      expect(controller.grounded).toBe(false);
    });
  });

  // 2. Jump Test
  describe('Jump Test', () => {
    it('should jump and apply jumpPower to velocity.y when grounded', () => {
      // Grounded is initially true (default height is 1.65, floor is 0).
      // Let's set player position to floor level so they are grounded.
      controller.setPosition(0, 0, 0);
      
      // Update once to set grounded state (y <= 0 snaps to 0 and sets grounded = true)
      controller.update(0.1, defaultInput, defaultConfig, []);
      expect(controller.grounded).toBe(true);
      expect(controller.velocity.y).toBe(0);

      // Trigger a jump input
      const jumpInput = { ...defaultInput, jump: true };
      controller.update(0.1, jumpInput, defaultConfig, []);

      // Jump should set velocity.y directly to jumpPower (5.5) before resolving gravity
      // Then gravity reduces it: 5.5 - 9.8 * 0.1 = 4.52 m/s
      // Position y: 0 + 4.52 * 0.1 = 0.452 m
      expect(controller.velocity.y).toBeCloseTo(4.52, 4);
      expect(controller.position.y).toBeCloseTo(0.452, 4);
      expect(controller.grounded).toBe(false);
    });

    it('should NOT jump when not grounded', () => {
      controller.setPosition(0, 10, 0);
      controller.update(0.1, defaultInput, defaultConfig, []); // sets grounded = false
      expect(controller.grounded).toBe(false);

      const jumpInput = { ...defaultInput, jump: true };
      const preJumpYVelocity = controller.velocity.y; // -0.98
      
      controller.update(0.1, jumpInput, defaultConfig, []);
      // Should continue falling naturally without jump trigger
      expect(controller.velocity.y).toBeCloseTo(preJumpYVelocity - 9.8 * 0.1, 4);
    });
  });

  // 3. Floor Snap Test
  describe('Floor Snap Test', () => {
    it('should snap to floorHeight and reset vertical velocity when player falls below it', () => {
      controller.setPosition(0, 0.05, 0);
      controller.update(0.1, defaultInput, defaultConfig, []); // position becomes y <= 0
      
      expect(controller.position.y).toBe(0); // floorHeight
      expect(controller.velocity.y).toBe(0);
      expect(controller.grounded).toBe(true);
    });

    it('should smoothly snap (lerp) to floor height when gravity is disabled', () => {
      const gravityDisabledConfig = { ...defaultConfig, gravityEnabled: false };
      controller.setPosition(0, 5, 0);
      
      // When gravity is disabled: lerp(y, floorHeight, 15 * dt)
      // lerp(5, 0, 15 * 0.01) = 5 * (1 - 0.15) = 4.25
      controller.update(0.01, defaultInput, gravityDisabledConfig, []);
      
      expect(controller.position.y).toBeCloseTo(4.25, 4);
      expect(controller.velocity.y).toBe(0);
      expect(controller.grounded).toBe(true);
    });
  });

  // 4. Camera Look Test
  describe('Camera Look Test', () => {
    it('should adjust yaw and pitch from mouse movement and clamp pitch correctly', () => {
      expect(controller.cameraYaw).toBe(0);
      expect(controller.cameraPitch).toBe(0);

      // handleLook deltaX = 100, deltaY = 50, sensitivity = 0.01
      controller.handleLook(100, 50, 0.01);
      
      // cameraYaw: 0 - 100 * 0.01 = -1
      // cameraPitch: 0 - 50 * 0.01 = -0.5
      expect(controller.cameraYaw).toBeCloseTo(-1, 4);
      expect(controller.cameraPitch).toBeCloseTo(-0.5, 4);

      // Test extreme vertical look to verify clamping limit (Math.PI / 2.05 ~ 1.532)
      controller.handleLook(0, 500, 0.01); // deltaY = 500 -> total pitch change would be -5.5
      expect(controller.cameraPitch).toBeCloseTo(-Math.PI / 2.05, 4);
    });

    it('should set camera rotation directly and clamp pitch using specific methods', () => {
      controller.setCameraRotation(1.5, -0.8);
      expect(controller.cameraYaw).toBe(1.5);
      expect(controller.cameraPitch).toBe(-0.8);

      controller.clampPitch(-0.25, 0.55);
      expect(controller.cameraPitch).toBe(-0.25); // clamped to min

      controller.setCameraRotation(1.5, 1.2);
      controller.clampPitch(-0.25, 0.55);
      expect(controller.cameraPitch).toBe(0.55); // clamped to max
    });
  });

  // 5. EyeHeight Test
  describe('EyeHeight Test', () => {
    it('should interpolate eye height towards target eye height over time based on posture', () => {
      // Default: base eye height is 1.65
      expect(controller.currentEyeHeight).toBe(1.65);

      // 1) Standing (target = 1.65)
      controller.updateEyeHeight(0.1, 'standing', 1.65);
      expect(controller.currentEyeHeight).toBe(1.65);

      // 2) Crouching (target = 1.65 * 0.72 = 1.188)
      // lerp(1.65, 1.188, 10 * 0.1) -> lerp(1.65, 1.188, 1.0) = 1.188
      controller.updateEyeHeight(0.1, 'crouching', 1.65);
      expect(controller.currentEyeHeight).toBeCloseTo(1.188, 4);

      // Reset to 1.65 for next sub-test
      controller.updateEyeHeight(1.0, 'standing', 1.65);

      // 3) Sitting (target = 1.65 * 0.55 = 0.9075)
      // lerp(1.65, 0.9075, 10 * 0.1) -> lerp(1.65, 0.9075, 1.0) = 0.9075
      controller.updateEyeHeight(0.1, 'sitting', 1.65);
      expect(controller.currentEyeHeight).toBeCloseTo(0.9075, 4);
    });
  });

  // 6. Position Translation Test
  describe('Position Translation Test', () => {
    it('should set, translate, and perform horizontal movement of character position', () => {
      controller.setPosition(1, 2, 3);
      expect(controller.position.x).toBe(1);
      expect(controller.position.y).toBe(2);
      expect(controller.position.z).toBe(3);

      controller.setPosition(new THREE.Vector3(5, 6, 7));
      expect(controller.position.x).toBe(5);
      expect(controller.position.y).toBe(6);
      expect(controller.position.z).toBe(7);

      controller.translate(new THREE.Vector3(1, -1, 2));
      expect(controller.position.x).toBe(6);
      expect(controller.position.y).toBe(5);
      expect(controller.position.z).toBe(9);

      controller.addHorizontalMovement(2, -3, 0.5);
      expect(controller.position.x).toBe(7); // 6 + 2 * 0.5
      expect(controller.position.y).toBe(5); // unchanged
      expect(controller.position.z).toBe(7.5); // 9 - 3 * 0.5
    });
  });

  // 7. Velocity Damping Test
  describe('Velocity Damping Test', () => {
    it('should apply friction, acceleration, and cancel velocity components along normal correctly', () => {
      // Reset velocity first
      controller.resetVelocity();
      expect(controller.velocity.lengthSq()).toBe(0);

      // Apply initial moveVector to accelerate
      // moveVector = (1, 0, 0), finalSpeed = 10, damping = 2, dt = 0.1
      const moveVector = new THREE.Vector3(1, 0, 0);
      controller.applyFrictionAndAcceleration(moveVector, 10, 2, 0.1);
      // velocity.x = 0 - 0 * 2 * 0.1 + 1 * 10 * 2 * 0.1 = 2
      expect(controller.velocity.x).toBeCloseTo(2, 4);
      expect(controller.velocity.z).toBe(0);

      // Now apply just friction (moveVector is zero)
      controller.applyFrictionAndAcceleration(new THREE.Vector3(), 10, 2, 0.1);
      // velocity.x = 2 - 2 * 2 * 0.1 = 1.6
      expect(controller.velocity.x).toBeCloseTo(1.6, 4);

      // Project normal cancellation
      // Set velocity to (4, 0, 3)
      controller.applyFrictionAndAcceleration(new THREE.Vector3(1, 0, 0), 12, 1, 1); // direct update
      controller.resetVelocity();
      
      // Let's directly test cancelVelocityAlongNormal
      // We need a way to set velocity, let's use applyFrictionAndAcceleration with dt=1, damping=1, moveVector=(5, 0, 0), finalSpeed=1
      controller.applyFrictionAndAcceleration(new THREE.Vector3(5, 0, 0), 1, 1, 1); // gets x=5
      expect(controller.velocity.x).toBeCloseTo(5, 4);

      // Cancel positive x velocity with a normal pointing left (-1, 0, 0) -> dot = 5 * -1 = -5 (should not cancel because dot <= 0)
      controller.cancelVelocityAlongNormal(new THREE.Vector3(-1, 0, 0));
      expect(controller.velocity.x).toBeCloseTo(5, 4);

      // Cancel positive x velocity with normal pointing right (1, 0, 0) -> dot = 5 * 1 = 5 > 0 -> cancels
      controller.cancelVelocityAlongNormal(new THREE.Vector3(1, 0, 0));
      expect(controller.velocity.x).toBeCloseTo(0, 4);
    });
  });
});
