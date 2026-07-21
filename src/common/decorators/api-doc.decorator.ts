import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

interface ApiDocOptions {
  summary: string;
  bodyType?: any;
  responses: {
    success: {
      status: number;
      description: string;
      type?: any;
      schema?: any;
    };
    errors?: Array<{
      status: number;
      description: string;
    }>;
  };
  requiresAuth?: boolean;
}

export function ApiDoc(options: ApiDocOptions) {
  const decorators = [ApiOperation({ summary: options.summary })];

  if (options.bodyType) {
    decorators.push(ApiBody({ type: options.bodyType }));
  }

  // Success response
  if (options.responses.success.type) {
    decorators.push(
      ApiResponse({
        status: options.responses.success.status,
        description: options.responses.success.description,
        type: options.responses.success.type,
      }),
    );
  } else if (options.responses.success.schema) {
    decorators.push(
      ApiResponse({
        status: options.responses.success.status,
        description: options.responses.success.description,
        schema: options.responses.success.schema,
      }),
    );
  }

  // Error responses
  if (options.responses.errors) {
    options.responses.errors.forEach((error) => {
      decorators.push(
        ApiResponse({
          status: error.status,
          description: error.description,
        }),
      );
    });
  }

  if (options.requiresAuth) {
    decorators.push(ApiBearerAuth('access-token'));
  }

  return applyDecorators(...decorators);
}
