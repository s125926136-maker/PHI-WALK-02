/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IConfigService {
  get(key: string, defaultValue?: any): any;
  has(key: string): boolean;
}

export class ConfigService implements IConfigService {
  private config: Record<string, any> = {};

  constructor(initialConfig?: Record<string, any>) {
    if (initialConfig) {
      this.config = { ...initialConfig };
    }
  }

  public get(key: string, defaultValue?: any): any {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  public has(key: string): boolean {
    return this.config[key] !== undefined;
  }
}
