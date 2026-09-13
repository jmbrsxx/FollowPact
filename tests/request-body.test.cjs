/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'request-body.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const body = {};
vm.runInNewContext(compiled, { exports: body, TextDecoder });

test('reads a UTF-8 body within the byte limit', async () => {
  const request = new Request('http://localhost/', { method: 'POST', body: 'é' });
  assert.equal(await body.readLimitedBody(request, 2), 'é');
});

test('rejects an oversized streamed body even without a Content-Length header', async () => {
  const request = new Request('http://localhost/', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('1234'));
        controller.enqueue(new TextEncoder().encode('5'));
        controller.close();
      },
    }),
    duplex: 'half',
  });
  await assert.rejects(body.readLimitedBody(request, 4), body.RequestBodyTooLarge);
});

test('rejects a declared oversized body before reading it', async () => {
  const request = new Request('http://localhost/', { method: 'POST', headers: { 'content-length': '100' }, body: 'x' });
  await assert.rejects(body.readLimitedBody(request, 4), body.RequestBodyTooLarge);
});
