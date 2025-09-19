<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

<p align="center">Accept and automatically parse NDJSON stream requests in NestJS with Express!</p>
<p align="center">
  <a href="https://www.npmjs.com/package/nest-ndjson-req-stream" target="_blank"><img alt="NPM Version" src="https://img.shields.io/npm/v/nest-ndjson-req-stream?logo=npm&logoColor=white"></a>
  <a href="https://github.com/rbonestell/nest-ndjson-req-stream/actions/workflows/build.yml?query=branch%3Amain" target="_blank"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/rbonestell/nest-ndjson-req-stream/build.yml?logo=typescript&logoColor=white"></a>
  <a href="https://github.com/rbonestell/nest-ndjson-req-stream/actions/workflows/test.yml?query=branch%3Amain" target="_blank"><img alt="Test Results" src="https://img.shields.io/github/actions/workflow/status/rbonestell/nest-ndjson-req-stream/test.yml?branch=main&logo=jest&logoColor=white&label=tests"></a>
  <a href="https://app.codecov.io/gh/rbonestell/nest-ndjson-req-stream/tree/main/lib" target="_blank"><img alt="Test Coverage" src="https://img.shields.io/codecov/c/github/rbonestell/nest-ndjson-req-stream?logo=codecov&logoColor=white"></a>
  <a href="https://github.com/rbonestell/nest-ndjson-req-stream/blob/main/LICENSE" target="_blank"><img alt="GitHub License" src="https://img.shields.io/github/license/rbonestell/nest-ndjson-req-stream?color=71C347">
</a>
</p>

## Description

A lightweight library that enables NestJS applications to accept and process streaming NDJSON (Newline Delimited JSON) requests with Express. Perfect for handling large datasets, real-time data feeds, and streaming APIs where each line contains a valid JSON object.

## Features

- ✨ Simple decorator-based API for handling NDJSON streams
- 🚀 Memory-efficient processing using AsyncGenerators
- 🎯 TypeScript support with generic types
- 🔧 Configurable batch processing
- 🛡️ Automatic content-type validation
- ⚡ Zero dependencies (only NestJS peer dependencies)

## Requirements

- Node.js >= 20.0.0
- NestJS >= 10.0.0
- Express framework

## Installation

```bash
npm install nest-ndjson-req-stream
```

## Quick Start

### Simply use the decorator on request parameters in your controller

```typescript
import { Controller, Post } from '@nestjs/common';
import { NdJsonStreamReq, NdJsonStreamRequest } from 'nest-ndjson-req-stream';

interface DataItem {
	id: number;
	name: string;
	value: number;
}

@Controller('stream')
export class StreamController {
	@Post('process')
	async processStream(
		@NdJsonStreamReq<DataItem>() request: NdJsonStreamRequest<DataItem>
	) {
		const results: DataItem[] = [];

		// Process each item from the stream
		for await (const item of request.body) {
			// Process your data here
			console.log('Received:', item);
			results.push(item);
		}

		return {
			message: 'Stream processed successfully',
			itemCount: results.length,
		};
	}
}
```

### Type Safety

Use TypeScript generics for type-safe stream processing:

```typescript
interface User {
  id: string;
  email: string;
  profile: {
    name: string;
    age: number;
  };
}

@Post('users')
async importUsers(
  @NdJsonStreamReq() request: NdJsonStreamRequest<User>
) {
  for await (const user of request.body) {
    // TypeScript knows that user is of type User
    console.log(user.email); // ✅ Type safe
    console.log(user.profile.name); // ✅ Type safe
  }
}
```

## API Reference

### `@NdJsonStreamReq(options?: NdJsonStreamOptions)`

Parameter decorator for handling NDJSON streaming requests.

#### Options:

- `batchSize?: number` - The batch size for processing streamed objects (default: 25)

### `NdJsonStreamRequest<T>`

Extended Express Request interface with AsyncGenerator type body:

- `body: AsyncGenerator<T>` - AsyncGenerator that yields parsed NDJSON objects
- `batchSize: number` - The configured batch size for processing

## Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is [MIT licensed](LICENSE).
