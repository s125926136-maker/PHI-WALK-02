/**
 * Benchmark Report Definitions & Formatter
 * This file contains data structures, serialization logic, and formatting
 * functions for the engine performance and regression benchmark reports.
 */

export interface ScenarioMetrics {
  scenarioName: string;
  avgFps: number;
  avgFrameTime: number; // ms
  p95FrameTime: number; // ms
  maxFrameTime: number; // ms
  minFrameTime: number; // ms
}

export interface SubsystemTimings {
  Simulation: number; // ms
  Character: number; // ms
  Collision: number; // ms
  Camera: number; // ms
  Measurement: number; // ms
  Solar: number; // ms
  Wind: number; // ms
  Telemetry: number; // ms
  Render: number; // ms
}

export interface ThreeJsMetrics {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface SceneMetrics {
  meshCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  lightCount: number;
  shadowCasters: number;
  transparentObjects: number;
  instancedObjects: number;
}

export interface RaycasterMetrics {
  total: number;
  ground: number;
  collision: number;
  measurement: number;
  camera: number;
  solar: number;
  wind: number;
}

export interface ScenarioBenchmarkResult {
  scenarioName: string;
  scenarioMetrics: ScenarioMetrics;
  subsystemTimings: SubsystemTimings;
  threeJsMetrics: ThreeJsMetrics;
  sceneMetrics: SceneMetrics;
  raycasterMetrics: RaycasterMetrics;
}

export interface BenchmarkReport {
  timestamp: string;
  results: ScenarioBenchmarkResult[];
}

// Regression definitions
export type RegressionStatus = 'Improved' | 'Unchanged' | 'Regressed';

export interface SubsystemRegressionItem {
  subsystem: string;
  scenarioName: string;
  previousTime: number;
  currentTime: number;
  percentChange: number; // positive is slower (regression), negative is faster (improvement)
  status: RegressionStatus;
  thresholdBreached: '5%' | '10%' | '20%' | 'none';
}

export interface PerformanceRegressionReport {
  timestamp: string;
  items: SubsystemRegressionItem[];
  improvedCount: number;
  unchangedCount: number;
  regressedCount: number;
}

/**
 * Serialize a BenchmarkReport to JSON
 */
export function exportToJson(report: BenchmarkReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Generate a beautiful Markdown summary of all benchmarks
 */
export function generateMarkdownReport(report: BenchmarkReport): string {
  let md = `# Engine Benchmark Baseline Report\n\n`;
  md += `Generated: **${report.timestamp}**\n\n`;

  // General summary table
  md += `## 📋 Scenarios Executive Summary\n\n`;
  md += `| Scene / Scenario | Avg FPS | Avg Frame (ms) | P95 Frame (ms) | Draw Calls | Triangles | Memory (Geo/Tex) |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of report.results) {
    const geoTex = `${r.threeJsMetrics.geometries} / ${r.threeJsMetrics.textures}`;
    md += `| **${r.scenarioName}** | ${r.scenarioMetrics.avgFps} | ${r.scenarioMetrics.avgFrameTime.toFixed(2)} | ${r.scenarioMetrics.p95FrameTime.toFixed(2)} | ${r.threeJsMetrics.drawCalls} | ${r.threeJsMetrics.triangles.toLocaleString()} | ${geoTex} |\n`;
  }
  md += `\n`;

  // Subsystem Breakdown
  md += `## ⚙️ Subsystem Timing Breakdown (ms)\n\n`;
  md += `| Scene | Simulation | Character | Collision | Camera | Measurement | Solar Study | Wind Flow | Telemetry | Render |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of report.results) {
    const t = r.subsystemTimings;
    md += `| **${r.scenarioName}** | ${t.Simulation.toFixed(2)} | ${t.Character.toFixed(2)} | ${t.Collision.toFixed(2)} | ${t.Camera.toFixed(2)} | ${t.Measurement.toFixed(2)} | ${t.Solar.toFixed(2)} | ${t.Wind.toFixed(2)} | ${t.Telemetry.toFixed(2)} | ${t.Render.toFixed(2)} |\n`;
  }
  md += `\n`;

  // Scene details
  md += `## 📦 Scene Graph & Asset Complexity Metrics\n\n`;
  md += `| Scene | Mesh Count | Triangle Count | Materials | Textures | Lights | Shadows | Transparent | Instanced |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of report.results) {
    const s = r.sceneMetrics;
    md += `| **${r.scenarioName}** | ${s.meshCount} | ${s.triangleCount.toLocaleString()} | ${s.materialCount} | ${s.textureCount} | ${s.lightCount} | ${s.shadowCasters} | ${s.transparentObjects} | ${s.instancedObjects} |\n`;
  }
  md += `\n`;

  // Raycaster statistics
  md += `## 🔦 Raycaster Cast Counts / Frame\n\n`;
  md += `| Scene | Total Casts | Ground | Collision | Measurement | Camera | Solar | Wind |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of report.results) {
    const rc = r.raycasterMetrics;
    md += `| **${r.scenarioName}** | ${rc.total} | ${rc.ground} | ${rc.collision} | ${rc.measurement} | ${rc.camera} | ${rc.solar} | ${rc.wind} |\n`;
  }
  md += `\n`;

  return md;
}

/**
 * Compare a current benchmark report with a previous report and detect performance regressions
 */
export function compareBenchmarks(
  current: BenchmarkReport,
  previous: BenchmarkReport
): PerformanceRegressionReport {
  const items: SubsystemRegressionItem[] = [];
  let improvedCount = 0;
  let unchangedCount = 0;
  let regressedCount = 0;

  // Map previous results for fast lookup by ScenarioName
  const prevMap = new Map<string, ScenarioBenchmarkResult>();
  for (const r of previous.results) {
    prevMap.set(r.scenarioName, r);
  }

  for (const currRes of current.results) {
    const prevRes = prevMap.get(currRes.scenarioName);
    if (!prevRes) continue;

    // We compare each subsystem timing
    const subsystems: (keyof SubsystemTimings)[] = [
      'Simulation',
      'Character',
      'Collision',
      'Camera',
      'Measurement',
      'Solar',
      'Wind',
      'Telemetry',
      'Render'
    ];

    for (const sub of subsystems) {
      const prevVal = prevRes.subsystemTimings[sub] || 0;
      const currVal = currRes.subsystemTimings[sub] || 0;

      let percentChange = 0;
      if (prevVal > 0) {
        percentChange = ((currVal - prevVal) / prevVal) * 100;
      } else if (currVal > 0) {
        percentChange = 100; // went from 0 to something
      }

      // Threshold breaches (positive change means slower/regression)
      let status: RegressionStatus = 'Unchanged';
      let thresholdBreached: '5%' | '10%' | '20%' | 'none' = 'none';

      // Slower (regression)
      if (percentChange >= 5) {
        status = 'Regressed';
        regressedCount++;
        if (percentChange >= 20) {
          thresholdBreached = '20%';
        } else if (percentChange >= 10) {
          thresholdBreached = '10%';
        } else {
          thresholdBreached = '5%';
        }
      }
      // Faster (improvement)
      else if (percentChange <= -5) {
        status = 'Improved';
        improvedCount++;
      } else {
        status = 'Unchanged';
        unchangedCount++;
      }

      items.push({
        subsystem: sub,
        scenarioName: currRes.scenarioName,
        previousTime: prevVal,
        currentTime: currVal,
        percentChange,
        status,
        thresholdBreached
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    items,
    improvedCount,
    unchangedCount,
    regressedCount
  };
}

/**
 * Generate a Performance Regression Report in Markdown
 */
export function generateRegressionMarkdown(regReport: PerformanceRegressionReport): string {
  let md = `# Performance Regression & Validation Report\n\n`;
  md += `Generated: **${regReport.timestamp}**\n\n`;

  // Summary Metrics
  md += `## 📊 Regression Summary\n\n`;
  md += `- **Improved Subsystems (>=5% faster)**: 🟢 **${regReport.improvedCount}**\n`;
  md += `- **Unchanged Subsystems (<5% change)**: 🟡 **${regReport.unchangedCount}**\n`;
  md += `- **Regressed Subsystems (>=5% slower)**: 🔴 **${regReport.regressedCount}**\n\n`;

  // Regressions Table
  md += `## ⚠️ Detailed Subsystem Validation List\n\n`;
  md += `| Scenario | Subsystem | Previous (ms) | Current (ms) | Change (%) | Validation Status | Threshold Breach |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const item of regReport.items) {
    let statusEmoji = '🟡 UNCHANGED';
    if (item.status === 'Improved') {
      statusEmoji = '🟢 IMPROVED';
    } else if (item.status === 'Regressed') {
      statusEmoji = '🔴 REGRESSED';
    }

    const changeText = item.percentChange >= 0 
      ? `+${item.percentChange.toFixed(1)}%` 
      : `${item.percentChange.toFixed(1)}%`;

    const breachText = item.thresholdBreached === 'none' 
      ? 'None' 
      : `⚠️ ${item.thresholdBreached}`;

    md += `| ${item.scenarioName} | **${item.subsystem}** | ${item.previousTime.toFixed(3)} | ${item.currentTime.toFixed(3)} | ${changeText} | ${statusEmoji} | ${breachText} |\n`;
  }

  return md;
}
