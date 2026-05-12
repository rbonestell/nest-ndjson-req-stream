import { Injectable } from '@nestjs/common';
import { Transform } from 'stream';
import { StringDecoder } from 'node:string_decoder';

/**
 * Class for parsing NDJSON (Newline Delimited JSON) streams.
 * Handles streaming JSON data where each line is a separate JSON object.
 */
@Injectable()
export class NdJsonStreamParser {

	/**
	 * Creates a Transform stream that parses NDJSON data
	 * @template T - The type of objects in the NDJSON stream
	 * @returns A Transform stream that emits parsed objects
	 */
	static createParser<T>(): Transform {
		let buffer = '';
		let itemCount = 0;
		const decoder = new StringDecoder('utf8');

		return new Transform({
			objectMode: true,
			transform(chunk: Buffer, encoding, callback) {
				buffer += decoder.write(chunk);
				const lines = buffer.split('\n');

				// Keep last incomplete line in buffer
				buffer = lines.pop() || '';

				for (const line of lines) {
					itemCount++;
					if (line.trim()) {
						try {
							const parsed = JSON.parse(line) as T;
							this.push(parsed);
						} catch (error) {
							return callback(Object.assign(
								new Error(`Failed to parse NDJSON line ${itemCount}: ${(error as Error).message}`),
								{ line, itemNumber: itemCount, cause: error },
							));
						}
					}
				}
				callback();
			},

			flush(callback) {
				buffer += decoder.end();
				if (buffer.trim()) {
					try {
						this.push(JSON.parse(buffer));
					} catch (error) {
						return callback(Object.assign(
							new Error(`Failed to parse NDJSON line ${itemCount}: ${(error as Error).message}`),
							{ line: buffer, itemNumber: itemCount, cause: error },
						));
					}
				}
				callback();
			}
		});
	}

	/**
	 * Parses a readable stream as NDJSON and yields parsed objects.
	 *
	 * On any exit path (normal completion, consumer `break`, consumer `throw`,
	 * or upstream error) the parser is unpiped from the source and both streams
	 * are destroyed. Without this teardown, an aborted consumer would leave the
	 * source stream piped with no drain, leaking the underlying socket and any
	 * intermediate buffers (e.g. a gunzip PassThrough).
	 *
	 * @template T - The type of objects in the NDJSON stream
	 * @param stream - The readable stream containing NDJSON data
	 * @returns An async generator that yields parsed objects
	 */
	static async* parseStream<T>(stream: NodeJS.ReadableStream): AsyncGenerator<T> {
		const parser = this.createParser<T>();
		stream.pipe(parser);
		try {
			for await (const item of parser) {
				yield item as T;
			}
		} finally {
			stream.unpipe(parser);
			if (!parser.destroyed) parser.destroy();
			const src = stream as NodeJS.ReadableStream & { destroyed?: boolean; destroy?: (err?: Error) => void };
			if (typeof src.destroy === 'function' && !src.destroyed) src.destroy();
		}
	}
}
