/**
 * Quality Gate - Type Definitions
 */

// Severity levels for detected issues
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

// Pattern types for safety scan
export type PatternType =
    | 'eval'
    | 'Function'
    | 'innerHTML'
    | 'outerHTML'
    | 'document.write'
    | 'debugger'
    | 'console.log'
    | 'console.debug'
    | 'console.info'
    | 'hardcoded-secret';

// Individual scan result
export interface ScanResult {
    file: string;
    line: number;
    column: number;
    pattern: PatternType;
    severity: Severity;
    snippet: string;
}

// Safety scan check result
export interface SafetyCheckResult {
    passed: boolean;
    issues: ScanResult[];
}

// Runtime test result
export interface RuntimeResult {
    passed: boolean;
    loadTimeMs: number;
    consoleErrors: string[];
    uncaughtExceptions: string[];
    canvasFound: boolean;
    canvasDimensions: { width: number; height: number } | null;
    screenshotPath?: string;
}

// Determinism check result
export interface DeterminismResult {
    passed: boolean;
    randomCallsDetected: number;
    seedingMechanismFound: boolean;
    seedingLibrary?: string;
    isReproducible: boolean;
}

// Fix result
export interface FixResult {
    file: string;
    fixer: string;
    applied: boolean;
    changes?: string;
    linesRemoved?: number;
    linesAdded?: number;
}

// Main quality gate result
export interface QualityGateResult {
    passed: boolean;
    iterations: number;
    totalTimeMs: number;
    gamePath: string;
    checks: {
        safety: SafetyCheckResult;
        runtime: RuntimeResult;
        determinism: DeterminismResult;
    };
    fixes: FixResult[];
}

// CLI options
export interface CLIOptions {
    fix: boolean;
    json: boolean;
    skip: string[];
    timeout: number;
    verbose: boolean;
    screenshot: boolean;
}

// Pattern definition for safety scan
export interface PatternDefinition {
    name: PatternType;
    regex: RegExp;
    severity: Severity;
    description: string;
}

// File scan options
export interface ScanOptions {
    extensions: string[];
    ignorePatterns: string[];
}
