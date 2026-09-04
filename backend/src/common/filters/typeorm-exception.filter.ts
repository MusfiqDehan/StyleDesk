import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const code = exception.driverError?.code ?? exception.code;
    // PostgreSQL unique violation error code
    if (code === '23505') {
      const detail = exception.detail || '';
      let message = 'Duplicate entry';

      if (detail.includes('phone')) {
        message = 'phone number already exists';
      } else if (detail.includes('email')) {
        message = 'email is already exists';
      }

      return response.status(409).json({
        statusCode: 409,
        message: message,
        error: 'Conflict',
      });
    }

    if (
      code === 'P0001' &&
      [
        'Account limit reached',
        'Cannot remove last tenant owner',
        'Cannot demote last tenant owner',
      ].includes(exception.message)
    ) {
      const forbidden = exception.message.includes('owner');
      return response
        .status(forbidden ? 403 : 409)
        .json({
          statusCode: forbidden ? 403 : 409,
          message: exception.message,
        });
    }
    // Default to 500 for other query failures
    return response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Database operation failed',
    });
  }
}
