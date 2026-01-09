/**
 * Debug Remover Fixer
 *
 * Removes debug statements from JavaScript files:
 * - console.log(), console.debug(), console.info()
 * - debugger statements
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import type { FixResult } from '../types.js';

// Patterns to remove (matches entire line)
const DEBUG_PATTERNS = [
    // console.log with various argument styles
    /^\s*console\.log\s*\([^)]*\)\s*;?\s*$/gm,
    /^\s*console\.log\s*\([\s\S]*?\)\s*;?\s*$/gm,
    // console.debug
    /^\s*console\.debug\s*\([^)]*\)\s*;?\s*$/gm,
    /^\s*console\.debug\s*\([\s\S]*?\)\s*;?\s*$/gm,
    // console.info
    /^\s*console\.info\s*\([^)]*\)\s*;?\s*$/gm,
    /^\s*console\.info\s*\([\s\S]*?\)\s*;?\s*$/gm,
    // debugger
    /^\s*debugger\s*;?\s*$/gm
];

// More specific inline patterns for console statements
const INLINE_DEBUG_PATTERNS = [
    /console\.log\s*\([^)]*\)\s*;?/g,
    /console\.debug\s*\([^)]*\)\s*;?/g,
    /console\.info\s*\([^)]*\)\s*;?/g,
    /\bdebugger\s*;?/g
];

// File extensions to process
const FILE_EXTENSIONS = ['.js', '.ts', '.mjs', '.jsx', '.tsx'];

/**
 * Remove debug statements from content
 * Handles single-line, multi-line and inline debug statements
 */
export function removeDebugStatements(content: string): { result: string; linesRemoved: number } {
    let result = content;
    let linesRemoved = 0;

    // Process line by line with multi-line tracking
    const lines = result.split('\n');
    const filteredLines: string[] = [];

    let inMultilineConsole = false;
    let parenBalance = 0;

    for (const line of lines) {
        // If we're inside a multi-line console statement
        if (inMultilineConsole) {
            // Count parentheses to track when statement ends
            parenBalance += (line.match(/\(/g) || []).length;
            parenBalance -= (line.match(/\)/g) || []).length;

            if (parenBalance <= 0) {
                inMultilineConsole = false;
                parenBalance = 0;
            }
            linesRemoved++;
            continue; // Skip this line
        }

        // Check for standalone debugger statement
        if (/^\s*debugger\s*;?\s*$/.test(line)) {
            linesRemoved++;
            continue;
        }

        // Check for console.log/debug/info - single line
        if (/^\s*console\.(log|debug|info)\s*\([^)]*\)\s*;?\s*$/.test(line)) {
            linesRemoved++;
            continue;
        }

        // Check for multi-line console statement start
        if (/^\s*console\.(log|debug|info)\s*\([^)]*$/.test(line)) {
            inMultilineConsole = true;
            parenBalance = (line.match(/\(/g) || []).length;
            parenBalance -= (line.match(/\)/g) || []).length;
            linesRemoved++;
            continue;
        }

        // Keep this line
        filteredLines.push(line);
    }

    result = filteredLines.join('\n');

    // Second pass: remove inline debugger statements (debugger in middle of code)
    const beforeInline = result;
    result = result.replace(/\s*debugger\s*;?\s*/g, ' ');
    if (result !== beforeInline) {
        linesRemoved++;
    }

    // Clean up multiple empty lines (preserve formatting better)
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

    return { result, linesRemoved };
}

/**
 * Get all JavaScript files in a directory
 */
async function getFiles(gamePath: string): Promise<string[]> {
    const patterns = FILE_EXTENSIONS.map(ext => `**/*${ext}`);

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
 * Apply debug remover to a game directory
 */
export async function applyDebugRemover(
    gamePath: string,
    verbose: boolean = false
): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const files = await getFiles(gamePath);

    for (const file of files) {
        try {
            const originalContent = fs.readFileSync(file, 'utf-8');
            const { result, linesRemoved } = removeDebugStatements(originalContent);

            if (linesRemoved > 0) {
                fs.writeFileSync(file, result, 'utf-8');

                const relativePath = path.relative(gamePath, file);
                results.push({
                    file: relativePath,
                    fixer: 'DebugRemover',
                    applied: true,
                    changes: `Removed ${linesRemoved} debug statement(s)`,
                    linesRemoved
                });

                if (verbose) {
                    console.log(`  ✓ ${relativePath}: Removed ${linesRemoved} debug statement(s)`);
                }
            }
        } catch (error) {
            if (verbose) {
                console.error(`  ✗ Error processing ${file}:`, error);
            }
        }
    }

    return results;
}
