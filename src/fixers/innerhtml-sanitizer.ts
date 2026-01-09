/**
 * innerHTML Sanitizer Fixer
 *
 * Converts dangerous innerHTML assignments to safer textContent:
 * - element.innerHTML = variable → element.textContent = variable
 * 
 * Note: Static string assignments are left as-is since they're relatively safe
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import type { FixResult } from '../types.js';

// File extensions to process
const FILE_EXTENSIONS = ['.js', '.ts', '.mjs', '.jsx', '.tsx'];

/**
 * Sanitize innerHTML assignments in content
 */
export function sanitizeInnerHtml(content: string): { result: string; changesCount: number } {
    let result = content;
    let changesCount = 0;

    // Pattern: element.innerHTML = variable (not a string literal)
    // Match innerHTML = followed by a variable name (not starting with quote)
    const pattern = /(\w+)\.innerHTML\s*=\s*(\w+)\s*;/g;

    result = result.replace(pattern, (match, element, variable) => {
        // Skip if variable looks like a string literal
        if (variable.startsWith('"') || variable.startsWith("'") || variable.startsWith('`')) {
            return match;
        }
        changesCount++;
        return `/* SECURITY FIX: innerHTML → textContent */ ${element}.textContent = ${variable};`;
    });

    // Also handle cases like: element.innerHTML = someObj.property;
    const pattern2 = /(\w+)\.innerHTML\s*=\s*([\w.]+)\s*;/g;

    result = result.replace(pattern2, (match, element, value) => {
        // Skip if already processed (has comment) or is string
        if (match.includes('SECURITY FIX') || match.includes('textContent')) {
            return match;
        }
        if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
            return match;
        }
        changesCount++;
        return `/* SECURITY FIX: innerHTML → textContent */ ${element}.textContent = ${value};`;
    });

    return { result, changesCount };
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
 * Apply innerHTML sanitizer to a game directory
 */
export async function applyInnerHtmlSanitizer(
    gamePath: string,
    verbose: boolean = false
): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const files = await getFiles(gamePath);

    for (const file of files) {
        try {
            const originalContent = fs.readFileSync(file, 'utf-8');
            const { result, changesCount } = sanitizeInnerHtml(originalContent);

            if (changesCount > 0) {
                fs.writeFileSync(file, result, 'utf-8');

                const relativePath = path.relative(gamePath, file);
                results.push({
                    file: relativePath,
                    fixer: 'InnerHtmlSanitizer',
                    applied: true,
                    changes: `Converted ${changesCount} innerHTML to textContent`,
                    linesRemoved: 0,
                    linesAdded: 0
                });

                if (verbose) {
                    console.log(`  ✓ ${relativePath}: Converted ${changesCount} innerHTML assignment(s)`);
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
