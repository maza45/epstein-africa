#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function readPage(relPath) {
  const filePath = path.join(root, ".next", "server", "pages", relPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing built page: ${relPath}. Run npm run build first.`);
  }
  return fs.readFileSync(filePath, "utf8");
}

const checks = [
  {
    file: "fr.html",
    includes: ["Dossiers", "Six dossiers", "six%20dossiers%20issus%20de%20la%20publication%20DOJ"],
    excludes: ["Récits de fond", "Six monographies de synthèse", "Synthèses pluriannuelles"],
  },
  {
    file: "en.html",
    includes: ["/stories/sultan-africa-ports-decade?back=%2F", "/people/sultan-bin-sulayem?back=%2F"],
  },
  {
    file: "fr.html",
    includes: ["/fr/stories/sultan-africa-ports-decade?back=%2Ffr", "/fr/people/sultan-bin-sulayem?back=%2Ffr"],
  },
  {
    file: "en/stories/ivory-coast-surveillance.html",
    includes: ["/emails/EFTA01990469-0?back=%2Fstories%2Fivory-coast-surveillance"],
  },
  {
    file: "fr/stories/ivory-coast-surveillance.html",
    includes: ["/fr/emails/EFTA01990469-0?back=%2Ffr%2Fstories%2Fivory-coast-surveillance"],
  },
  {
    file: "en/stories/ivory-coast-ouattara-bridge.html",
    includes: ["/emails/b06cfc4532695383b7fb74ed77baf90a-0?back=%2Fstories%2Fivory-coast-ouattara-bridge"],
  },
  {
    file: "fr/stories/ivory-coast-ouattara-bridge.html",
    includes: ["/fr/emails/b06cfc4532695383b7fb74ed77baf90a-0?back=%2Ffr%2Fstories%2Fivory-coast-ouattara-bridge"],
  },
  {
    file: "en/stories/sultan-africa-ports-decade.html",
    includes: ["/stories/sultan-scouting-operation?back=%2Fstories%2Fsultan-africa-ports-decade"],
  },
  {
    file: "fr/stories/sultan-africa-ports-decade.html",
    includes: ["/fr/stories/sultan-scouting-operation?back=%2Ffr%2Fstories%2Fsultan-africa-ports-decade"],
  },
];

let failures = 0;
for (const check of checks) {
  const html = readPage(check.file);
  for (const needle of check.includes || []) {
    if (!html.includes(needle)) {
      console.error(`MISSING ${check.file}: ${needle}`);
      failures++;
    }
  }
  for (const needle of check.excludes || []) {
    if (html.includes(needle)) {
      console.error(`FORBIDDEN ${check.file}: ${needle}`);
      failures++;
    }
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log("Static output checks passed.");
