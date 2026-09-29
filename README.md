# HTTP Trailer Field

Splits a chunked transfer response body from its trailing headers when using fetch streams.

```js
import { splitTrailers } from 'http-trailer-field';

const text = 'response body\r\n\r\nX-Trace-Id: abc123';
const { body, trailers } = splitTrailers(text);
console.log(trailers['X-Trace-Id']);
```

## Why this exists

When a server uses chunked transfer-encoding it may append trailer fields after the final zero-length chunk. The fetch `ReadableStream` API hands you the raw bytes of body and trailers concatenated with no built-in way to separate them. This library does that separation in one function call.

The trade-off: this library operates on the *complete* response text, not a live stream. The boundary between body and trailers is a `CRLF CRLF` sequence, and that sequence can be split across two fetch chunks. Correctly handling that requires buffering state across chunks, which is a different problem. Collect the full response first, then call `splitTrailers`.

## The awkward edge

A response body that genuinely ends with two blank lines (`CRLF CRLF`) is indistinguishable from an empty trailer block. This library treats a trailing `CRLF CRLF` with no header lines after it as "no trailers" — the blank line is considered part of the body. If your body legitimately ends with blank lines, they will be preserved in the returned `body`.

## Exports

- `splitTrailers(input)` — returns `{ body, trailers }`.
- `extractTrailers(input)` — returns the trailers object only.
- `stripTrailers(input)` — returns the body string only.

`input` is a `string` or `Uint8Array`. Trailer names are returned with original casing. Duplicate names are joined with `", "`.
