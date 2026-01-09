/**
 * Reporter Module
 *
 * Formats and outputs quality gate results:
 * - JSON format
 * - Human-readable format with colors and emojis
 */

import chalk from 'chalk';
import type { QualityGateResult, Severity } from './types.js';

/**
 * Format result as JSON
 */
export function formatJson(result: QualityGateResult): string {
    return JSON.stringify(result, null, 2);
}

/**
 * Get severity color
 */
function getSeverityColor(severity: Severity): (text: string) => string {
    switch (severity) {
        case 'CRITICAL': return chalk.red.bold;
        case 'HIGH': return chalk.yellow;
        case 'MEDIUM': return chalk.blue;
        default: return chalk.white;
    }
}

/**
 * Get severity emoji
 */
function getSeverityEmoji(severity: Severity): string {
    switch (severity) {
        case 'CRITICAL': return '🔴';
        case 'HIGH': return '🟠';
        case 'MEDIUM': return '🟡';
        default: return '⚪';
    }
}

/**
 * Format result as human-readable text
 */
export function formatHumanReadable(result: QualityGateResult): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(chalk.bold('════════════════════════════════════════════════════════════'));
    lines.push(chalk.bold.cyan('                     QUALITY GATE REPORT'));
    lines.push(chalk.bold('════════════════════════════════════════════════════════════'));
    lines.push('');
    lines.push(`📁 Game: ${chalk.cyan(result.gamePath)}`);
    lines.push(`🕐 Time: ${result.totalTimeMs}ms`);
    lines.push(`🔄 Iterations: ${result.iterations}`);
    lines.push('');

    // Safety Scan
    lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
    lines.push(chalk.bold('                      SAFETY SCAN'));
    lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
    lines.push('');

    if (result.checks.safety.passed) {
        lines.push(chalk.green('✅ All safety checks passed'));
    } else {
        for (const issue of result.checks.safety.issues) {
            const color = getSeverityColor(issue.severity);
            const emoji = getSeverityEmoji(issue.severity);
            lines.push(color(`${emoji} ${issue.severity}: ${issue.pattern}`));
            lines.push(chalk.gray(`   📍 ${issue.file}:${issue.line}:${issue.column}`));
            lines.push(chalk.gray(`   💻 ${issue.snippet}`));
        }
    }
    lines.push('');

    // Runtime Test
    lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
    lines.push(chalk.bold('                      RUNTIME TEST'));
    lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
    lines.push('');

    if (result.checks.runtime.passed) {
        lines.push(chalk.green(`✅ Page loaded successfully (${result.checks.runtime.loadTimeMs}ms)`));
        if (result.checks.runtime.canvasFound) {
            const dims = result.checks.runtime.canvasDimensions;
            lines.push(chalk.green(`✅ Canvas found${dims ? ` (${dims.width}x${dims.height})` : ''}`));
        }
        lines.push(chalk.green('✅ No console errors'));
        lines.push(chalk.green('✅ No uncaught exceptions'));
    } else {
        lines.push(chalk.red(`❌ Load time: ${result.checks.runtime.loadTimeMs}ms`));
        lines.push(result.checks.runtime.canvasFound
            ? chalk.green('✅ Canvas found')
            : chalk.red('❌ Canvas NOT found'));

        if (result.checks.runtime.consoleErrors.length > 0) {
            lines.push(chalk.red(`❌ Console errors (${result.checks.runtime.consoleErrors.length}):`));
            for (const err of result.checks.runtime.consoleErrors.slice(0, 5)) {
                lines.push(chalk.gray(`   • ${err.substring(0, 80)}${err.length > 80 ? '...' : ''}`));
            }
        }

        if (result.checks.runtime.uncaughtExceptions.length > 0) {
            lines.push(chalk.red(`❌ Uncaught exceptions (${result.checks.runtime.uncaughtExceptions.length}):`));
            for (const ex of result.checks.runtime.uncaughtExceptions.slice(0, 5)) {
                lines.push(chalk.gray(`   • ${ex.substring(0, 80)}${ex.length > 80 ? '...' : ''}`));
            }
        }

        if (result.checks.runtime.screenshotPath) {
            lines.push(chalk.gray(`   📸 Screenshot: ${result.checks.runtime.screenshotPath}`));
        }
    }
    lines.push('');

    // Determinism Check
    lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
    lines.push(chalk.bold('                    DETERMINISM CHECK'));
    lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
    lines.push('');

    if (result.checks.determinism.passed) {
        lines.push(chalk.green('✅ Game is deterministic'));
        if (result.checks.determinism.seedingMechanismFound) {
            lines.push(chalk.green(`✅ Seeding mechanism: ${result.checks.determinism.seedingLibrary || 'found'}`));
        }
        if (result.checks.determinism.randomCallsDetected === 0) {
            lines.push(chalk.green('✅ No Math.random() calls'));
        }
    } else {
        lines.push(chalk.red(`❌ Math.random() calls: ${result.checks.determinism.randomCallsDetected}`));
        lines.push(chalk.red('❌ Seeding mechanism: NOT FOUND'));
        lines.push(chalk.yellow('⚠️ Game is NOT reproducible'));
    }
    lines.push('');

    // Fixes Applied
    if (result.fixes.length > 0) {
        lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
        lines.push(chalk.bold('                    FIXES APPLIED'));
        lines.push(chalk.bold('────────────────────────────────────────────────────────────'));
        lines.push('');

        for (const fix of result.fixes) {
            if (fix.applied) {
                lines.push(chalk.green(`✅ ${fix.fixer}: ${fix.changes}`));
                lines.push(chalk.gray(`   📁 ${fix.file}`));
            }
        }
        lines.push('');
    }

    // Final Result
    lines.push(chalk.bold('════════════════════════════════════════════════════════════'));
    if (result.passed) {
        lines.push(chalk.bold.green('                    RESULT: ✅ PASSED'));
    } else {
        lines.push(chalk.bold.red('                    RESULT: ❌ FAILED'));
    }
    lines.push(chalk.bold('════════════════════════════════════════════════════════════'));
    lines.push('');

    return lines.join('\n');
}

/**
 * Print result to console
 */
export function printResult(result: QualityGateResult, json: boolean = false): void {
    if (json) {
        console.log(formatJson(result));
    } else {
        console.log(formatHumanReadable(result));
    }
}
