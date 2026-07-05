// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { engineServices, EngineServices } from './EngineServices';

describe('EngineServices Unit Tests', () => {
  it('should instantiate all aggregated services', () => {
    const services = new EngineServices();
    expect(services.time).toBeDefined();
    expect(services.logger).toBeDefined();
    expect(services.performance).toBeDefined();
    expect(services.events).toBeDefined();
    expect(services.random).toBeDefined();
    expect(services.config).toBeDefined();
  });

  it('should expose a global engineServices instance', () => {
    expect(engineServices).toBeDefined();
    expect(engineServices.time).toBeDefined();
  });

  describe('TimeService', () => {
    it('should return numeric timestamps for now() and epoch()', () => {
      const now = engineServices.time.now();
      const epoch = engineServices.time.epoch();
      expect(typeof now).toBe('number');
      expect(typeof epoch).toBe('number');
      expect(now).toBeGreaterThan(0);
      expect(epoch).toBeGreaterThan(0);
    });
  });

  describe('LoggerService', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should route log, warn, and error to standard console methods', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      engineServices.logger.log('test log', 123);
      engineServices.logger.warn('test warn');
      engineServices.logger.error('test error');

      expect(logSpy).toHaveBeenCalledWith('test log', 123);
      expect(warnSpy).toHaveBeenCalledWith('test warn');
      expect(errorSpy).toHaveBeenCalledWith('test error');
    });
  });

  describe('RandomService', () => {
    it('should return values within bounds', () => {
      const r = engineServices.random.random();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);

      const val = engineServices.random.range(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(20);

      const intVal = engineServices.random.intRange(5, 8);
      expect(intVal).toBeGreaterThanOrEqual(5);
      expect(intVal).toBeLessThanOrEqual(8);
      expect(Number.isInteger(intVal)).toBe(true);
    });
  });

  describe('ConfigService', () => {
    it('should allow setting initial configs, getting them, and fallback to defaults', () => {
      const config = new (engineServices.config.constructor as any)({
        gravity: 9.81,
        debug: true,
      });

      expect(config.has('gravity')).toBe(true);
      expect(config.get('gravity')).toBe(9.81);
      expect(config.has('debug')).toBe(true);
      expect(config.get('debug')).toBe(true);

      expect(config.has('unknown')).toBe(false);
      expect(config.get('unknown', 'fallback')).toBe('fallback');
    });
  });

  describe('EventService', () => {
    it('should publish and subscribe to events correctly', () => {
      const callback = vi.fn();
      const unsubscribe = engineServices.events.on('custom-test-event', callback);

      engineServices.events.emit('custom-test-event', 'data1', 100);
      expect(callback).toHaveBeenCalledWith('data1', 100);

      unsubscribe();
      callback.mockClear();

      engineServices.events.emit('custom-test-event', 'data2');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('PerformanceService', () => {
    it('should correctly interface with PerformanceProfiler and retrieve snapshots', () => {
      engineServices.performance.enable();
      expect(engineServices.performance.isEnabled()).toBe(true);

      engineServices.performance.begin('Character');
      engineServices.performance.end('Character');

      const metric = engineServices.performance.getMetric('Character');
      expect(metric).toBeDefined();
      expect(metric?.name).toBe('Character');
      expect(metric?.callCount).toBeGreaterThan(0);

      const snapshot = engineServices.performance.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.physicsTime).toBeDefined();
    });
  });
});
