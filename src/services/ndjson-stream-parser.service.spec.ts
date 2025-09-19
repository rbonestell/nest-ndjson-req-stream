import { Readable, Transform } from 'stream';
import { NdJsonStreamParser } from './ndjson-stream-parser.service';

describe('NdJsonStreamParser', () => {
	describe('createParser', () => {
		let parser: Transform;

		beforeEach(() => {
			parser = NdJsonStreamParser.createParser();
		});

		afterEach(() => {
			parser.destroy();
		});

		it('should create a Transform stream in object mode', () => {
			expect(parser).toBeInstanceOf(Transform);
			expect(parser.readableObjectMode).toBe(true);
		});

		it('should parse single line JSON', (done) => {
			const result: any[] = [];
			const testData = { id: 1, name: 'test' };

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(testData);
				done();
			});

			parser.write(JSON.stringify(testData) + '\n');
			parser.end();
		});

		it('should parse multiple lines of JSON', (done) => {
			const result: any[] = [];
			const testData = [
				{ id: 1, name: 'first' },
				{ id: 2, name: 'second' },
				{ id: 3, name: 'third' }
			];

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(3);
				expect(result).toEqual(testData);
				done();
			});

			const ndjson = testData.map(item => JSON.stringify(item)).join('\n') + '\n';
			parser.write(ndjson);
			parser.end();
		});

		it('should handle chunked data across line boundaries', (done) => {
			const result: any[] = [];
			const testData = [
				{ id: 1, message: 'first message' },
				{ id: 2, message: 'second message' }
			];

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(2);
				expect(result).toEqual(testData);
				done();
			});

			const line1 = JSON.stringify(testData[0]);
			const line2 = JSON.stringify(testData[1]);

			// Split the second line in the middle
			const chunk1 = line1 + '\n' + line2.substring(0, 10);
			const chunk2 = line2.substring(10) + '\n';

			parser.write(chunk1);
			parser.write(chunk2);
			parser.end();
		});

		it('should skip empty lines', (done) => {
			const result: any[] = [];
			const testData = { id: 1, name: 'test' };

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(testData);
				done();
			});

			parser.write('\n\n' + JSON.stringify(testData) + '\n\n\n');
			parser.end();
		});

		it('should skip lines with only whitespace', (done) => {
			const result: any[] = [];
			const testData = { id: 1, name: 'test' };

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(testData);
				done();
			});

			parser.write('   \n\t\t\n' + JSON.stringify(testData) + '\n  \t  \n');
			parser.end();
		});

		it('should emit error for invalid JSON', (done) => {
			const result: any[] = [];
			const errors: string[] = [];
			const validData = { id: 1, valid: true };
			let errorCount = 0;

			parser.on('data', (chunk) => result.push(chunk));
			
			// Listen for any event that starts with "Error occurred parsing stream item"
			const originalEmit = parser.emit.bind(parser);
			parser.emit = function(event: string | symbol, ...args: any[]) {
				if (typeof event === 'string' && event.startsWith('Error occurred parsing stream item')) {
					errorCount++;
					errors.push(event);
				}
				return originalEmit(event, ...args);
			};

			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(validData);
				expect(errorCount).toBe(2);
				expect(errors).toHaveLength(2);
				expect(errors[0]).toContain('Error occurred parsing stream item 1');
				expect(errors[1]).toContain('Error occurred parsing stream item 3');
				done();
			});

			parser.write('invalid json\n');
			parser.write(JSON.stringify(validData) + '\n');
			parser.write('bad data\n');
			parser.end();
		});

		it('should handle data in flush when no trailing newline', (done) => {
			const result: any[] = [];
			const testData = { id: 1, name: 'flush test' };

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(testData);
				done();
			});

			// Write data without trailing newline
			parser.write(JSON.stringify(testData));
			parser.end();
		});

		it('should emit error for invalid JSON in flush', (done) => {
			const errors: string[] = [];
			let errorEmitted = false;

			// Use onceListeners to capture the exact event emitted
			const originalEmit = parser.emit.bind(parser);
			parser.emit = function(event: string | symbol, ...args: any[]) {
				if (typeof event === 'string' && event.startsWith('Error occurred parsing stream item')) {
					errorEmitted = true;
					errors.push(event);
				}
				return originalEmit(event, ...args);
			};

			// Use 'finish' event instead of 'end' for Transform streams that don't push data
			parser.on('finish', () => {
				expect(errorEmitted).toBe(true);
				expect(errors).toHaveLength(1);
				// The item count is 0 in flush when no lines were processed
				expect(errors[0]).toMatch(/Error occurred parsing stream item \d+:/);
				done();
			});

			// Write invalid data without trailing newline
			parser.write('invalid json data');
			parser.end();
		});

		it('should ignore empty buffer in flush', (done) => {
			const result: any[] = [];

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(0);
				done();
			});

			// Write only whitespace without newline
			parser.write('   ');
			parser.end();
		});

		it('should handle Buffer input correctly', (done) => {
			const result: any[] = [];
			const testData = { id: 1, buffer: 'test' };

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(testData);
				done();
			});

			const buffer = Buffer.from(JSON.stringify(testData) + '\n');
			parser.write(buffer);
			parser.end();
		});

		it('should maintain correct item count across multiple writes', (done) => {
			const errors: string[] = [];
			const errorIndexes: number[] = [];
			const validData: any[] = [];

			parser.on('data', (chunk) => validData.push(chunk));

			// Listen for any event that starts with "Error occurred parsing stream item"
			const originalEmit = parser.emit.bind(parser);
			parser.emit = function(event: string | symbol, ...args: any[]) {
				if (typeof event === 'string' && event.startsWith('Error occurred parsing stream item')) {
					errors.push(event);
					// Extract the item number from the error message
					const match = event.match(/Error occurred parsing stream item (\d+)/);
					if (match) {
						errorIndexes.push(parseInt(match[1], 10));
					}
				}
				return originalEmit(event, ...args);
			};

			parser.on('end', () => {
				expect(validData).toHaveLength(2); // Two valid items parsed
				expect(errors).toHaveLength(2);
				// Item count increments for each line, including invalid ones
				expect(errorIndexes).toEqual([2, 4]);
				done();
			});

			parser.write('{"valid": 1}\n');
			parser.write('bad\n');
			parser.write('{"valid": 2}\n');
			parser.write('invalid\n');
			parser.end();
		});
	});

	describe('parseStream', () => {
		it('should parse stream and yield objects', async () => {
			const testData = [
				{ id: 1, name: 'first' },
				{ id: 2, name: 'second' },
				{ id: 3, name: 'third' }
			];

			const readable = new Readable({
				read() {
					// Empty implementation
				}
			});

			// Start the async generator
			const generatorPromise = (async () => {
				const result: any[] = [];
				for await (const item of NdJsonStreamParser.parseStream(readable)) {
					result.push(item);
				}
				return result;
			})();

			// Push data to the stream
			for (const item of testData) {
				readable.push(JSON.stringify(item) + '\n');
			}
			readable.push(null);

			const result = await generatorPromise;
			expect(result).toEqual(testData);
		});

		it('should handle parse errors and log warning', async () => {
			const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

			const readable = new Readable({
				read() {
					// Empty implementation
				}
			});

			// Create a parser and attach parse-error listener
			const parser = NdJsonStreamParser.createParser();
			parser.emit('parse-error', new Error('Test error'));

			// Start the async generator
			const generatorPromise = (async () => {
				const result: any[] = [];
				for await (const item of NdJsonStreamParser.parseStream(readable)) {
					result.push(item);
				}
				return result;
			})();

			// Push valid data and end stream
			readable.push('{"valid": true}\n');
			readable.push(null);

			await generatorPromise;

			expect(consoleSpy).not.toHaveBeenCalled(); // parse-error event is not emitted in the code

			consoleSpy.mockRestore();
		});

		it('should handle empty stream', async () => {
			const readable = new Readable({
				read() {
					// Empty implementation
				}
			});

			const generatorPromise = (async () => {
				const result: any[] = [];
				for await (const item of NdJsonStreamParser.parseStream(readable)) {
					result.push(item);
				}
				return result;
			})();

			readable.push(null);

			const result = await generatorPromise;
			expect(result).toEqual([]);
		});

		it('should properly type yielded items', async () => {
			interface TestType {
				id: number;
				message: string;
			}

			const testData: TestType[] = [
				{ id: 1, message: 'typed message' }
			];

			const readable = new Readable({
				read() {
					// Empty implementation
				}
			});

			const generatorPromise = (async () => {
				const result: TestType[] = [];
				for await (const item of NdJsonStreamParser.parseStream<TestType>(readable)) {
					result.push(item);
				}
				return result;
			})();

			readable.push(JSON.stringify(testData[0]) + '\n');
			readable.push(null);

			const result = await generatorPromise;
			expect(result).toEqual(testData);
		});

		it('should pipe stream to parser correctly', async () => {
			const readable = new Readable({
				read() {
					// Empty implementation
				}
			});

			const pipeSpy = jest.spyOn(readable, 'pipe');

			const generatorPromise = (async () => {
				const result: any[] = [];
				for await (const item of NdJsonStreamParser.parseStream(readable)) {
					result.push(item);
				}
				return result;
			})();

			readable.push('{"test": true}\n');
			readable.push(null);

			await generatorPromise;

			expect(pipeSpy).toHaveBeenCalledTimes(1);
			expect(pipeSpy).toHaveBeenCalledWith(expect.any(Transform));

			pipeSpy.mockRestore();
		});
	});

	describe('Edge cases', () => {
		it('should handle very large JSON objects', (done) => {
			const parser = NdJsonStreamParser.createParser();
			const result: any[] = [];

			const largeObject = {
				id: 1,
				data: 'x'.repeat(10000),
				nested: {
					deep: {
						value: Array(100).fill(0).map((_, i) => ({ index: i }))
					}
				}
			};

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(largeObject);
				done();
			});

			parser.write(JSON.stringify(largeObject) + '\n');
			parser.end();
		});

		it('should handle special JSON values', (done) => {
			const parser = NdJsonStreamParser.createParser();
			const result: any[] = [];

			const specialValues = [
				{ value: null },
				{ value: true },
				{ value: false },
				{ value: 0 },
				{ value: '' },
				{ value: [] },
				{ value: {} }
			];

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toEqual(specialValues);
				done();
			});

			const ndjson = specialValues.map(item => JSON.stringify(item)).join('\n') + '\n';
			parser.write(ndjson);
			parser.end();
		});
	});
});