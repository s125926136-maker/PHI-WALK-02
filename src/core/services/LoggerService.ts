/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ILoggerService {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export class LoggerService implements ILoggerService {
  public log(...args: any[]): void {
    console.log(...args);
  }

  public warn(...args: any[]): void {
    console.warn(...args);
  }

  public error(...args: any[]): void {
    console.error(...args);
  }
}
