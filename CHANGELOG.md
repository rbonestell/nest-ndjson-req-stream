# Changelog

## [0.2.0]

### Fixed

- **`NdJsonStreamParser.createParser()`** — parse errors now emit the event name
  `'parse-error'` with an `Error` object as the payload (previously the error
  message was passed as the event *name*, causing all parse errors to be silently
  swallowed because no listener could register for a dynamic event name).
  The emitted `Error` carries `.line` (the offending text), `.itemNumber` (1-based
  position in the stream), and `.cause` (the original `SyntaxError`).

- **`NdJsonStreamParser.createParser()`** — chunk decoding now uses
  `node:string_decoder`'s `StringDecoder('utf8')` instead of `chunk.toString()`.
  This prevents multi-byte UTF-8 characters (e.g. `€`, emoji, CJK) from being
  corrupted with U+FFFD replacement characters when a chunk boundary falls
  inside a multi-byte sequence.

### Breaking change

- **`NdJsonStreamParser.parseStream()`** — previously logged parse errors via
  `console.warn` and continued silently. It now **throws an `AggregateError`**
  after the stream is fully consumed if any malformed lines were encountered.
  The error message is `NDJSON stream contained N malformed line(s)` and
  `aggregateError.errors` contains the individual `Error` objects.

  Callers that need to tolerate malformed lines should catch the `AggregateError`
  and inspect `.errors`; the generator still yields all successfully parsed items
  before throwing.
