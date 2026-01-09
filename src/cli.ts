#!/usr/bin/env node

/**
 * Quality Gate CLI
 *
 * Command-line interface for the Quality Gate tool.
 *
 * Usage:
 *   quality-gate <game-path> [options]
 *
 * Options:
 *   -f, --fix              Apply automatic fixes
 *   -j, --json             Output as JSON
 *   -s, --skip <checks>    Skip checks (comma-separated)
 *   -t, --timeout <ms>     Runtime test timeout (default: 30000)
 *   -v, --verbose          Verbose output
 *   --no-screenshot        Disable failure screenshots
 *   -h, --help             Show help
 */

import { Command } from 'commander';
import { qualityGate } from './quality-gate.js';
import { printResult } from './reporter.js';
import chalk from 'chalk';

const program = new Command();

program
    .name('quality-gate')
    .description('Quality Gate - Phaser game quality control tool')
    .version('1.0.0')
    .argument('<game-path>', 'Path to the game directory')
    .option('-f, --fix', 'Apply automatic fixes')
    .option('-j, --json', 'Output as JSON')
    .option('-s, --skip <checks>', 'Skip checks (comma-separated: safety,runtime,determinism)')
    .option('-t, --timeout <ms>', 'Runtime test timeout', '30000')
    .option('-v, --verbose', 'Verbose output')
    .option('--no-screenshot', 'Disable failure screenshots')
    .action(async (gamePath: string, options: {
        fix?: boolean;
        json?: boolean;
        skip?: string;
        timeout: string;
        verbose?: boolean;
        screenshot?: boolean;
    }) => {
        try {
            // Parse skip option
            const skip = options.skip ? options.skip.split(',').map(s => s.trim()) : [];

            // Show banner
            if (!options.json) {
                console.log(chalk.cyan('\n🎮 Quality Gate v1.0.0'));
                console.log(chalk.gray('   Phaser game quality control tool\n'));
            }

            // Run quality gate
            const result = await qualityGate(gamePath, {
                fix: options.fix ?? false,
                json: options.json ?? false,
                skip,
                timeout: parseInt(options.timeout, 10),
                verbose: options.verbose ?? false,
                screenshot: options.screenshot ?? true
            });

            // Print result
            printResult(result, options.json);

            // Exit with appropriate code
            process.exit(result.passed ? 0 : 1);

        } catch (error) {
            if (options.json) {
                console.log(JSON.stringify({
                    error: error instanceof Error ? error.message : String(error),
                    passed: false
                }));
            } else {
                console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
            }
            process.exit(2);
        }
    });

program.parse();
