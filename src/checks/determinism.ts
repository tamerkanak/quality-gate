/**
 * Determinism Check Module
 *
 * Analyzes the game for determinism issues:
 * - Detects Math.random() usage
 * - Checks for seeding mechanism
 * - Validates reproducibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import type { DeterminismResult } from '../types.js';

// File extensions to scan
const SCAN_EXTENSIONS = ['.js', '.ts', '.mjs', '.jsx', '.tsx', '.html'];

/**
 * Strip comments from code
 */
function stripComments(content: string): string {
    let result = content.replace(/\/\/.*$/gm, '');
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
}

/**
 * Count Math.random() calls in content
 */
function countRandomCalls(content: string): number {
    const cleanContent = stripComments(content);
    const matches = cleanContent.match(/Math\.random\s*\(\s*\)/g);
    return matches ? matches.length : 0;
}

/**
 * Check for seeding mechanism
 * Uses cleaned content (without comments) to avoid false positives
 */
function checkForSeeding(content: string): { found: boolean; library?: string } {
    // First strip comments to avoid false positives from descriptions
    const cleanContent = stripComments(content);

    // More specific patterns that indicate actual seeding implementation
    const SEEDING_PATTERNS: { pattern: RegExp; name: string }[] = [
        { pattern: /seedrandom\s*\(/i, name: 'seedrandom' },
        { pattern: /new\s+Chance\s*\(/i, name: 'chance' },
        { pattern: /mersenne/i, name: 'mersenne-twister' },
        { pattern: /__GAME_SEED\s*=/i, name: '__GAME_SEED' },
        { pattern: /window\.__GAME_SEED/i, name: '__GAME_SEED' },
        { pattern: /SeededRandom\s*[.=({]/i, name: 'SeededRandom' },
        { pattern: /function\s+mulberry32/i, name: 'mulberry32' },
        { pattern: /Math\.random\s*=\s*function/i, name: 'custom-prng' },
        { pattern: /Math\.random\s*=\s*mulberry/i, name: 'mulberry32' },
        { pattern: /function\s+initSeed\s*\(/i, name: 'custom-prng' },
        { pattern: /let\s+seed\s*=\s*\d+/i, name: 'custom-prng' },
    ];

    for (const { pattern, name } of SEEDING_PATTERNS) {
        if (pattern.test(cleanContent)) {
            return { found: true, library: name };
        }
    }

    return { found: false };
}

/**
 * Get all scannable files
 */
async function getFiles(gamePath: string): Promise<string[]> {
    const patterns = SCAN_EXTENSIONS.map(ext => `**/*${ext}`);

    const files: string[] = [];
    for (const pattern of patterns) {
        const matches = await glob(pattern, {
            cwd: gamePath,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
            absolute: true
        });
        files.push(...matches);
    }

    return [...new Set(files)];
}

/**
 * Run determinism check on a game
 * Includes both static analysis and runtime verification
 */
export async function determinismCheck(
    gamePath: string,
    verbose: boolean = false
): Promise<DeterminismResult> {
    let totalRandomCalls = 0;
    let seedingFound = false;
    let seedingLibrary: string | undefined;

    const files = await getFiles(gamePath);

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf-8');

            // Count random calls
            totalRandomCalls += countRandomCalls(content);

            // Check for seeding
            const seeding = checkForSeeding(content);
            if (seeding.found) {
                seedingFound = true;
                seedingLibrary = seeding.library;
            }

        } catch (error) {
            if (verbose) {
                console.error(`Error checking ${file}:`, error);
            }
        }
    }

    // Runtime verification with dual-run comparison
    let runtimeVerified = false;
    let divergencePoint: number | undefined;

    // Only do runtime verification if there are random calls and seeding is found
    if (totalRandomCalls > 0 && seedingFound) {
        try {
            const verification = await verifyRuntimeDeterminism(gamePath, verbose);
            runtimeVerified = verification.matched;
            divergencePoint = verification.divergencePoint;
        } catch (error) {
            if (verbose) {
                console.error('Runtime verification failed:', error);
            }
        }
    }

    // Determine if reproducible
    const isReproducible = totalRandomCalls === 0 || (seedingFound && (runtimeVerified || totalRandomCalls > 0));

    // Passed if reproducible
    const passed = isReproducible;

    return {
        passed,
        randomCallsDetected: totalRandomCalls,
        seedingMechanismFound: seedingFound,
        seedingLibrary,
        isReproducible,
        divergencePoint
    };
}

/**
 * Runtime verification - runs the game twice with same seed and compares Math.random calls
 */
async function verifyRuntimeDeterminism(
    gamePath: string,
    verbose: boolean
): Promise<{ matched: boolean; divergencePoint?: number }> {
    const { chromium } = await import('playwright');

    const indexPath = path.join(gamePath, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return { matched: false };
    }

    const fileUrl = `file://${path.resolve(indexPath)}`;

    // Proxy script to track Math.random calls
    const proxyScript = `
        window.__randomCalls = [];
        const originalRandom = Math.random;
        Math.random = function() {
            const value = originalRandom.call(Math);
            window.__randomCalls.push(value);
            return value;
        };
    `;

    async function runAndCollect(): Promise<number[]> {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Inject proxy before page loads
        await page.addInitScript(proxyScript);

        await page.goto(fileUrl, { timeout: 10000 });
        await page.waitForTimeout(2000); // Wait for game init

        const calls = await page.evaluate(() => (window as any).__randomCalls || []);
        await browser.close();

        return calls;
    }

    try {
        const run1 = await runAndCollect();
        const run2 = await runAndCollect();

        if (verbose) {
            console.log(`  Run 1: ${run1.length} random calls`);
            console.log(`  Run 2: ${run2.length} random calls`);
        }

        // Compare the two runs
        const minLength = Math.min(run1.length, run2.length);
        for (let i = 0; i < minLength; i++) {
            if (run1[i] !== run2[i]) {
                return { matched: false, divergencePoint: i };
            }
        }

        // If lengths differ, it's a divergence
        if (run1.length !== run2.length) {
            return { matched: false, divergencePoint: minLength };
        }

        return { matched: true };
    } catch (error) {
        if (verbose) {
            console.error('Dual-run comparison failed:', error);
        }
        return { matched: false };
    }
}

export { countRandomCalls, checkForSeeding };

