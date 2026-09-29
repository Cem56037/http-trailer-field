import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitTrailers, extractTrailers, stripTrailers } from '../src/core.js';

test('splitTrailers returns body and empty trailers when no trailers present', () => {
  const input = 'Hello, world!';
  const result = splitTrailers(input);
  assert.deepEqual(result, { body: 'Hello, world!', trailers: {} });
});

test('splitTrailers splits body from a single trailer', () => {
  const input = 'response body\r\n\r\nX-Trace-Id: abc123';
  const result = splitTrailers(input);
  assert.equal(result.body, 'response body');
  assert.deepEqual(result.trailers, { 'X-Trace-Id': 'abc123' });
});

test('splitTrailers splits body from multiple trailers', () => {
  const input = 'body text\r\n\r\nX-Trace-Id: abc\r\nX-Duration: 42';
  const result = splitTrailers(input);
  assert.equal(result.body, 'body text');
  assert.deepEqual(result.trailers, { 'X-Trace-Id': 'abc', 'X-Duration': '42' });
});

test('splitTrailers handles body that itself contains CRLF CRLF', () => {
  const input = 'line1\r\n\r\nline2\r\n\r\nX-Checksum: deadbeef';
  const result = splitTrailers(input);
  assert.equal(result.body, 'line1\r\n\r\nline2');
  assert.deepEqual(result.trailers, { 'X-Checksum': 'deadbeef' });
});

test('splitTrailers accepts Uint8Array input', () => {
  const text = 'body\r\n\r\nX-Val: 1';
  const input = new TextEncoder().encode(text);
  const result = splitTrailers(input);
  assert.equal(result.body, 'body');
  assert.deepEqual(result.trailers, { 'X-Val': '1' });
});

test('splitTrailers joins duplicate trailer names with comma', () => {
  const input = 'body\r\n\r\nX-Set-Cookie: a=1\r\nX-Set-Cookie: b=2';
  const result = splitTrailers(input);
  assert.deepEqual(result.trailers, { 'X-Set-Cookie': 'a=1, b=2' });
});

test('splitTrailers trims whitespace around trailer values', () => {
  const input = 'body\r\n\r\nX-Val:   spaced   ';
  const result = splitTrailers(input);
  assert.deepEqual(result.trailers, { 'X-Val': 'spaced' });
});

test('splitTrailers treats trailing CRLF CRLF with no header lines as no trailers', () => {
  const input = 'body content\r\n\r\n';
  const result = splitTrailers(input);
  assert.equal(result.body, 'body content\r\n\r\n');
  assert.deepEqual(result.trailers, {});
});

test('splitTrailers skips malformed trailer lines without colon', () => {
  const input = 'body\r\n\r\nX-Valid: yes\r\ngarbage line\r\nX-Also: ok';
  const result = splitTrailers(input);
  assert.deepEqual(result.trailers, { 'X-Valid': 'yes', 'X-Also': 'ok' });
});

test('extractTrailers returns only the trailers object', () => {
  const input = 'body\r\n\r\nX-Trace-Id: abc';
  assert.deepEqual(extractTrailers(input), { 'X-Trace-Id': 'abc' });
});

test('stripTrailers returns only the body string', () => {
  const input = 'body content\r\n\r\nX-Trace-Id: abc';
  assert.equal(stripTrailers(input), 'body content');
});

test('splitTrailers throws TypeError for invalid input type', () => {
  assert.throws(() => splitTrailers(42), TypeError);
  assert.throws(() => splitTrailers(null), TypeError);
  assert.throws(() => splitTrailers(undefined), TypeError);
});

test('splitTrailers handles empty input', () => {
  const result = splitTrailers('');
  assert.deepEqual(result, { body: '', trailers: {} });
});
