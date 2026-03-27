import { test as base } from '@playwright/test';

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console Error: ${msg.text()}`);
      }
    });
    await use(page);
  },
});

export async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.shell', { timeout: 10000 });
}

export async function waitForModalClose(page) {
  await page.waitForFunction(() => {
    const modal = document.querySelector('#authModal');
    return modal && modal.classList.contains('hidden');
  }, { timeout: 5000 });
}

export async function createTestUser(page, username, password) {
  await page.click('#loginBtn');
  await page.waitForSelector('#authModal:not(.hidden)');
  
  await page.click('#authSwitchBtn');
  
  await page.fill('#authNameInput', username);
  await page.fill('#authPasswordInput', password);
  await page.fill('#authConfirmPasswordInput', password);
  
  await page.click('#authSubmitBtn');
  await waitForModalClose(page);
}

export async function login(page, username, password) {
  await page.click('#loginBtn');
  await page.waitForSelector('#authModal:not(.hidden)');
  
  await page.fill('#authNameInput', username);
  await page.fill('#authPasswordInput', password);
  
  await page.click('#authSubmitBtn');
  await waitForModalClose(page);
}

export async function logout(page) {
  await page.click('#logoutBtn');
  await page.waitForSelector('#loginBtn:not(.hidden)');
}

export { test };
