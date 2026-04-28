# Changelog

## [0.2.0]

### Fixed

- **`NdJsonStreamParser.createParser()`** — malformed JSON lines now destroy the
  stream immediately via `callback(error)` (fail-closed). Previously the error
  message string was passed as the event *name* to `this.emit()`, so no listener
  could ever observe parse failures and they were silently dropped.

  The `Error` passed to consumers carries three additional properties:
  - `.line` — the raw text of the offending line
  - `.itemNumber` — 1-based position in the stream
  - `.cause` — the original `SyntaxError` from `JSON.parse`

- **`NdJsonStreamParser.createParser()`** — chunk decoding now uses
  `node:string_decoder`'s `StringDecoder('utf8')` instead of `chunk.toString()`.
  This prevents multi-byte UTF-8 characters (e.g. `€`, emoji, CJK) from being
  corrupted with U+FFFD replacement characters when a chunk boundary falls
  inside a multi-byte sequence.

### Breaking changes

- **`NdJsonStreamParser.parseStream()`** — previously swallowed all parse errors
  and logged them via `console.warn` after the stream completed. It now propagates
  stream errors directly: the `for await` loop in the caller rejects with the parse
  `Error` at the first malformed line, stopping further processing.

- **`NdJsonStreamParser.createParser()`** — the stream is destroyed on the first
  malformed line. Callers that need lenient/skip behavior should handle the `'error'`
  event on the parser and call `parser.resume()` or create a new parser.
