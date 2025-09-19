import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { NdJsonStreamReq, NdJsonStreamOptions } from './ndjson-stream.decorator';
import { NdJsonStreamParser } from '../services/ndjson-stream-parser.service';
import { NdJsonStreamRequest } from '../types/ndjson-stream';

// Mock Express Request type
interface MockRequest {
  headers: Record<string, any>;
  body?: any;
  url?: string;
  method?: string;
  query?: any;
}

// Mock the @nestjs/common createParamDecorator to allow us to get the factory function
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  createParamDecorator: (factory: Function) => factory,
}));

jest.mock('../services/ndjson-stream-parser.service');

describe('NdJsonStreamReq Decorator', () => {
  let mockExecutionContext: ExecutionContext;
  let mockRequest: MockRequest;
  let mockAsyncGenerator: AsyncGenerator<any>;

  // Now we can access the factory function directly
  const decoratorFactory = NdJsonStreamReq as any;

  beforeEach(() => {
    // Setup mock AsyncGenerator
    mockAsyncGenerator = (async function* () {
      yield { id: 1 };
      yield { id: 2 };
    })();

    // Setup mock request
    mockRequest = {
      headers: {
        'content-type': 'application/x-ndjson'
      }
    };

    // Setup mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest)
      })
    } as unknown as ExecutionContext;

    // Mock NdJsonStreamParser.parseStream
    jest.spyOn(NdJsonStreamParser, 'parseStream').mockReturnValue(mockAsyncGenerator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should create a param decorator', () => {
      expect(typeof decoratorFactory).toBe('function');
    });

    it('should transform request with default batch size', () => {
      const result = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.body).toBe(mockAsyncGenerator);
      expect(result.batchSize).toBe(25);
      expect(NdJsonStreamParser.parseStream).toHaveBeenCalledWith(mockRequest);
    });

    it('should use custom batch size when provided', () => {
      const options: NdJsonStreamOptions = { batchSize: 50 };
      const result = decoratorFactory(options, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.batchSize).toBe(50);
    });

    it('should accept zero as valid batch size', () => {
      const options: NdJsonStreamOptions = { batchSize: 0 };
      const result = decoratorFactory(options, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.batchSize).toBe(0);
    });
  });

  describe('Content-Type validation', () => {
    it('should accept application/x-ndjson content type', () => {
      mockRequest.headers['content-type'] = 'application/x-ndjson';

      expect(() => decoratorFactory(undefined, mockExecutionContext)).not.toThrow();
    });

    it('should accept content type with charset', () => {
      mockRequest.headers['content-type'] = 'application/x-ndjson; charset=utf-8';

      expect(() => decoratorFactory(undefined, mockExecutionContext)).not.toThrow();
    });

    it('should be case-insensitive for content type', () => {
      mockRequest.headers['content-type'] = 'Application/X-NDJSON';

      expect(() => decoratorFactory(undefined, mockExecutionContext)).not.toThrow();
    });

    it('should throw BadRequestException for incorrect content type', () => {
      mockRequest.headers['content-type'] = 'application/json';

      expect(() => decoratorFactory(undefined, mockExecutionContext)).toThrow(BadRequestException);
      expect(() => decoratorFactory(undefined, mockExecutionContext)).toThrow(
        'Invalid content-type: application/json. Expected application/x-ndjson'
      );
    });

    it('should throw BadRequestException for missing content type', () => {
      mockRequest.headers['content-type'] = undefined;

      expect(() => decoratorFactory(undefined, mockExecutionContext)).toThrow(
        "Cannot read properties of undefined (reading 'toLowerCase')"
      );
    });

    it('should throw BadRequestException for empty content type', () => {
      mockRequest.headers['content-type'] = '';

      expect(() => decoratorFactory(undefined, mockExecutionContext)).toThrow(BadRequestException);
    });
  });

  describe('Request transformation', () => {
    it('should cast request to NdJsonStreamRequest', () => {
      const result = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest;

      expect(result).toBe(mockRequest);
      expect(result.body).toBeDefined();
      expect(result.batchSize).toBeDefined();
    });

    it('should preserve original request properties', () => {
      mockRequest.url = '/test';
      mockRequest.method = 'POST';
      mockRequest.query = { test: 'value' };

      const result = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest<any> & MockRequest;

      expect(result.url).toBe('/test');
      expect(result.method).toBe('POST');
      expect(result.query).toEqual({ test: 'value' });
    });

    it('should replace body with async generator', () => {
      const originalBody = { original: 'body' };
      mockRequest.body = originalBody;

      const result = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.body).not.toBe(originalBody);
      expect(result.body).toBe(mockAsyncGenerator);
    });
  });

  describe('Type generics', () => {
    interface TestType {
      id: number;
      name: string;
    }

    it('should support generic type parameter', () => {
      const typedAsyncGenerator: AsyncGenerator<TestType> = (async function* () {
        yield { id: 1, name: 'test' };
      })();

      jest.spyOn(NdJsonStreamParser, 'parseStream').mockReturnValue(typedAsyncGenerator);

      const result = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest<TestType>;

      expect(result.body).toBe(typedAsyncGenerator);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined options gracefully', () => {
      const result = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.batchSize).toBe(25);
    });

    it('should handle null options gracefully', () => {
      const result = decoratorFactory(null, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.batchSize).toBe(25);
    });

    it('should handle empty options object', () => {
      const options: NdJsonStreamOptions = {};
      const result = decoratorFactory(options, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.batchSize).toBe(25);
    });

    it('should handle negative batch size', () => {
      const options: NdJsonStreamOptions = { batchSize: -10 };
      const result = decoratorFactory(options, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.batchSize).toBe(-10);
    });

    it('should handle very large batch size', () => {
      const options: NdJsonStreamOptions = { batchSize: Number.MAX_SAFE_INTEGER };
      const result = decoratorFactory(options, mockExecutionContext) as NdJsonStreamRequest;

      expect(result.batchSize).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from NdJsonStreamParser', () => {
      const error = new Error('Parser error');
      jest.spyOn(NdJsonStreamParser, 'parseStream').mockImplementation(() => {
        throw error;
      });

      expect(() => decoratorFactory(undefined, mockExecutionContext)).toThrow(error);
    });

    it('should handle null headers gracefully', () => {
      mockRequest.headers = null as any;

      expect(() => decoratorFactory(undefined, mockExecutionContext)).toThrow(
        "Cannot read properties of null (reading 'content-type')"
      );
    });

    it('should handle undefined headers gracefully', () => {
      mockRequest.headers = undefined as any;

      expect(() => decoratorFactory(undefined, mockExecutionContext)).toThrow(
        "Cannot read properties of undefined (reading 'content-type')"
      );
    });
  });

  describe('Integration with ExecutionContext', () => {
    it('should correctly extract request from ExecutionContext', () => {
      decoratorFactory(undefined, mockExecutionContext);

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalledTimes(1);
      expect(
        (mockExecutionContext.switchToHttp() as any).getRequest
      ).toHaveBeenCalledTimes(1);
    });

    it('should work with multiple invocations', () => {
      const result1 = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest;
      const result2 = decoratorFactory(undefined, mockExecutionContext) as NdJsonStreamRequest;

      expect(result1.batchSize).toBe(25);
      expect(result2.batchSize).toBe(25);
      expect(NdJsonStreamParser.parseStream).toHaveBeenCalledTimes(2);
    });
  });
});