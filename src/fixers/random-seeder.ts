/**
 * Random Seeder Fixer
 *
 * Injects a seeded PRNG (Mulberry32) to make the game deterministic:
 * - Replaces Math.random() with a seeded version
 * - Supports URL seed parameter (?seed=12345)
 * - Exposes __GAME_SEED for replay
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FixResult } from '../types.js';

// Mulberry32 PRNG injection code
const SEED_INJECTION = `
<!-- Quality Gate: Seeded PRNG Injection -->
<script>
(function() {
  // Mulberry32 - A simple and fast 32-bit PRNG
  function mulberry32(seed) {
    return function() {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Hash function for string seeds
  function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }

  // Get seed from URL or use default
  var urlParams = new URLSearchParams(window.location.search);
  var urlSeed = urlParams.get('seed');
  var seed = urlSeed ? hashCode(urlSeed) : 12345;

  // Replace Math.random with seeded version
  Math.random = mulberry32(seed);

  // Expose seed for replay
  window.__GAME_SEED = seed;
})();
</script>
`;

/**
 * Check if content already has a seeding mechanism
 */
function hasExistingSeedMechanism(content: string): boolean {
    const EXISTING_SEED_PATTERNS = [
        /__GAME_SEED/,                    // Our injection signature
        /mulberry32\s*\(/,                // Mulberry32 PRNG function call
        /seedrandom/i,                    // seedrandom library
        /Math\.random\s*=\s*function/,    // Custom PRNG override
        /Math\.random\s*=\s*mulberry/,    // Our injection signature
        /Math\._originalRandom/,          // Original random backup
        /function\s+initSeed\s*\(/,       // Custom seed init
        /\.seed\s*\(\s*\d+/,              // seed(12345) call pattern
        /new\s+Chance\s*\(/i,             // Chance.js
        /mersenne/i,                      // Mersenne Twister
    ];

    for (const pattern of EXISTING_SEED_PATTERNS) {
        if (pattern.test(content)) {
            return true;
        }
    }
    return false;
}

/**
 * Inject seed into HTML file
 */
export function injectSeed(htmlContent: string): { result: string; injected: boolean } {
    // Check if already has seeding using comprehensive patterns
    if (hasExistingSeedMechanism(htmlContent)) {
        return { result: htmlContent, injected: false };
    }

    let result = htmlContent;
    let injected = false;

    // Try to inject after <head>
    if (result.includes('<head>')) {
        result = result.replace('<head>', '<head>' + SEED_INJECTION);
        injected = true;
    }
    // Or at the start of <body>
    else if (result.includes('<body>')) {
        result = result.replace('<body>', '<body>' + SEED_INJECTION);
        injected = true;
    }
    // Or at the very beginning
    else {
        result = SEED_INJECTION + '\n' + result;
        injected = true;
    }

    return { result, injected };
}

/**
 * Apply random seeder to a game directory
 */
export async function applyRandomSeeder(
    gamePath: string,
    verbose: boolean = false
): Promise<FixResult[]> {
    const results: FixResult[] = [];

    const indexPath = path.join(gamePath, 'index.html');

    if (!fs.existsSync(indexPath)) {
        if (verbose) {
            console.log('  ✗ index.html not found, cannot inject seed');
        }
        return results;
    }

    try {
        const originalContent = fs.readFileSync(indexPath, 'utf-8');
        const { result, injected } = injectSeed(originalContent);

        if (injected) {
            fs.writeFileSync(indexPath, result, 'utf-8');

            results.push({
                file: 'index.html',
                fixer: 'RandomSeeder',
                applied: true,
                changes: 'Injected Mulberry32 PRNG with URL seed support',
                linesAdded: SEED_INJECTION.split('\n').length
            });

            if (verbose) {
                console.log('  ✓ index.html: Injected seeded PRNG');
            }
        } else {
            if (verbose) {
                console.log('  ⊘ index.html: Already has seeding mechanism');
            }
        }
    } catch (error) {
        if (verbose) {
            console.error('  ✗ Error processing index.html:', error);
        }
    }

    return results;
}
