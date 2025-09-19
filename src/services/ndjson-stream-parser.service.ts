import { Injectable } from '@nestjs/common';
import { Transform } from 'stream';

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

		return new Transform({
			objectMode: true,
			transform(chunk: Buffer, encoding, callback) {
				buffer += chunk.toString();
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
							this.emit(`Error occurred parsing stream item ${itemCount}: ${error.message}`);
						}
					}
				}
				callback();
			},

			flush(callback) {
				// Process any remaining data
				if (buffer.trim()) {
					try {
						this.push(JSON.parse(buffer));
					} catch (error) {
						this.emit(`Error occurred parsing stream item ${itemCount}: ${error.message}`);
					}
				}
				callback();
			}
		});
	}

	/**
	 * Parses a readable stream as NDJSON and yields parsed objects
	 * @template T - The type of objects in the NDJSON stream
	 * @param stream - The readable stream containing NDJSON data
	 * @returns An async generator that yields parsed objects
	 */
	static async* parseStream<T>(stream: NodeJS.ReadableStream): AsyncGenerator<T> {
		const parser = this.createParser<T>();

		// Handle parse errors
		const errors: any[] = [];
		parser.on('parse-error', (error) => errors.push(error));

		stream.pipe(parser);

		for await (const item of parser) {
			yield item as T;
		}

		if (errors.length > 0) {
			// You can handle errors as needed
			console.warn('Parse errors encountered:', errors);
		}
	}
}
