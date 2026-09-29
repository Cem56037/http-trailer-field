/**
 * HTTP Trailer Field — split a chunked transfer response body from its trailing headers.
 *
 * When a server uses chunked transfer-encoding it may append zero or more trailer
 * fields after the final zero-length chunk. The fetch ReadableStream API gives you
 * the raw bytes of body+trailers concatenated; there is no built-in way to separate
 * them. This module does that separation.
 *
 * Design decision: we treat the input as a *complete* string or Uint8Array. We do
 * NOT attempt to parse a live stream chunk-by-chunk, because the trailer/header
 * boundary (a CRLF CRLF sequence) can be split across two fetch chunks and handling
 * that correctly requires buffering state that is out of scope for a focused utility.
 * Call this after you have collected the full response text.
 */

const CRLF = '\r\n';
const CRLF_CRLF = '\r\n\r\n';

/**
 * Convert input to a string. We accept Uint8Array because that is what fetch
 * streams yield; we accept string because that is what await response.text() yields.
 * We decode as UTF-8 which is the default for most HTTP responses; if a different
 * charset is in play the caller should decode first and pass a string.
 *
 * @param {string|Uint8Array} input
 * @returns {string}
 */
function toString(input) {
  if (typeof input === 'string') return input;
  if (input instanceof Uint8Array) {
    return new TextDecoder('utf-8').decode(input);
  }
  // Array-like of bytes — handle without throwing on legitimate inputs.
  if (Array.isArray(input) || (input && typeof input.length === 'number')) {
    return new TextDecoder('utf-8').decode(new Uint8Array(input));
  }
  throw new TypeError('Expected string or Uint8Array');
}

/**
 * Parse a block of header lines into an object. Duplicate header names are joined
 * with ", " per RFC 9110. We do not lowercase keys here; callers get the original
 * casing. This matches what Headers does on read, but keeps it simple and explicit.
 *
 * @param {string} headerBlock
 * @returns {Record<string, string>}
 */
function parseHeaders(headerBlock) {
  const headers = {};
  const lines = headerBlock.split(CRLF);
  for (const line of lines) {
    if (line === '') continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue; // malformed line; skip rather than throw
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name === '') continue;
    if (name in headers) {
      headers[name] = headers[name] + ', ' + value;
    } else {
      headers[name] = value;
    }
  }
  return headers;
}

/**
 * Find the index of the *last* occurrence of `\r\n\r\n` in `text`.
 *
 * Trailers are terminated by CRLF CRLF (the blank line that ends the header block).
 * But the body itself may contain CRLF CRLF, so we cannot just split on the first
 * occurrence. The key insight: in a chunked response the trailers come *last*, so
 * the *final* CRLF CRLF in the text is the separator between body and trailers.
 *
 * Edge case: if there are no trailers, there is no trailing CRLF CRLF, and the
 * entire input is body. We return -1.
 *
 * Edge case: if the input ends with CRLF CRLF and has no trailer lines (just a
 * blank line), we treat that as "no trailers" — the blank line is part of the
 * chunked encoding terminator, not a header block. This is the awkward edge: a
 * body that genuinely ends with two blank lines cannot be distinguished from an
 * empty trailer block. We pick the interpretation that an empty trailer block is
 * the same as no trailers.
 *
 * @param {string} text
 * @returns {number}
 */
function findLastCrlfCrlf(text) {
  // Search from the end. lastIndexOf is O(n) but only called once.
  return text.lastIndexOf(CRLF_CRLF);
}

/**
 * Split a chunked response body from its trailing headers.
 *
 * Returns `{ body, trailers }` where `body` is the response body as a string and
 * `trailers` is an object of trailer field names to values. If no trailers are
 * present, `trailers` is `{}`.
 *
 * @param {string|Uint8Array} input — the full response body including any trailers.
 * @returns {{ body: string, trailers: Record<string, string> }}
 */
export function splitTrailers(input) {
  const text = toString(input);
  const idx = findLastCrlfCrlf(text);
  if (idx === -1) {
    return { body: text, trailers: {} };
  }
  const afterSeparator = idx + CRLF_CRLF.length;
  const trailerBlock = text.slice(afterSeparator);
  // If the text after the last CRLF CRLF is empty or whitespace-only, treat as no trailers.
  if (trailerBlock.trim() === '') {
    return { body: text, trailers: {} };
  }
  const body = text.slice(0, idx);
  const trailers = parseHeaders(trailerBlock);
  return { body, trailers };
}

/**
 * Extract only the trailer fields, discarding the body.
 *
 * @param {string|Uint8Array} input
 * @returns {Record<string, string>}
 */
export function extractTrailers(input) {
  return splitTrailers(input).trailers;
}

/**
 * Return only the body, discarding the trailers.
 *
 * @param {string|Uint8Array} input
 * @returns {string}
 */
export function stripTrailers(input) {
  return splitTrailers(input).body;
}
