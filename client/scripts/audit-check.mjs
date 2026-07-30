/**
 * CI dependency-audit gate.
 *
 * `npm audit --audit-level=high` is all-or-nothing: it cannot distinguish an
 * advisory that actually affects this app from one that is unreachable in it.
 * Lowering the whole gate to hide a single unreachable advisory would also hide
 * the next real one, so instead this script keeps the bar at high/critical and
 * requires every exception to be listed below with a reason and a review date.
 *
 * Fails the build on any high or critical advisory that is not allowlisted, and
 * also fails on an allowlist entry that is past its review date or no longer
 * matches anything (so stale exceptions can't linger unnoticed).
 */
import { execSync } from 'node:child_process';

const ALLOWLIST = [
  {
    id: 'GHSA-qwww-vcr4-c8h2',
    package: 'react-router',
    reviewBy: '2026-10-31',
    reason:
      'RSC Mode CSRF Bypass. Only reachable through React Router RSC mode with ' +
      'server actions. This client is a static SPA using BrowserRouter/Routes/' +
      'Route/useNavigate only — no RSC, no data-router actions, no loaders — so ' +
      'the vulnerable code path does not exist here. Every published ' +
      'react-router-dom version is affected by this or by GHSA-4vvj-4qhc-hxjq ' +
      '(<=7.17.0), so there is no patched version to move to; the real fix is ' +
      'migrating to react-router v8, which also requires React >=19.2.7.',
  },
];

// `npm audit` exits non-zero whenever it finds anything, so a throw here is the
// normal path — the JSON report we want is still on stdout.
let raw;
try {
  raw = execSync('npm audit --json', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
} catch (err) {
  raw = err.stdout;
  if (!raw) throw err;
}
const { vulnerabilities = {} } = JSON.parse(raw);

const blocking = [];
const matchedIds = new Set();

for (const vuln of Object.values(vulnerabilities)) {
  if (!['high', 'critical'].includes(vuln.severity)) continue;

  // `via` holds either advisory objects (the root cause) or package-name
  // strings (this package is only affected through a dependency).
  const advisories = (vuln.via || []).filter((v) => typeof v === 'object');

  for (const advisory of advisories) {
    const ghsa = (advisory.url || '').split('/').pop();
    const exempt = ALLOWLIST.find((a) => a.id === ghsa);
    if (exempt) {
      matchedIds.add(exempt.id);
      continue;
    }
    blocking.push(`${vuln.severity.toUpperCase()}  ${advisory.name} — ${advisory.title}\n    ${advisory.url}`);
  }

  // A package flagged purely because a dependency is vulnerable is covered by
  // whatever decision was made about that dependency's own advisory.
}

let failed = false;

if (blocking.length) {
  failed = true;
  console.error(`\n${blocking.length} un-allowlisted high/critical advisory(ies):\n`);
  for (const line of [...new Set(blocking)]) console.error(`  ${line}\n`);
}

const today = new Date().toISOString().slice(0, 10);
for (const entry of ALLOWLIST) {
  if (entry.reviewBy < today) {
    failed = true;
    console.error(`Allowlist entry ${entry.id} (${entry.package}) was due for review on ${entry.reviewBy}. Re-assess it or extend the date deliberately.`);
  } else if (!matchedIds.has(entry.id)) {
    failed = true;
    console.error(`Allowlist entry ${entry.id} (${entry.package}) no longer matches any advisory — a fix has probably shipped. Remove the exception and upgrade.`);
  }
}

if (failed) process.exit(1);

console.log(`Dependency audit clean (${matchedIds.size} documented exception(s), all still justified).`);
