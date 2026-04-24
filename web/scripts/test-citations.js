#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadCitationModule() {
  const modulePath = path.join(__dirname, "..", "lib", "citations.js");
  const src = fs.readFileSync(modulePath, "utf8");
  const wrapped = src
    .replace(/^export\s+const\s+(\w+)/gm, "const $1")
    .replace(/^export\s+function\s+(\w+)/gm, "function $1");
  const sandbox = { globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(
    `${wrapped}\nglobalThis.createCitationRegex = createCitationRegex;\nglobalThis.extractCitationIds = extractCitationIds;\nglobalThis.isSupportedCitationId = isSupportedCitationId;`,
    sandbox
  );
  return sandbox.globalThis;
}

const { extractCitationIds, isSupportedCitationId } = loadCitationModule();

const cases = [
  ["standard EFTA", "See EFTA01841982-0.", ["EFTA01841982-0"]],
  ["legacy bare EFTA", "See EFTA00711038.", ["EFTA00711038"]],
  ["volume PDF", "See vol00009-efta00633187-pdf-1.", ["vol00009-efta00633187-pdf-1"]],
  ["house oversight", "See HOUSE_OVERSIGHT_026028-3.", ["HOUSE_OVERSIGHT_026028-3"]],
  ["hash row id", "See b06cfc4532695383b7fb74ed77baf90a-0.", ["b06cfc4532695383b7fb74ed77baf90a-0"]],
  ["bare hash rejected", "Do not link b06cfc4532695383b7fb74ed77baf90a.", []],
  ["uppercase hash rejected", "Do not link B06CFC4532695383B7FB74ED77BAF90A-0.", []],
  ["sha-like rejected", "Do not link abcdefabcdefabcdefabcdefabcdefab.", []],
];

let failures = 0;
for (const [name, input, expected] of cases) {
  const actual = extractCitationIds(input);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  }
}

for (const id of ["EFTA01841982-0", "vol00009-efta00633187-pdf-1", "HOUSE_OVERSIGHT_026028-3", "b06cfc4532695383b7fb74ed77baf90a-0"]) {
  if (!isSupportedCitationId(id)) {
    console.error(`FAIL supported id rejected: ${id}`);
    failures++;
  }
}

for (const id of ["b06cfc4532695383b7fb74ed77baf90a", "B06CFC4532695383B7FB74ED77BAF90A-0", "abcdefabcdefabcdefabcdefabcdefab"]) {
  if (isSupportedCitationId(id)) {
    console.error(`FAIL unsupported id accepted: ${id}`);
    failures++;
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log("Citation parser tests passed.");
