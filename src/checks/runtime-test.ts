/**
 * Runtime Test Module
 *
 * Tests the game in a headless browser using Playwright:
 * - Opens the game's index.html
 * - Waits for canvas to appear
 * - Captures console errors
 * - Captures uncaught exceptions
 * - Takes screenshot on failure (optional)
 */

import * as path from 'path';
import * as fs from 'fs';
import { chromium, type Browser, type Page } from 'playwright';
import type { RuntimeResult } from '../types.js';

// Default timeout for page load
const DEFAULT_TIMEOUT = 30000;

// Wait time after page load for game initialization
const GAME_INIT_WAIT = 3000;

/**
 * Run runtime test on a game
 */
export async function runtimeTest(
    gamePath: string,
    options: {
        timeout?: number;
        screenshot?: boolean;
        verbose?: boolean;
    } = {}
): Promise<RuntimeResult> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const startTime = Date.now();

    const errors: string[] = [];
    const exceptions: string[] = [];

    let browser: Browser | null = null;
    let screenshotPath: string | undefined;

    try {
        // Find index.html
        const indexPath = path.join(gamePath, 'index.html');
        if (!fs.existsSync(indexPath)) {
            return {
                passed: false,
                loadTimeMs: 0,
                consoleErrors: ['index.html not found'],
                uncaughtExceptions: [],
                canvasFound: false,
                canvasDimensions: null
            };
        }

        // Launch browser
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Capture console errors
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        // Capture uncaught exceptions
        page.on('pageerror', (err) => {
            exceptions.push(err.message);
        });

        // Navigate to game
        const fileUrl = `file://${path.resolve(indexPath)}`;
        await page.goto(fileUrl, { timeout });

        // Wait for canvas
        let canvasInfo: { width: number; height: number } | null = null;
        try {
            await page.waitForSelector('canvas', { timeout: 10000 });

            // Wait for game to initialize
            await page.waitForTimeout(GAME_INIT_WAIT);

            // Get canvas info
            canvasInfo = await page.evaluate(() => {
                const canvas = document.querySelector('canvas');
                if (!canvas) return null;
                return {
                    width: canvas.width,
                    height: canvas.height
                };
            });
        } catch {
            // Canvas not found or timeout
        }

        const loadTimeMs = Date.now() - startTime;

        // Take screenshot on failure
        const passed = errors.length === 0 && exceptions.length === 0;
        if (!passed && options.screenshot) {
            const screenshotDir = path.join(gamePath, '.quality-gate');
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }
            screenshotPath = path.join(screenshotDir, 'failure-screenshot.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });
        }

        await browser.close();

        return {
            passed,
            loadTimeMs,
            consoleErrors: errors,
            uncaughtExceptions: exceptions,
            canvasFound: canvasInfo !== null,
            canvasDimensions: canvasInfo,
            screenshotPath
        };

    } catch (error) {
        if (browser) {
            await browser.close();
        }

        return {
            passed: false,
            loadTimeMs: Date.now() - startTime,
            consoleErrors: errors,
            uncaughtExceptions: [error instanceof Error ? error.message : String(error)],
            canvasFound: false,
            canvasDimensions: null
        };
    }
}
