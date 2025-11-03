import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * HTTP Request Action Handler
 * Makes HTTP requests to external APIs
 */
@Injectable()
export class HttpActionHandler extends BaseActionHandler {
  readonly type = 'http_request';
  readonly name = 'HTTP Request';

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    const {
      method = 'GET',
      url,
      headers = {},
      body,
      queryParams = {},
      auth,
      timeout = 30000,
    } = config;

    if (!url) {
      throw new Error('HTTP Request action requires a URL');
    }

    // Resolve template variables in URL, headers, and body
    const resolvedUrl = this.resolveTemplate(url, context);
    const resolvedHeaders = this.resolveTemplateObject(headers, context);
    const resolvedBody = body ? this.resolveTemplate(body, context) : undefined;
    const resolvedQueryParams = this.resolveTemplateObject(queryParams, context);

    // Configure axios request
    const axiosConfig: AxiosRequestConfig = {
      method: method.toUpperCase(),
      url: resolvedUrl,
      headers: resolvedHeaders,
      timeout,
      params: resolvedQueryParams,
    };

    // Add authentication if provided
    if (auth) {
      if (auth.type === 'bearer') {
        const token = this.resolveTemplate(auth.token, context);
        axiosConfig.headers = {
          ...axiosConfig.headers,
          Authorization: `Bearer ${token}`,
        };
      } else if (auth.type === 'basic') {
        const username = this.resolveTemplate(auth.username, context);
        const password = this.resolveTemplate(auth.password, context);
        axiosConfig.auth = { username, password };
      } else if (auth.type === 'apiKey') {
        const key = this.resolveTemplate(auth.key, context);
        const value = this.resolveTemplate(auth.value, context);
        axiosConfig.headers = {
          ...axiosConfig.headers,
          [key]: value,
        };
      }
    }

    // Add body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && resolvedBody) {
      axiosConfig.data = resolvedBody;
    }

    try {
      const response: AxiosResponse = await axios(axiosConfig);
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      };
    } catch (error: any) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(
          `HTTP Request failed: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`,
        );
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error(`HTTP Request failed: No response received - ${error.message}`);
      } else {
        // Something happened in setting up the request
        throw new Error(`HTTP Request failed: ${error.message}`);
      }
    }
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config.url) {
      throw new Error('HTTP Request action requires a URL');
    }
    return true;
  }

  /**
   * Resolve template variables like {{step.1.output.data}} or {{trigger.email}}
   */
  private resolveTemplate(template: string, context: ExecutionContext): any {
    if (typeof template !== 'string') {
      return template;
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let value: any = context;

      for (const part of parts) {
        if (value === null || value === undefined) {
          return match; // Return original if path not found
        }
        value = value[part];
      }

      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  /**
   * Resolve template variables in an object
   */
  private resolveTemplateObject(obj: Record<string, any>, context: ExecutionContext): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = typeof value === 'string' ? this.resolveTemplate(value, context) : value;
    }
    return resolved;
  }
}

