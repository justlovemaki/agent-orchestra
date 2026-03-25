/**
 * Users API Tests
 * Tests for user authentication and management endpoints
 */

const assert = require('assert');
const { get, post, setAuthToken, clearAuthToken } = require('../helpers');

/**
 * Run all users API tests
 * @param {string} baseUrl - Base URL of the test server
 */
async function runTests(baseUrl) {
  const base = baseUrl || 'http://127.0.0.1:3211';
  
  console.log('  Users API Tests:');
  
  try {
    clearAuthToken();
    
    const userData = {
      name: `testuser_${Date.now()}`,
      password: 'testpass123'
    };
    
    let response = await post(`${base}/api/auth/register`, userData);
    assert.strictEqual(response.status, 201, 'Registration should return 201');
    assert(response.body.user, 'Response should have user');
    assert(response.body.token, 'Response should have token');
    assert.strictEqual(response.body.user.name, userData.name, 'User name should match');
    console.log('    ✓ POST /api/auth/register returns 201 with user and token');
    
    const duplicateUser = {
      name: `duplicateuser_${Date.now()}`,
      password: 'testpass123'
    };
    
    await post(`${base}/api/auth/register`, duplicateUser);
    response = await post(`${base}/api/auth/register`, duplicateUser);
    assert.strictEqual(response.status >= 400, true, 'Duplicate user should return error');
    console.log('    ✓ POST /api/auth/register rejects duplicate username');
    
    const invalidData = {
      name: '',
      password: 'testpass123'
    };
    
    response = await post(`${base}/api/auth/register`, invalidData);
    assert.strictEqual(response.status >= 400, true, 'Empty username should return error');
    console.log('    ✓ POST /api/auth/register rejects empty username');
    
    const shortPassData = {
      name: `testuser2_${Date.now()}`,
      password: 'abc'
    };
    
    response = await post(`${base}/api/auth/register`, shortPassData);
    assert.strictEqual(response.status >= 400, true, 'Short password should return error');
    console.log('    ✓ POST /api/auth/register rejects short password');
    
    const loginUser = {
      name: `logintest_${Date.now()}`,
      password: 'testpass123'
    };
    
    await post(`${base}/api/auth/register`, loginUser);
    
    const loginData = {
      name: loginUser.name,
      password: loginUser.password
    };
    
    response = await post(`${base}/api/auth/login`, loginData);
    assert.strictEqual(response.status, 200, 'Login should return 200');
    assert(response.body.user, 'Response should have user');
    assert(response.body.token, 'Response should have token');
    console.log('    ✓ POST /api/auth/login returns 200 with user and token');
    
    const wrongPassLogin = {
      name: loginUser.name,
      password: 'wrongpass'
    };
    
    response = await post(`${base}/api/auth/login`, wrongPassLogin);
    assert.strictEqual(response.status >= 400, true, 'Wrong password should return error');
    console.log('    ✓ POST /api/auth/login rejects wrong password');
    
    const nonExistentLogin = {
      name: 'nonexistentuser',
      password: 'anypassword'
    };
    
    response = await post(`${base}/api/auth/login`, nonExistentLogin);
    assert.strictEqual(response.status >= 400, true, 'Non-existent user should return error');
    console.log('    ✓ POST /api/auth/login rejects non-existent user');
    
    response = await get(`${base}/api/auth/me`);
    assert.strictEqual(response.status, 401, 'Unauthenticated request should return 401');
    console.log('    ✓ GET /api/auth/me without auth returns 401');
    
    const authUser = {
      name: `authtest_${Date.now()}`,
      password: 'testpass123'
    };
    
    const registerResponse = await post(`${base}/api/auth/register`, authUser);
    setAuthToken(registerResponse.body.token);
    
    response = await get(`${base}/api/auth/me`);
    assert.strictEqual(response.status, 200, 'Authenticated request should return 200');
    assert(response.body.user, 'Response should have user');
    console.log('    ✓ GET /api/auth/me with valid token returns 200');
    
    setAuthToken('invalid-token-12345');
    response = await get(`${base}/api/auth/me`);
    assert.strictEqual(response.status, 401, 'Invalid token should return 401');
    console.log('    ✓ GET /api/auth/me with invalid token returns 401');
    
    clearAuthToken();
    
    const logoutUser = {
      name: `logouttest_${Date.now()}`,
      password: 'testpass123'
    };
    
    const logoutRegister = await post(`${base}/api/auth/register`, logoutUser);
    setAuthToken(logoutRegister.body.token);
    
    response = await post(`${base}/api/auth/logout`, {});
    assert.strictEqual(response.status, 200, 'Logout should return 200');
    console.log('    ✓ POST /api/auth/logout returns 200');
    
    clearAuthToken();
    
    response = await get(`${base}/api/users/me/permissions`);
    assert.strictEqual(response.status, 401, 'Unauthenticated request should return 401');
    console.log('    ✓ GET /api/users/me/permissions without auth returns 401');
    
    const permUser = {
      name: `permtest_${Date.now()}`,
      password: 'testpass123'
    };
    
    const permRegister = await post(`${base}/api/auth/register`, permUser);
    setAuthToken(permRegister.body.token);
    
    response = await get(`${base}/api/users/me/permissions`);
    assert.strictEqual(response.status, 200, 'Permissions request should return 200');
    assert(Array.isArray(response.body.permissions), 'Should have permissions array');
    console.log('    ✓ GET /api/users/me/permissions with valid token returns 200');
    
    const regularUser = {
      name: `regularuser_${Date.now()}`,
      password: 'testpass123'
    };
    
    const regularRegister = await post(`${base}/api/auth/register`, regularUser);
    setAuthToken(regularRegister.body.token);
    
    response = await get(`${base}/api/users`);
    assert.strictEqual(response.status >= 400, true, 'Non-admin should not access users list');
    console.log('    ✓ GET /api/users requires admin privileges');
    
    const getUser = {
      name: `getuser_${Date.now()}`,
      password: 'testpass123'
    };
    
    const getUserRegister = await post(`${base}/api/auth/register`, getUser);
    const userId = getUserRegister.body.user.id;
    
    response = await get(`${base}/api/users/${userId}`);
    assert.strictEqual(response.status, 200, 'Get user should return 200');
    assert(response.body.user, 'Response should have user');
    console.log('    ✓ GET /api/users/:id returns user data');
    
    clearAuthToken();
    
  } catch (err) {
    clearAuthToken();
    throw new Error(`Users API tests failed: ${err.message}`);
  }
}

module.exports = { runTests };