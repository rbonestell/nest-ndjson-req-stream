import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { NdJsonStreamParser } from '../services/ndjson-stream-parser.service';
import { NdJsonStreamRequest } from '../types/ndjson-stream';

/**
 * Options for the NdJsonStream decorator
 */
export interface NdJsonStreamOptions {
  /**
   * The batch size for processing streamed objects.
   * Defaults to 25 if not specified.
   */
  batchSize?: number;
}

/**
 * Parameter decorator for handling NDJSON streaming requests.
 * Automatically parses incoming application/x-ndjson requests and provides
 * an AsyncGenerator in the request body for consuming the stream.
 *
 * @template T - The type of objects expected in the NDJSON stream
 * @param options - Optional configuration for stream processing
 * @returns A parameter decorator that transforms the request
 */
export const NdJsonStreamReq = createParamDecorator(
  <T = any>(data: NdJsonStreamOptions | undefined, ctx: ExecutionContext): NdJsonStreamRequest<T> => {
  	const request = ctx.switchToHttp().getRequest<Request>();
  	const batchSize = data?.batchSize ?? 25; // Default to 25 if not specified

  	// Validate content-type
  	const contentType: string = request.headers['content-type'];
  	if (!contentType.toLowerCase().includes('application/x-ndjson')) {
  		throw new BadRequestException(
  			`Invalid content-type: ${contentType}. Expected application/x-ndjson`
  		);
  	}

  	// Create the AsyncGenerator for the body
  	const asyncGenerator = NdJsonStreamParser.parseStream<T>(request);

  	// Cast the request and replace the body with our AsyncGenerator
  	const streamRequest = request as NdJsonStreamRequest<T>;
  	streamRequest.body = asyncGenerator;

  	// Attach batchSize to the request for downstream use
  	streamRequest.batchSize = batchSize;

  	return streamRequest;
  },
);
