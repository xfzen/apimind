import type { ConsoleMessage, Page, Request } from '@playwright/test';

import allowlist from '../console-warning-allowlist.json';

interface WarningAllowance {
  pattern: string;
  reason: string;
}

interface ConsoleGuard {
  assertNoErrors(): void;
}

const assetTypes = new Set(['document', 'font', 'image', 'media', 'script', 'stylesheet']);

function compileAllowlist(entries: WarningAllowance[]): RegExp[] {
  return entries.map(({ pattern, reason }, index) => {
    if (!pattern || !reason.trim()) {
      throw new Error(`Invalid console warning allowlist entry at index ${index}`);
    }
    return new RegExp(pattern);
  });
}

function describeRequestFailure(request: Request): string {
  const failure = request.failure();
  return `asset request failed: ${request.resourceType()} ${request.url()} (${failure?.errorText ?? 'unknown error'})`;
}

export function installConsoleGuard(page: Page): ConsoleGuard {
  const warningPatterns = compileAllowlist(allowlist.entries);
  const violations: string[] = [];

  page.on('pageerror', error => {
    violations.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      violations.push(`console.error: ${message.text()}`);
    }
    if (
      message.type() === 'warning' &&
      !warningPatterns.some(pattern => pattern.test(message.text()))
    ) {
      violations.push(`console.warn: ${message.text()}`);
    }
  });
  page.on('requestfailed', request => {
    if (assetTypes.has(request.resourceType())) {
      violations.push(describeRequestFailure(request));
    }
  });

  return {
    assertNoErrors() {
      if (violations.length > 0) {
        throw new Error(`Browser console guard violations:\n${violations.join('\n')}`);
      }
    }
  };
}
