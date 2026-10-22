#!/usr/bin/env node
// Pre-deploy security check: secrets in tracked files or the browser bundle,
// committed env files, and known-vulnerable production dependencies.
// Usage: npm run security   (run `npm run build` first to scan the bundle)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SECRET_PATTERNS = [
  ["OpenAI/Anthropic key", /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/],
  ["Resend key", /\bre_[A-Za-z0-9]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Hard-coded secret", /\b(?:SMTP_PASS|RESEND_API_KEY|API_KEY|SECRET|PASSWORD)\s*[:=]\s*["'][^"'\s]{8,}["']/],
];

// Obvious placeholders used in tests and docs are not secrets.
const PLACEHOLDER = /test-only|not-a-real|example|placeholder|changeme|dummy|x{8,}/i;

const findings = [];
const scan = (label, text) => {
  for (const [name, pattern] of SECRET_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, "g")) ?? [];
    if (matches.some((match) => !PLACEHOLDER.test(match))) findings.push(`${name} in ${label}`);
  }
};

// 1. Tracked files (what GitHub and Netlify see).
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const file of tracked) {
  if (/(^|\/)\.env/.test(file)) findings.push(`environment file is committed: ${file}`);
  if (file === "package-lock.json" || !existsSync(file) || statSync(file).size > 2_000_000) continue;
  scan(file, readFileSync(file, "utf8"));
}

// 2. The JavaScript shipped to browsers.
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
if (existsSync(".next/static")) {
  for (const file of walk(".next/static").filter((f) => /\.(js|css|html|json)$/.test(f))) {
    const text = readFileSync(file, "utf8");
    scan(`browser bundle ${file}`, text);
    for (const name of ["RESEND_API_KEY", "SMTP_PASS", "CODEX_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
      const value = process.env[name];
      if (value && value.length >= 8 && text.includes(value)) findings.push(`${name} value leaked into ${file}`);
    }
  }
} else {
  console.warn("! .next/static not found — run `npm run build` to also scan the browser bundle.");
}

// 3. Known vulnerabilities in what runs in production.
const audit = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high"], { encoding: "utf8" });
if (audit.status !== 0) findings.push(`npm audit (production) reports high/critical issues:\n${audit.stdout.trim()}`);

if (findings.length) {
  console.error(`✖ Security check failed (${findings.length}):\n- ${findings.join("\n- ")}`);
  process.exit(1);
}
console.log(`✔ Security check passed: ${tracked.length} tracked files${existsSync(".next/static") ? " + browser bundle" : ""} scanned, production dependencies clean.`);
