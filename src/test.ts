/**
 * Quality Gate - Basic Tests
 */

import { safetyScan } from './checks/safety-scan.js';
import { determinismCheck } from './checks/determinism.js';
import * as path from 'path';
import * as fs from 'fs';

// Test helper
function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

// Create a temp test file
const testDir = path.join(process.cwd(), '.test-temp');
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
}

async function testSafetyScan() {
    console.log('🧪 Testing Safety Scan...');

    // Create a test file with eval
    const testFile = path.join(testDir, 'test-eval.js');
    fs.writeFileSync(testFile, 'const result = eval("1+1");', 'utf-8');

    const result = await safetyScan(testDir);
    assert(result.issues.length > 0, 'Should detect eval()');
    assert(result.issues[0].pattern === 'eval', 'Pattern should be eval');

    // Cleanup
    fs.unlinkSync(testFile);

    console.log('  ✅ Safety Scan tests passed');
}

async function testDeterminism() {
    console.log('🧪 Testing Determinism Check...');

    // Create a test file with Math.random
    const testFile = path.join(testDir, 'test-random.js');
    fs.writeFileSync(testFile, 'const x = Math.random();', 'utf-8');

    const result = await determinismCheck(testDir);
    assert(result.randomCallsDetected > 0, 'Should detect Math.random()');

    // Cleanup
    fs.unlinkSync(testFile);

    console.log('  ✅ Determinism tests passed');
}

async function runTests() {
    console.log('\n========================================');
    console.log('      Quality Gate - Test Suite');
    console.log('========================================\n');

    try {
        await testSafetyScan();
        await testDeterminism();

        // Cleanup test directory
        fs.rmdirSync(testDir, { recursive: true });

        console.log('\n✅ All tests passed!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

runTests();
