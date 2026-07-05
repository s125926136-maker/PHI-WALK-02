/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ITimeService, TimeService } from './services/TimeService';
import { ILoggerService, LoggerService } from './services/LoggerService';
import { IPerformanceService, PerformanceService } from './services/PerformanceService';
import { IEventService, EventService } from './services/EventService';
import { IRandomService, RandomService } from './services/RandomService';
import { IConfigService, ConfigService } from './services/ConfigService';

export interface IEngineServices {
  time: ITimeService;
  logger: ILoggerService;
  performance: IPerformanceService;
  events: IEventService;
  random: IRandomService;
  config: IConfigService;
}

export class EngineServices implements IEngineServices {
  public readonly time: ITimeService;
  public readonly logger: ILoggerService;
  public readonly performance: IPerformanceService;
  public readonly events: IEventService;
  public readonly random: IRandomService;
  public readonly config: IConfigService;

  constructor() {
    this.time = new TimeService();
    this.logger = new LoggerService();
    this.performance = new PerformanceService();
    this.events = new EventService();
    this.random = new RandomService();
    this.config = new ConfigService();
  }
}

export const engineServices = new EngineServices();
