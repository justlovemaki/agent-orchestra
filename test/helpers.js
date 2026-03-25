/**
 * Test Helpers
 * HTTP request wrapper functions for API testing
 */

const http = require('http');

let authToken = null;

/**
 * Set auth token for subsequent requests
 * @param {string} token - JWT or auth token
 */
function setAuthToken(token) {
  authToken = token;
}

/**
 * Get current auth token
 * @returns {string|null}
 */
function getAuthToken() {
  return authToken;
}

/**
 * Clear auth token
 */
function clearAuthToken() {
  authToken = null;
}

/**
 * Make HTTP request
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} url - Full URL
 * @param {Object} body - Request body (optional)
 * @param {Object} headers - Additional headers (optional)
 * @returns {Promise<{status: number, body: Object, headers: Object}>}
 */
function request(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        let parsedBody = data;
        try {
          parsedBody = JSON.parse(data);
        } catch {
          // Not JSON, keep as string
        }
        
        resolve({
          status: res.statusCode,
          body: parsedBody,
          headers: res.headers
        });
      });
    });
    
    req.on('error', reject);
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * GET request
 * @param {string} url - Full URL
 * @param {Object} headers - Additional headers
 * @returns {Promise}
 */
function get(url, headers = {}) {
  return request('GET', url, null, headers);
}

/**
 * POST request
 * @param {string} url - Full URL
 * @param {Object} body - Request body
 * @param {Object} headers - Additional headers
 * @returns {Promise}
 */
function post(url, body, headers = {}) {
  return request('POST', url, body, headers);
}

/**
 * PUT request
 * @param {string} url - Full URL
 * @param {Object} body - Request body
 * @param {Object} headers - Additional headers
 * @returns {Promise}
 */
function put(url, body, headers = {}) {
  return request('PUT', url, body, headers);
}

/**
 * DELETE request
 * @param {string} url - Full URL
 * @param {Object} headers - Additional headers
 * @returns {Promise}
 */
function del(url, headers = {}) {
  return request('DELETE', url, null, headers);
}

/**
 * Assert helper functions
 */
const assertHelper = {
  /**
   * Assert HTTP status equals expected
   */
  assertStatus: (response, expectedStatus, message = '') => {
    if (response.status !== expectedStatus) {
      throw new Error(`${message} Expected status ${expectedStatus}, got ${response.status}. Body: ${JSON.stringify(response.body)}`);
    }
  },
  
  /**
   * Assert response body has property
   */
  assertHasProperty: (response, property, message = '') => {
    if (!response.body || typeof response.body !== 'object') {
      throw new Error(`${message} Response body is not an object: ${JSON.stringify(response.body)}`);
    }
    if (!(property in response.body)) {
      throw new Error(`${message} Response body missing property: ${property}`);
    }
  },
  
  /**
   * Assert response body equals expected
   */
  assertBody: (response, expected, message = '') => {
    if (JSON.stringify(response.body) !== JSON.stringify(expected)) {
      throw new Error(`${message} Body mismatch. Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(response.body)}`);
    }
  },
  
  /**
   * Assert response contains expected in body
   */
  assertContains: (response, expected, message = '') => {
    const bodyStr = JSON.stringify(response.body);
    if (!bodyStr.includes(JSON.stringify(expected))) {
      throw new Error(`${message} Body does not contain: ${JSON.stringify(expected)}`);
    }
  }
};

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  request,
  get,
  post,
  put,
  del,
  assert: assertHelper,
  wait
};