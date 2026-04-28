import { Readable, Transform } from 'stream';
import { Test } from '@nestjs/testing';
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

		it('should emit error and stop stream on invalid JSON', (done) => {
			const result: any[] = [];
			const validData = { id: 1, valid: true };

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('error', (err: Error) => {
				expect(result).toHaveLength(0);
				expect(err).toBeInstanceOf(Error);
				expect(err.message).toContain('Failed to parse NDJSON line 1');
				expect((err as any).line).toBe('invalid json');
				expect((err as any).itemNumber).toBe(1);
				expect((err as any).cause).toBeDefined();
				done();
			});

			parser.write('invalid json\n');
			parser.write(JSON.stringify(validData) + '\n');
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
			parser.on('error', (err: Error) => {
				expect(err).toBeInstanceOf(Error);
				expect(err.message).toMatch(/Failed to parse NDJSON line \d+:/);
				expect((err as any).line).toBe('invalid json data');
				expect((err as any).cause).toBeDefined();
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

		it('should correctly handle multi-byte UTF-8 characters split across chunk boundaries', (done) => {
			const result: any[] = [];
			// '€' is U+20AC, encoded as 3 bytes: 0xE2 0x82 0xAC
			const testData = { id: 1, text: 'price: €100' };
			const fullLine = JSON.stringify(testData) + '\n';
			const bytes = Buffer.from(fullLine, 'utf8');

			// Find a split point inside the € character (byte 3 is first byte of €)
			// Locate the € in the buffer and split mid-character
			const euroByteIndex = bytes.indexOf(0xe2); // first byte of €
			const chunk1 = bytes.subarray(0, euroByteIndex + 1); // ends mid-€
			const chunk2 = bytes.subarray(euroByteIndex + 1);

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('end', () => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual(testData);
				done();
			});

			parser.write(chunk1);
			parser.write(chunk2);
			parser.end();
		});

		it('should emit error on first invalid line and stop processing', (done) => {
			const validData: any[] = [];

			parser.on('data', (chunk) => validData.push(chunk));
			parser.on('error', (err: Error) => {
				expect(validData).toHaveLength(1);
				expect((err as any).itemNumber).toBe(2);
				done();
			});

			parser.write('{"valid": 1}\n');
			parser.write('bad\n');
			parser.write('{"valid": 2}\n');
			parser.write('invalid\n');
			parser.end();
		});

		it('should stop at first invalid line when valid and invalid JSON are in the same chunk', (done) => {
			const result: any[] = [];

			parser.on('data', (chunk) => result.push(chunk));
			parser.on('error', (err: Error) => {
				expect(result).toHaveLength(1);
				expect(result[0]).toEqual({ valid: true });
				expect((err as any).itemNumber).toBe(2);
				expect((err as any).line).toBe('bad json');
				done();
			});

			// Both lines in a single write — single transform() invocation processes both
			parser.write('{"valid": true}\nbad json\n');
			parser.end();
		});

		it('should count blank lines toward itemNumber', (done) => {
			parser.on('error', (err: Error) => {
				// blank line is item 1, valid is item 2, bad is item 3
				expect((err as any).itemNumber).toBe(3);
				done();
			});

			parser.write('\n{"valid": 1}\nbad\n');
			parser.end();
		});

		it('should emit error from flush when stream ends mid-multi-byte UTF-8 sequence', (done) => {
			// Write first byte of '€' (0xE2) without completing the 3-byte sequence.
			// StringDecoder buffers it; decoder.end() in flush emits U+FFFD, making JSON invalid.
			const partial = Buffer.concat([
				Buffer.from('{"text":"'),
				Buffer.from([0xe2]), // first byte of €, sequence never completed
			]);

			parser.on('error', (err: Error) => {
				expect(err).toBeInstanceOf(Error);
				expect(err.message).toMatch(/Failed to parse NDJSON line \d+:/);
				expect((err as any).line).toContain('�');
				done();
			});

			parser.write(partial);
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

		it('should throw immediately when a malformed line is encountered', async () => {
			const readable = new Readable({
				read() {
					// Empty implementation
				}
			});

			const promise = (async () => {
				for await (const _item of NdJsonStreamParser.parseStream(readable)) {
					// consume items
				}
			})();

			readable.push('{"valid": true}\n');
			readable.push('malformed json\n');
			readable.push(null);

			await expect(promise).rejects.toThrow(Error);
			await expect(promise).rejects.toThrow('Failed to parse NDJSON line');
		});

		it('should not throw when stream has no parse errors', async () => {
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

			readable.push('{"valid": true}\n');
			readable.push(null);

			await expect(generatorPromise).resolves.toEqual([{ valid: true }]);
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

	describe('NestJS DI', () => {
		it('should be instantiable via NestJS DI container', async () => {
			const module = await Test.createTestingModule({
				providers: [NdJsonStreamParser],
			}).compile();

			expect(module.get(NdJsonStreamParser)).toBeInstanceOf(NdJsonStreamParser);
		});
	});
});
