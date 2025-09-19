import { Request } from 'express';
/**
 * Extended Express Request type for NDJSON streaming endpoints.
 * Replaces the standard body property with an AsyncGenerator that yields
 * parsed NDJSON objects of type T.
 *
 * @template T - The type of objects yielded by the NDJSON stream
 */
export interface NdJsonStreamRequest<T = any> extends Request {
  /**
   * AsyncGenerator that yields parsed NDJSON objects.
   * Each iteration returns the next parsed object from the stream.
   */
   body: AsyncGenerator<T>;

  /**
   * The batch size for processing streamed objects.
   * This value is set by the decorator based on the provided options.
   */
  batchSize: number;
}
