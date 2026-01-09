/**
 * Safety Scan Module
 *
 * Detects dangerous code patterns in JavaScript files:
 * - eval() - Code injection risk
 * - new Function() - Dynamic code execution
 * - innerHTML/outerHTML - XSS vulnerability
 * - document.write() - DOM corruption
 * - debugger - Debug code
 * - console.log/debug/info - Debug statements
 * - Hardcoded secrets - Security leak
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import type { PatternDefinition, ScanResult, SafetyCheckResult, PatternType, Severity } from '../types.js';

// Pattern definitions
const PATTERNS: PatternDefinition[] = [
    {
        name: 'eval',
        regex: /\beval\s*\(/g,
        severity: 'CRITICAL',
        description: 'Code injection vulnerability'
    },
    {
        name: 'indirect-eval',
        regex: /\(0,\s*eval\)\s*\(/g,
        severity: 'CRITICAL',
        description: 'Indirect eval - code injection vulnerability'
    },
    {
        name: 'window.eval',
        regex: /window\.eval\s*\(/g,
        severity: 'CRITICAL',
        description: 'Window eval - code injection vulnerability'
    },
    {
        name: 'Function',
        regex: /\bnew\s+Function\s*\(/g,
        severity: 'CRITICAL',
        description: 'Dynamic code execution'
    },
    {
        name: 'Function.prototype.constructor',
        regex: /Function\.prototype\.constructor\s*\(/g,
        severity: 'CRITICAL',
        description: 'Function constructor - dynamic code execution'
    },
    {
        name: 'innerHTML',
        regex: /\.innerHTML\s*\+?=/g,
        severity: 'HIGH',
        description: 'XSS vulnerability'
    },
    {
        name: 'outerHTML',
        regex: /\.outerHTML\s*\+?=/g,
        severity: 'HIGH',
        description: 'XSS vulnerability'
    },
    {
        name: 'document.write',
        regex: /document\.write(ln)?\s*\(/g,
        severity: 'HIGH',
        description: 'DOM corruption risk'
    },
    {
        name: 'debugger',
        regex: /\bdebugger\b/g,
        severity: 'MEDIUM',
        description: 'Debug code left in production'
    },
    {
        name: 'console.log',
        regex: /console\.log\s*\(/g,
        severity: 'MEDIUM',
        description: 'Debug statement'
    },
    {
        name: 'console.debug',
        regex: /console\.debug\s*\(/g,
        severity: 'MEDIUM',
        description: 'Debug statement'
    },
    {
        name: 'console.info',
        regex: /console\.info\s*\(/g,
        severity: 'MEDIUM',
        description: 'Debug statement'
    }
];

// Secret patterns
const SECRET_PATTERNS: { regex: RegExp; name: string }[] = [
    { regex: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, name: 'API Key' },
    { regex: /secret[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Secret Key' },
    { regex: /password\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Password' },
    { regex: /token\s*[:=]\s*['"][^'"]{20,}['"]/gi, name: 'Token' },
    { regex: /['"]sk-[a-zA-Z0-9]{32,}['"]/g, name: 'OpenAI Key' },
    { regex: /['"]ghp_[a-zA-Z0-9]{36,}['"]/g, name: 'GitHub Token' },
    { regex: /SECRET_TOKEN\s*=\s*['"][^'"]+['"]/g, name: 'Secret Token' },
    { regex: /API_KEY\s*=\s*['"][^'"]+['"]/g, name: 'API Key Constant' }
];

// File extensions to scan
const SCAN_EXTENSIONS = ['.js', '.ts', '.mjs', '.jsx', '.tsx'];

// Ignore patterns
const IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.min.js',
    '**/*.bundle.js'
];

/**
 * Strip comments from JavaScript code for pattern matching
 */
function stripComments(content: string): string {
    // Remove single-line comments
    let result = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');

    return result;
}

/**
 * Check if a position is inside a comment
 * This prevents false positives from comments like "// don't use eval()"
 */
function isInComment(content: string, offset: number): boolean {
    const beforeOffset = content.substring(0, offset);

    // Check for single-line comment: //
    const lastNewline = beforeOffset.lastIndexOf('\n');
    const currentLine = beforeOffset.substring(lastNewline + 1);
    const singleLineComment = currentLine.indexOf('//');
    if (singleLineComment !== -1) {
        const commentStart = lastNewline + 1 + singleLineComment;
        if (commentStart < offset) {
            return true;
        }
    }

    // Check for multi-line comment: /* */
    const lastBlockStart = beforeOffset.lastIndexOf('/*');
    if (lastBlockStart !== -1) {
        const afterBlockStart = content.substring(lastBlockStart);
        const blockEnd = afterBlockStart.indexOf('*/');
        if (blockEnd === -1 || lastBlockStart + blockEnd + 2 > offset) {
            return true;
        }
    }

    return false;
}

/**
 * Get line and column number for a match index
 */
function getLineAndColumn(content: string, index: number): { line: number; column: number } {
    const lines = content.substring(0, index).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
    };
}

/**
 * Get snippet around a match
 */
function getSnippet(content: string, index: number, length: number = 50): string {
    const start = Math.max(0, index - 10);
    const end = Math.min(content.length, index + length);
    let snippet = content.substring(start, end).trim();

    // Clean up the snippet
    snippet = snippet.replace(/\s+/g, ' ');
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
}

/**
 * Scan a single file for issues
 */
function scanFile(filePath: string, originalContent: string): ScanResult[] {
    const results: ScanResult[] = [];

    // Check standard patterns against original content (with comment filtering)
    for (const pattern of PATTERNS) {
        // Reset regex lastIndex
        pattern.regex.lastIndex = 0;

        let match;
        while ((match = pattern.regex.exec(originalContent)) !== null) {
            // Skip if match is inside a comment
            if (isInComment(originalContent, match.index)) {
                continue;
            }

            const { line, column } = getLineAndColumn(originalContent, match.index);
            results.push({
                file: filePath,
                line,
                column,
                pattern: pattern.name,
                severity: pattern.severity,
                snippet: getSnippet(originalContent, match.index)
            });
        }
    }

    // Check secret patterns
    for (const secretPattern of SECRET_PATTERNS) {
        secretPattern.regex.lastIndex = 0;

        let match;
        while ((match = secretPattern.regex.exec(originalContent)) !== null) {
            // Skip if match is inside a comment
            if (isInComment(originalContent, match.index)) {
                continue;
            }

            const { line, column } = getLineAndColumn(originalContent, match.index);
            results.push({
                file: filePath,
                line,
                column,
                pattern: 'hardcoded-secret',
                severity: 'HIGH',
                snippet: `${secretPattern.name}: ${getSnippet(originalContent, match.index, 30)}`
            });
        }
    }

    return results;
}

/**
 * Get all scannable files in a directory
 */
async function getFiles(gamePath: string): Promise<string[]> {
    const patterns = SCAN_EXTENSIONS.map(ext => `**/*${ext}`);

    const files: string[] = [];
    for (const pattern of patterns) {
        const matches = await glob(pattern, {
            cwd: gamePath,
            ignore: IGNORE_PATTERNS,
            absolute: true
        });
        files.push(...matches);
    }

    return [...new Set(files)]; // Remove duplicates
}

/**
 * Run safety scan on a game directory
 */
export async function safetyScan(gamePath: string, verbose: boolean = false): Promise<SafetyCheckResult> {
    const allIssues: ScanResult[] = [];

    const files = await getFiles(gamePath);

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const relativePath = path.relative(gamePath, file);
            const issues = scanFile(relativePath, content);
            allIssues.push(...issues);
        } catch (error) {
            if (verbose) {
                console.error(`Error scanning ${file}:`, error);
            }
        }
    }

    // Sort by severity (CRITICAL > HIGH > MEDIUM)
    const severityOrder: Record<Severity, number> = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2 };
    allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Check if passed - no CRITICAL or HIGH issues, and no debug statements
    const hasCritical = allIssues.some(i => i.severity === 'CRITICAL');
    const hasHigh = allIssues.some(i => i.severity === 'HIGH');
    const hasMedium = allIssues.some(i => i.severity === 'MEDIUM');

    return {
        passed: !hasCritical && !hasHigh && !hasMedium,
        issues: allIssues
    };
}

export { PATTERNS, SECRET_PATTERNS, stripComments, scanFile, getFiles };
