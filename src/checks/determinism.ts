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

    // Determine if reproducible
    // If there are random calls but no seeding, it's not reproducible
    const isReproducible = totalRandomCalls === 0 || seedingFound;

    // Passed if reproducible (either no random, or has seeding)
    const passed = isReproducible;

    return {
        passed,
        randomCallsDetected: totalRandomCalls,
        seedingMechanismFound: seedingFound,
        seedingLibrary,
        isReproducible
    };
}

export { countRandomCalls, checkForSeeding };
