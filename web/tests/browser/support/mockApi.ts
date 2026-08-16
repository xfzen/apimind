import type { Page, Route } from '@playwright/test';

import group from '../fixtures/auth/group.json';
import groupList from '../fixtures/auth/group-list.json';
import loginFailure from '../fixtures/auth/login-failure.json';
import loginSuccess from '../fixtures/auth/login-success.json';
import projectList from '../fixtures/auth/project-list.json';
import statusGuest from '../fixtures/auth/status-guest.json';
import statusMember from '../fixtures/auth/status-member.json';

export type MockApiScenario = 'guest' | 'login-success' | 'login-failure' | 'member';

type JsonFixture = Readonly<Record<string, unknown>>;

const sharedFixtures: Readonly<Record<string, JsonFixture>> = {
  '/api/group/get_mygroup': group,
  '/api/group/list': groupList,
  '/api/group/get': group,
  '/api/project/list': projectList
};

async function fulfillJson(route: Route, fixture: JsonFixture) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(fixture)
  });
}

export async function installMockApi(page: Page, scenario: MockApiScenario): Promise<void> {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/user/status') {
      await fulfillJson(route, scenario === 'member' ? statusMember : statusGuest);
      return;
    }

    if (path === '/api/user/login') {
      if (scenario === 'login-success') {
        await fulfillJson(route, loginSuccess);
        return;
      }
      if (scenario === 'login-failure') {
        await fulfillJson(route, loginFailure);
        return;
      }
    }

    if (path === '/api/user/avatar') {
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" />'
      });
      return;
    }

    const fixture = sharedFixtures[path];
    if (fixture) {
      await fulfillJson(route, fixture);
      return;
    }

    await route.abort('failed');
    throw new Error(`Missing mock API fixture for ${request.method()} ${path}`);
  });
}
