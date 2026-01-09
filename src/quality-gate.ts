/**
 * Quality Gate - Main Orchestrator
 *
 * Orchestrates all checks and fixers:
 * 1. Safety Scan
 * 2. Runtime Test
 * 3. Determinism Check
 * 4. Apply fixers (if --fix)
 */

import * as path from 'path';
import * as fs from 'fs';
import type { QualityGateResult, CLIOptions, FixResult } from './types.js';
import { safetyScan } from './checks/safety-scan.js';
import { runtimeTest } from './checks/runtime-test.js';
import { determinismCheck } from './checks/determinism.js';
import { applyDebugRemover } from './fixers/debug-remover.js';
import { applyInnerHtmlSanitizer } from './fixers/innerhtml-sanitizer.js';
import { applyRandomSeeder } from './fixers/random-seeder.js';

/**
 * Run Quality Gate on a game
 */
export async function qualityGate(
    gamePath: string,
    options: Partial<CLIOptions> = {}
): Promise<QualityGateResult> {
    const startTime = Date.now();
    const absolutePath = path.resolve(gamePath);

    // Validate game path
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Game path does not exist: ${absolutePath}`);
    }

    const skip = options.skip ?? [];
    const verbose = options.verbose ?? false;
    const fix = options.fix ?? false;

    if (verbose) {
        console.log(`\n🔍 Scanning game: ${absolutePath}`);
    }

    // Initialize result
    const result: QualityGateResult = {
        passed: true,
        iterations: 1,
        totalTimeMs: 0,
        gamePath: absolutePath,
        checks: {
            safety: { passed: true, issues: [] },
            runtime: {
                passed: true,
                loadTimeMs: 0,
                consoleErrors: [],
                uncaughtExceptions: [],
                canvasFound: false,
                canvasDimensions: null
            },
            determinism: {
                passed: true,
                randomCallsDetected: 0,
                seedingMechanismFound: false,
                isReproducible: true
            }
        },
        fixes: []
    };

    // Run checks
    let iteration = 0;
    const maxIterations = fix ? 2 : 1; // Run twice if fixing: before and after

    while (iteration < maxIterations) {
        iteration++;
        result.iterations = iteration;

        if (verbose && iteration > 1) {
            console.log(`\n🔄 Re-running checks after fixes (iteration ${iteration})...`);
        }

        // 1. Safety Scan
        if (!skip.includes('safety')) {
            if (verbose) console.log('\n📋 Running Safety Scan...');
            result.checks.safety = await safetyScan(absolutePath, verbose);

            // Apply fixers before re-check
            if (fix && iteration === 1) {
                // Apply debug remover
                const debugFixes = await applyDebugRemover(absolutePath, verbose);
                result.fixes.push(...debugFixes);

                // Apply innerHTML sanitizer
                const htmlFixes = await applyInnerHtmlSanitizer(absolutePath, verbose);
                result.fixes.push(...htmlFixes);
            }
        }

        // 2. Determinism Check
        if (!skip.includes('determinism')) {
            if (verbose) console.log('\n🎲 Running Determinism Check...');
            result.checks.determinism = await determinismCheck(absolutePath, verbose);

            // Apply random seeder if needed
            if (fix && iteration === 1 && !result.checks.determinism.passed) {
                const seedFixes = await applyRandomSeeder(absolutePath, verbose);
                result.fixes.push(...seedFixes);
            }
        }

        // 3. Runtime Test (only on final iteration)
        if (!skip.includes('runtime') && iteration === maxIterations) {
            if (verbose) console.log('\n🎮 Running Runtime Test...');
            result.checks.runtime = await runtimeTest(absolutePath, {
                timeout: options.timeout,
                screenshot: options.screenshot,
                verbose
            });
        }

        // Break if not fixing
        if (!fix) break;
    }

    // Calculate final passed status
    result.passed =
        result.checks.safety.passed &&
        result.checks.runtime.passed &&
        result.checks.determinism.passed;

    result.totalTimeMs = Date.now() - startTime;

    return result;
}

export default qualityGate;
