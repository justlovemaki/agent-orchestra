'use strict';

/**
 * API Validation Middleware
 * 
 * Validates incoming requests against OpenAPI 3.0 specification.
 * Provides request parameter, query, and body validation.
 */

const apiDocs = require('./api-docs');

/**
 * Create validation middleware for a specific port
 */
function createValidator(port) {
  const spec = apiDocs.getOpenAPISpec(port);
  const pathIndex = buildPathIndex(spec);
  
  return {
    validateRequest,
    getPathParams,
    getOperationInfo
  };
  
  /**
   * Build an index of paths for fast lookup
   */
  function buildPathIndex(spec) {
    const index = new Map();
    
    for (const [path, methods] of Object.entries(spec.paths)) {
      // Convert OpenAPI path template to regex
      const { regex, paramNames } = pathToRegex(path);
      
      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          index.set(`${method.toUpperCase()} ${path}`, {
            regex,
            paramNames,
            operation,
            pathTemplate: path
          });
        }
      }
    }
    
    return index;
  }
  
  /**
   * Convert OpenAPI path template to regex
   * e.g., /api/tasks/{id} -> /^\/api\/tasks\/([^/]+)$/
   */
  function pathToRegex(pathTemplate) {
    const paramNames = [];
    
    // First escape regex special characters (except { })
    let regexStr = pathTemplate
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Then replace escaped {param} with capture group
      .replace(/\\{(\w+)\\}/g, (match, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      });
    
    return {
      regex: new RegExp(`^${regexStr}$`),
      paramNames
    };
  }
  
  /**
   * Get operation info for a request
   */
  function getOperationInfo(method, pathname) {
    for (const [key, info] of pathIndex.entries()) {
      const [opMethod] = key.split(' ');
      if (opMethod !== method) continue;
      
      const match = pathname.match(info.regex);
      if (match) {
        return {
          operation: info.operation,
          pathTemplate: info.pathTemplate,
          pathParams: extractPathParams(info.paramNames, match)
        };
      }
    }
    
    return null;
  }
  
  /**
   * Extract path parameters from regex match
   */
  function extractPathParams(paramNames, match) {
    const params = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }
    return params;
  }
  
  /**
   * Get path parameters from request
   */
  function getPathParams(method, pathname) {
    const info = getOperationInfo(method, pathname);
    return info ? info.pathParams : {};
  }
  
  /**
   * Validate request against OpenAPI spec
   * Returns { valid, errors, warnings }
   */
  function validateRequest(method, pathname, query = {}, body = null, headers = {}) {
    const errors = [];
    const warnings = [];
    
    const info = getOperationInfo(method, pathname);
    if (!info) {
      // Path not in spec - skip validation (might be static file, etc.)
      return { valid: true, errors: [], warnings: [], operation: null };
    }
    
    const { operation, pathParams } = info;
    
    // Validate path parameters
    if (operation.parameters) {
      const pathParamsSpec = operation.parameters.filter(p => p.in === 'path');
      for (const param of pathParamsSpec) {
        const value = pathParams[param.name];
        if (param.required && !value) {
          errors.push(`Missing required path parameter: ${param.name}`);
        } else if (value && param.schema) {
          const typeError = validateType(value, param.schema, param.name);
          if (typeError) errors.push(typeError);
        }
      }
      
      // Validate query parameters
      const queryParamsSpec = operation.parameters.filter(p => p.in === 'query');
      for (const param of queryParamsSpec) {
        const value = query[param.name];
        if (param.required && value === undefined) {
          errors.push(`Missing required query parameter: ${param.name}`);
        } else if (value !== undefined && param.schema) {
          const typeError = validateType(value, param.schema, param.name);
          if (typeError) errors.push(typeError);
        }
      }
    }
    
    // Validate request body
    if (body !== null && operation.requestBody) {
      const bodyValidation = validateRequestBody(body, operation.requestBody);
      errors.push(...bodyValidation.errors);
      warnings.push(...bodyValidation.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      operation: info.operation
    };
  }
  
  /**
   * Validate a value against a schema
   */
  function validateType(value, schema, paramName) {
    const type = schema.type;
    
    if (type === 'integer') {
      const num = Number(value);
      if (!Number.isInteger(num)) {
        return `Parameter '${paramName}' must be an integer`;
      }
      if (schema.minimum !== undefined && num < schema.minimum) {
        return `Parameter '${paramName}' must be >= ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && num > schema.maximum) {
        return `Parameter '${paramName}' must be <= ${schema.maximum}`;
      }
    } else if (type === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        return `Parameter '${paramName}' must be a number`;
      }
    } else if (type === 'boolean') {
      if (value !== 'true' && value !== 'false' && typeof value !== 'boolean') {
        return `Parameter '${paramName}' must be a boolean`;
      }
    } else if (type === 'string') {
      if (typeof value !== 'string') {
        return `Parameter '${paramName}' must be a string`;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        return `Parameter '${paramName}' must be one of: ${schema.enum.join(', ')}`;
      }
    }
    
    return null;
  }
  
  /**
   * Validate request body against requestBody spec
   */
  function validateRequestBody(body, requestBody) {
    const errors = [];
    const warnings = [];
    
    const content = requestBody.content;
    if (!content) return { errors, warnings };
    
    // Prefer application/json
    const jsonSchema = content['application/json']?.schema;
    if (!jsonSchema) return { errors, warnings };
    
    // Validate required fields
    if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
      for (const field of jsonSchema.required) {
        if (body[field] === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    // Validate field types
    if (jsonSchema.properties) {
      for (const [field, schema] of Object.entries(jsonSchema.properties)) {
        const value = body[field];
        if (value !== undefined) {
          const typeError = validateField(value, schema, field);
          if (typeError) errors.push(typeError);
        }
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate a field value against schema
   */
  function validateField(value, schema, fieldName) {
    const type = schema.type;
    
    if (type === 'string' && typeof value !== 'string') {
      return `Field '${fieldName}' must be a string`;
    }
    if (type === 'integer' && !Number.isInteger(value)) {
      return `Field '${fieldName}' must be an integer`;
    }
    if (type === 'number' && typeof value !== 'number') {
      return `Field '${fieldName}' must be a number`;
    }
    if (type === 'boolean' && typeof value !== 'boolean') {
      return `Field '${fieldName}' must be a boolean`;
    }
    if (type === 'array' && !Array.isArray(value)) {
      return `Field '${fieldName}' must be an array`;
    }
    if (type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      return `Field '${fieldName}' must be an object`;
    }
    
    return null;
  }
}

/**
 * Create middleware wrapper for route registration
 */
function createValidationMiddleware(port) {
  const validator = createValidator(port);
  
  return {
    validator,
    
    /**
     * Wrap a route handler with validation
     */
    wrap(handler) {
      return async (req, res, deps) => {
        const { pathname, parsed } = deps.parseRequest(req);
        const method = req.method;
        
        // Parse query and body
        const query = parsed.query || {};
        let body = null;
        
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          try {
            body = await deps.readJson(req);
          } catch (e) {
            // Body parsing failed, will be handled by route
          }
        }
        
        // Validate request
        const validation = validator.validateRequest(method, pathname, query, body);
        
        if (!validation.valid && validation.operation) {
          // Only return error if path is in spec
          return deps.json(res, 400, {
            error: 'Validation failed',
            details: validation.errors
          });
        }
        
        // Add validation info to request for downstream use
        req.validation = validation;
        req.pathParams = validation.operation ? validation.pathParams : {};
        
        return handler(req, res, deps);
      };
    }
  };
}

module.exports = {
  createValidator,
  createValidationMiddleware
};
