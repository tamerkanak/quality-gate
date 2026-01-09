/**
 * Quality Gate - Entry Point
 *
 * Exports main functions for programmatic use.
 */

export { qualityGate } from './quality-gate.js';
export { safetyScan } from './checks/safety-scan.js';
export { runtimeTest } from './checks/runtime-test.js';
export { determinismCheck } from './checks/determinism.js';
export { applyDebugRemover } from './fixers/debug-remover.js';
export { applyInnerHtmlSanitizer } from './fixers/innerhtml-sanitizer.js';
export { applyRandomSeeder } from './fixers/random-seeder.js';
export { formatJson, formatHumanReadable, printResult } from './reporter.js';
export * from './types.js';
