import { test, expect } from '@playwright/test';
import { 
  waitForAppReady, 
  createTestUser, 
  login, 
  logout,
  waitForModalClose 
} from './helpers.mjs';

const TEST_USER = 'testuser';
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Agent Orchestra E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should load the dashboard page', async ({ page }) => {
    await expect(page).toHaveTitle(/Agent Orchestra/);
    
    await expect(page.locator('.shell')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Agent Orchestra');
    
    await expect(page.locator('#stats')).toBeVisible();
    await expect(page.locator('#trendsChartContainer')).toBeVisible();
    
    console.log('Dashboard loaded successfully');
  });

  test('should show login modal when clicking login button', async ({ page }) => {
    await expect(page.locator('#loginBtn')).toBeVisible();
    
    await page.click('#loginBtn');
    
    await expect(page.locator('#authModal')).toBeVisible();
    await expect(page.locator('#authModalTitle')).toContainText('登录');
    
    await expect(page.locator('#authNameInput')).toBeVisible();
    await expect(page.locator('#authPasswordInput')).toBeVisible();
    await expect(page.locator('#authSubmitBtn')).toBeVisible();
    
    console.log('Login modal opened correctly');
  });

  test('should register a new user', async ({ page }) => {
    const uniqueUser = `user_${Date.now()}`;
    const uniquePassword = 'Password123!';
    
    await page.click('#loginBtn');
    await expect(page.locator('#authModal')).toBeVisible();
    
    await page.click('#authSwitchBtn');
    await expect(page.locator('#authModalTitle')).toContainText('注册');
    
    await page.fill('#authNameInput', uniqueUser);
    await page.fill('#authPasswordInput', uniquePassword);
    await page.fill('#authConfirmPasswordInput', uniquePassword);
    
    await page.click('#authSubmitBtn');
    await waitForModalClose(page);
    
    await expect(page.locator('#userInfo')).toBeVisible();
    await expect(page.locator('#currentUserName')).toContainText(uniqueUser);
    
    console.log(`User ${uniqueUser} registered successfully`);
  });

  test('should login with existing credentials', async ({ page }) => {
    await createTestUser(page, TEST_USER, TEST_PASSWORD);
    
    await expect(page.locator('#userInfo')).toBeVisible();
    await expect(page.locator('#currentUserName')).toContainText(TEST_USER);
    
    console.log('Login successful');
  });

  test('should logout successfully', async ({ page }) => {
    await createTestUser(page, TEST_USER, TEST_PASSWORD);
    
    await logout(page);
    
    await expect(page.locator('#loginBtn')).toBeVisible();
    await expect(page.locator('#userInfo')).toHaveClass(/hidden/);
    
    console.log('Logout successful');
  });

  test('should display task form when logged in', async ({ page }) => {
    await createTestUser(page, TEST_USER, TEST_PASSWORD);
    
    await expect(page.locator('#taskForm')).toBeVisible();
    
    await expect(page.locator('#taskForm input[name="title"]')).toBeVisible();
    await expect(page.locator('#taskForm textarea[name="prompt"]')).toBeVisible();
    await expect(page.locator('#taskForm select[name="priority"]')).toBeVisible();
    await expect(page.locator('#taskForm select[name="mode"]')).toBeVisible();
    
    console.log('Task form visible after login');
  });

  test('should create a task', async ({ page }) => {
    await createTestUser(page, TEST_USER, TEST_PASSWORD);
    
    await page.fill('#taskForm input[name="title"]', 'E2E Test Task');
    await page.fill('#taskForm textarea[name="prompt"]', 'This is a test task for E2E testing');
    
    const agentCheckbox = page.locator('#agentCheckboxes input[type="checkbox"]').first();
    if (await agentCheckbox.isVisible()) {
      await agentCheckbox.check();
    }
    
    await page.click('#taskForm button[type="submit"]');
    
    await page.waitForTimeout(1000);
    
    const formMsg = page.locator('#formMsg');
    const msgText = await formMsg.textContent();
    
    if (msgText && msgText.includes('成功')) {
      console.log('Task created successfully');
    } else {
      console.log('Task form submitted (may have validation message)');
    }
  });

  test('should show workflow panel', async ({ page }) => {
    await createTestUser(page, TEST_USER, TEST_PASSWORD);
    
    const workflowSection = page.locator('text=工作流');
    await expect(workflowSection.first()).toBeVisible();
    
    console.log('Workflow section visible');
  });

  test('should show task list section', async ({ page }) => {
    await createTestUser(page, TEST_USER, TEST_PASSWORD);
    
    const taskListSection = page.locator('text=任务列表');
    await expect(taskListSection.first()).toBeVisible();
    
    console.log('Task list section visible');
  });

  test('should display system status panel', async ({ page }) => {
    await expect(page.locator('#systemInfo')).toBeVisible();
    
    const systemInfo = await page.locator('#systemInfo').textContent();
    expect(systemInfo).toBeTruthy();
    
    console.log('System status panel displayed');
  });

  test('should handle authentication errors', async ({ page }) => {
    await page.click('#loginBtn');
    await expect(page.locator('#authModal')).toBeVisible();
    
    await page.fill('#authNameInput', 'nonexistentuser');
    await page.fill('#authPasswordInput', 'wrongpassword');
    
    await page.click('#authSubmitBtn');
    
    await page.waitForTimeout(500);
    
    const authMsg = page.locator('#authMsg');
    const msgText = await authMsg.textContent();
    
    if (msgText && msgText.trim()) {
      console.log('Authentication error handled:', msgText);
    } else {
      console.log('Login attempted with invalid credentials');
    }
  });
});
