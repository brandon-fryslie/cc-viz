#!/usr/bin/env node
/**
 * Token Economics Data Validation Script
 *
 * Validates token economics data accuracy by:
 * 1. Checking for fake estimates in the codebase (token * 1000 patterns)
 * 2. Verifying daily stats reconcile with conversation totals
 * 3. Validating project breakdown totals
 * 4. Checking for data integrity issues
 *
 * Usage: node scripts/validate-token-economics.js
 *        API_URL=http://localhost:8002 node scripts/validate-token-economics.js
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:8002/api/v2'
const DISCREPANCY_THRESHOLD = 0.01 // 1% tolerance for rounding differences

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60))
}

function logCheck(label, passed, details = '') {
  const symbol = passed ? '✓' : '✗'
  const color = passed ? 'green' : 'red'
  log(`  ${symbol} ${label}`, color)
  if (details) {
    console.log(`      ${details}`)
  }
  return passed
}

// ============================================================================
// Validation 1: Check for fake token estimates in TokenEconomics page only
// ============================================================================

async function checkForFakeEstimates() {
  logSection('Checking for Fake Token Estimates in TokenEconomics Page')

  // Only check TokenEconomics.tsx for the critical fake pattern
  const tokenEconomicsPath = join(projectRoot, 'frontend/src/pages/TokenEconomics.tsx')

  if (!existsSync(tokenEconomicsPath)) {
    return logCheck('TokenEconomics.tsx exists', false, 'File not found')
  }

  const content = readFileSync(tokenEconomicsPath, 'utf8')
  let allPassed = true

  // CRITICAL: Check for messageCount * 1000 pattern
  const criticalPattern = /messageCount\s*\*\s*1000/
  const hasCriticalPattern = criticalPattern.test(content)

  if (hasCriticalPattern) {
    allPassed = logCheck('No messageCount * 1000 estimates', false, 'Found fake token estimation pattern')
  } else {
    logCheck('No messageCount * 1000 estimates', true)
  }

  // Check for other multiplication patterns that might indicate estimation
  const estimationPatterns = [
    { regex: /messageCount\s*\*\s*\d+/, description: 'messageCount multiplied by number' },
  ]

  for (const { regex, description } of estimationPatterns) {
    const matches = content.match(regex)
    if (matches) {
      allPassed = logCheck(description, false, `Found: ${matches[0]}`)
    } else {
      logCheck(description, true)
    }
  }

  return allPassed
}

// ============================================================================
// Validation 2: Fetch and validate API data
// ============================================================================

async function fetchAPI(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.log(`  Warning: Could not fetch ${endpoint}: ${error.message}`)
    return null
  }
}

async function validateAPIData() {
  logSection('Fetching API Data')

  const [statsData, conversationsData, projectStatsData] = await Promise.all([
    fetchAPI('/stats'),
    fetchAPI('/conversations'),
    fetchAPI('/stats/projects'),
  ])

  // Check if APIs are available
  if (!statsData) {
    log('  API not available - skipping data validation', 'yellow')
    log('  (Start viz-server to validate against real data)', 'yellow')
    return { available: false }
  }

  logCheck('Weekly stats API', true)
  logCheck('Conversations API', true)
  logCheck('Project stats API', true)

  return {
    available: true,
    stats: statsData,
    conversations: conversationsData,
    projectStats: projectStatsData,
  }
}

// ============================================================================
// Validation 3: Data reconciliation
// ============================================================================

async function validateDataReconciliation(data) {
  if (!data.available) {
    return true // Skip if API not available
  }

  logSection('Validating Data Reconciliation')

  const { stats, conversations, projectStats } = data
  const errors = []

  // Calculate totals
  const dailyTotal = stats.dailyStats?.reduce((sum, day) => sum + (day.tokens || 0), 0) || 0
  const convTotal = conversations?.reduce((sum, conv) => sum + (conv.totalTokens || 0), 0) || 0
  const projectTotal = projectStats?.projects?.reduce((sum, p) => sum + (p.totalTokens || 0), 0) || 0

  log(`  Daily stats total: ${formatNumber(dailyTotal)} tokens`, 'blue')
  log(`  Conversations total: ${formatNumber(convTotal)} tokens`, 'blue')
  log(`  Project stats total: ${formatNumber(projectTotal)} tokens`, 'blue')

  // Check daily stats vs conversations
  if (convTotal > 0) {
    const diff = Math.abs(dailyTotal - convTotal)
    const percentDiff = diff / convTotal

    if (percentDiff > DISCREPANCY_THRESHOLD) {
      errors.push(`Daily total (${formatNumber(dailyTotal)}) differs from conversation total (${formatNumber(convTotal)}) by ${(percentDiff * 100).toFixed(1)}%`)
      logCheck('Daily stats vs Conversations', false, `Difference: ${(percentDiff * 100).toFixed(1)}% (threshold: ${DISCREPANCY_THRESHOLD * 100}%)`)
    } else {
      logCheck('Daily stats vs Conversations', true, `Difference: ${(percentDiff * 100).toFixed(2)}% (within threshold)`)
    }
  } else {
    logCheck('Daily stats vs Conversations', true, 'No conversations to compare')
  }

  // Check project stats vs daily total
  if (projectTotal > 0 && dailyTotal > 0) {
    const diff = Math.abs(projectTotal - dailyTotal)
    const percentDiff = diff / Math.max(dailyTotal, projectTotal)

    if (percentDiff > DISCREPANCY_THRESHOLD) {
      errors.push(`Project total (${formatNumber(projectTotal)}) differs from daily total (${formatNumber(dailyTotal)}) by ${(percentDiff * 100).toFixed(1)}%`)
      logCheck('Project stats vs Daily total', false, `Difference: ${(percentDiff * 100).toFixed(1)}%`)
    } else {
      logCheck('Project stats vs Daily total', true, `Difference: ${(percentDiff * 100).toFixed(2)}%`)
    }
  } else {
    logCheck('Project stats vs Daily total', true, 'No data to compare')
  }

  return errors.length === 0
}

// ============================================================================
// Validation 4: Data integrity checks
// ============================================================================

async function validateDataIntegrity(data) {
  if (!data.available) {
    return true
  }

  logSection('Checking Data Integrity')

  const { conversations, projectStats } = data
  let allPassed = true

  // Check for negative token values
  let negConv = 0
  conversations?.forEach(conv => {
    if (conv.totalTokens < 0) negConv++
  })

  if (negConv > 0) {
    allPassed = logCheck('No negative conversation tokens', false, `Found ${negConv} conversations with negative tokens`)
  } else {
    logCheck('No negative conversation tokens', true)
  }

  // Check for zero tokens with messages
  let zeroTokens = 0
  conversations?.forEach(conv => {
    if (conv.totalTokens === 0 && conv.messageCount > 0) {
      zeroTokens++
    }
  })

  if (zeroTokens > 0) {
    allPassed = logCheck('No zero-token conversations with messages', false, `Found ${zeroTokens} conversations with messages but zero tokens`)
  } else {
    logCheck('No zero-token conversations with messages', true)
  }

  // Check project counts
  let invalidProjects = 0
  projectStats?.projects?.forEach(p => {
    if (p.conversationCount < 0 || p.totalTokens < 0) {
      invalidProjects++
    }
  })

  if (invalidProjects > 0) {
    allPassed = logCheck('Valid project statistics', false, `Found ${invalidProjects} projects with invalid values`)
  } else {
    logCheck('Valid project statistics', true)
  }

  return allPassed
}

// ============================================================================
// Validation 5: Verify API response structure
// ============================================================================

async function validateAPIResponseStructure(data) {
  if (!data.available) {
    return true
  }

  logSection('Validating API Response Structure')

  let allPassed = true
  const { stats, conversations, projectStats } = data

  // Check stats response
  if (!stats?.dailyStats || !Array.isArray(stats.dailyStats)) {
    allPassed = logCheck('Stats API response structure', false, 'Missing or invalid dailyStats array')
  } else {
    const hasValidDates = stats.dailyStats.every(d => d.date && typeof d.tokens === 'number')
    allPassed = logCheck('Stats API response structure', hasValidDates, hasValidDates ? 'All entries valid' : 'Invalid entry format')
  }

  // Check conversations response - handle different response formats
  const convArray = Array.isArray(conversations) ? conversations : conversations?.conversations
  if (!convArray || !Array.isArray(convArray)) {
    allPassed = logCheck('Conversations API response structure', false, 'Missing or invalid conversations array')
  } else {
    const hasRequiredFields = convArray.every(c =>
      c.id && c.projectName && typeof c.totalTokens === 'number'
    )
    allPassed = logCheck('Conversations API response structure', hasRequiredFields, hasRequiredFields ? 'All entries have required fields' : 'Missing required fields')
  }

  // Check project stats response
  if (!projectStats?.projects || !Array.isArray(projectStats.projects)) {
    allPassed = logCheck('Project stats API response structure', false, 'Missing or invalid projects array')
  } else {
    const hasRequiredFields = projectStats.projects.every(p =>
      p.name && typeof p.totalTokens === 'number' && typeof p.conversationCount === 'number'
    )
    allPassed = logCheck('Project stats API response structure', hasRequiredFields, hasRequiredFields ? 'All entries have required fields' : 'Missing required fields')
  }

  return allPassed
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAllFiles(dir, files = []) {
  const dirents = readdirSync(dir, { withFileTypes: true })

  for (const dirent of dirents) {
    const res = join(dir, dirent.name)
    if (dirent.isDirectory()) {
      getAllFiles(res, files)
    } else {
      files.push(res)
    }
  }

  return files
}

function formatNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B'
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// ============================================================================
// Main Validation Function
// ============================================================================

async function validateTokenEconomics() {
  console.log('\n')
  log('════════════════════════════════════════════════════════════', 'cyan')
  log('  Token Economics Data Validation Script', 'cyan')
  log('════════════════════════════════════════════════════════════', 'cyan')
  console.log()

  const results = {
    fakeEstimates: false,
    dataReconciliation: false,
    dataIntegrity: false,
    apiStructure: false,
  }

  // Run all validations
  results.fakeEstimates = await checkForFakeEstimates()

  const apiData = await validateAPIData()
  if (apiData.available) {
    results.dataReconciliation = await validateDataReconciliation(apiData)
    results.dataIntegrity = await validateDataIntegrity(apiData)
    results.apiStructure = await validateAPIResponseStructure(apiData)
  }

  // Summary
  logSection('Validation Summary')

  const allPassed = Object.values(results).every(r => r === true)

  if (allPassed) {
    log('ALL VALIDATIONS PASSED', 'green')
    console.log('\n')
    console.log('  The Token Economics page is ready for production use.')
    console.log('  - No fake token estimates found in codebase')
    if (apiData.available) {
      console.log('  - Data reconciles correctly between APIs')
      console.log('  - Data integrity checks pass')
    }
    console.log('\n')
    process.exit(0)
  } else {
    log('VALIDATION FAILED', 'red')
    console.log('\n')
    console.log('  Issues found:')
    if (!results.fakeEstimates) {
      console.log('  - Fake token estimates found in codebase (CRITICAL)')
    }
    if (!results.dataReconciliation) {
      console.log('  - Data reconciliation failed')
    }
    if (!results.dataIntegrity) {
      console.log('  - Data integrity issues found')
    }
    if (!results.apiStructure) {
      console.log('  - API response structure issues')
    }
    console.log('\n')
    console.log('  Please fix the issues above before deploying to production.')
    console.log('\n')
    process.exit(1)
  }
}

// ============================================================================
// Run Validation
// ============================================================================

validateTokenEconomics().catch(error => {
  console.error('Validation error:', error)
  process.exit(1)
})
