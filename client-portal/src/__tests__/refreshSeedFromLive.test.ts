/**
 * Pins the verify/refuse logic of scripts/refresh-seed-from-live.sh.
 *
 * The script rebuilds the shipped boot-self-heal seed from the live DB so the
 * next publish's seed == live state. If it ever accepted a bad download the
 * seed would be replaced with garbage; if it ever accepted a stale download the
 * boot heal would rewind live data and delete real purchases (2026-11-17).
 * These tests drive the real shell script end-to-end (no mocks) and assert that
 * every failure path exits non-zero AND leaves the seed byte-identical.
 *
 * NOTE: child processes are spawned asynchronously on purpose — the fake live
 * endpoint runs inside this process, so a blocking spawnSync would deadlock.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '../../../scripts/refresh-seed-from-live.sh');
const ADMIN_KEY = 'test-admin-key';

const sha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[], env: Record<string, string> = {}): Promise<RunResult> {
  return new Promise((done) => {
    const child = spawn('bash', [SCRIPT, ...args], {
      env: { ...process.env, PATTERN_ADMIN_SECRET: ADMIN_KEY, ...env },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('close', (status) => {
      clearTimeout(timer);
      done({ status, stdout, stderr });
    });
  });
}

/** A minimal but real SQLite DB with the tables the app needs. */
function makeDb(path: string, opts: { users?: number; purchases?: number; collage?: number } = {}) {
  const { users = 1, purchases = 0, collage = 0 } = opts;
  const sql = [
    'CREATE TABLE User (id TEXT PRIMARY KEY);',
    'CREATE TABLE EmbroideryPattern (id TEXT PRIMARY KEY);',
    'CREATE TABLE Project (id TEXT PRIMARY KEY);',
    'CREATE TABLE PatternPurchase (id TEXT PRIMARY KEY);',
    'CREATE TABLE CollageProject (id TEXT PRIMARY KEY);',
    ...Array.from({ length: users }, (_, i) => `INSERT INTO User VALUES ('u${i}');`),
    ...Array.from({ length: purchases }, (_, i) => `INSERT INTO PatternPurchase VALUES ('p${i}');`),
    ...Array.from({ length: collage }, (_, i) => `INSERT INTO CollageProject VALUES ('c${i}');`),
  ].join('\n');
  const r = spawnSync('sqlite3', [path, sql], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`sqlite3 failed: ${r.stderr}`);
  return readFileSync(path);
}

let work = '';
let seedPath = '';

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'refresh-seed-test-'));
  seedPath = join(work, 'seed-snapshot.db.gz');
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('refresh-seed-from-live.sh --verify-only', () => {
  it('accepts a real, healthy SQLite database', async () => {
    const db = join(work, 'good.db');
    makeDb(db, { users: 2, purchases: 2, collage: 2 });
    const r = await run(['--verify-only', db]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('is a usable SQLite database');
  });

  it('refuses an HTML body (a 200 error page instead of a database)', async () => {
    const f = join(work, 'page.html');
    writeFileSync(f, '<!doctype html><html><body>Not found</body></html>');
    const r = await run(['--verify-only', f]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('is not a SQLite database');
  });

  it('refuses a file with a valid SQLite header but a corrupt body', async () => {
    const f = join(work, 'corrupt.db');
    writeFileSync(f, Buffer.concat([Buffer.from('SQLite format 3\u0000', 'utf8'), Buffer.alloc(4096, 0xab)]));
    const r = await run(['--verify-only', f]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/quick_check|not a database/);
  });

  it('refuses a database missing a required table', async () => {
    const f = join(work, 'partial.db');
    const r0 = spawnSync('sqlite3', [f, 'CREATE TABLE User (id TEXT PRIMARY KEY);'], { encoding: 'utf8' });
    expect(r0.status).toBe(0);
    const r = await run(['--verify-only', f]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('missing required table');
  });

  it('refuses a missing file and an empty file', async () => {
    const missing = await run(['--verify-only', join(work, 'nope.db')]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('not found');

    const empty = join(work, 'empty.db');
    writeFileSync(empty, '');
    const r = await run(['--verify-only', empty]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('empty');
  });
});

describe('refresh-seed-from-live.sh full run', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      const s = server;
      server = null;
      await new Promise<void>((done) => s.close(() => done()));
    }
  });

  /** Serve a fixed response on 127.0.0.1 and return the endpoint URL. */
  async function serve(status: number, body: Buffer) {
    server = createServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/octet-stream' });
      res.end(body);
    });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', () => done()));
    const addr = server!.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    return `http://127.0.0.1:${addr.port}/api/admin/db-backup`;
  }

  it('replaces the seed atomically with the verified live database', async () => {
    const bytes = makeDb(join(work, 'live.db'), { users: 2, purchases: 2, collage: 2 });
    writeFileSync(seedPath, gzipSync(makeDb(join(work, 'old.db'), { users: 2, purchases: 1 })));
    const url = await serve(200, bytes);

    const r = await run(['--url', url, '--out', seedPath]);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('seed replaced');

    expect(sha(gunzipSync(readFileSync(seedPath)))).toBe(sha(bytes));
    expect(readFileSync(`${seedPath}.sha256`, 'utf8')).toContain(sha(bytes));
    // no temp files left behind next to the seed
    expect(readdirSync(work).filter((f) => f.startsWith('.seed-refresh-'))).toEqual([]);
  });

  it('refuses an HTML body served with HTTP 200 and leaves the seed untouched', async () => {
    const original = gzipSync(makeDb(join(work, 'old.db'), { users: 2, purchases: 1 }));
    writeFileSync(seedPath, original);
    const url = await serve(200, Buffer.from('<html><body>404</body></html>'));

    const r = await run(['--url', url, '--out', seedPath]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('is not a SQLite database');
    expect(sha(readFileSync(seedPath))).toBe(sha(original));
  });

  it('refuses on an HTTP error status even when the body is a valid database', async () => {
    const bytes = makeDb(join(work, 'live.db'), { purchases: 2 });
    const original = gzipSync(makeDb(join(work, 'old.db'), { purchases: 1 }));
    writeFileSync(seedPath, original);
    const url = await serve(401, bytes);

    const r = await run(['--url', url, '--out', seedPath]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/HTTP 401|download failed/);
    expect(sha(readFileSync(seedPath))).toBe(sha(original));
  });

  it('refuses an empty body and leaves the seed untouched', async () => {
    const original = gzipSync(makeDb(join(work, 'old.db'), { purchases: 1 }));
    writeFileSync(seedPath, original);
    const url = await serve(200, Buffer.alloc(0));

    const r = await run(['--url', url, '--out', seedPath]);
    expect(r.status).toBe(1);
    expect(sha(readFileSync(seedPath))).toBe(sha(original));
  });

  it('refuses a stale live DB that would delete purchases the seed already holds', async () => {
    // The exact 2026-11-17 shape: the seed carries 3 purchases, live only 1.
    const original = gzipSync(makeDb(join(work, 'old.db'), { users: 2, purchases: 3, collage: 2 }));
    writeFileSync(seedPath, original);
    const url = await serve(200, makeDb(join(work, 'live.db'), { users: 2, purchases: 1, collage: 2 }));

    const r = await run(['--url', url, '--out', seedPath]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('SHRINK');
    expect(r.stderr).toContain('PatternPurchase');
    expect(sha(readFileSync(seedPath))).toBe(sha(original));
  });

  it('honours ALLOW_SEED_SHRINK=1 when the shrink is intended', async () => {
    writeFileSync(seedPath, gzipSync(makeDb(join(work, 'old.db'), { purchases: 3 })));
    const bytes = makeDb(join(work, 'live.db'), { purchases: 1 });
    const url = await serve(200, bytes);

    const r = await run(['--url', url, '--out', seedPath], { ALLOW_SEED_SHRINK: '1' });
    expect(r.status).toBe(0);
    expect(sha(gunzipSync(readFileSync(seedPath)))).toBe(sha(bytes));
  });

  it('refuses with no endpoint configured and touches nothing', async () => {
    writeFileSync(seedPath, gzipSync(makeDb(join(work, 'old.db'), { purchases: 1 })));
    const original = sha(readFileSync(seedPath));
    const r = await run(['--out', seedPath], { LIVE_DB_BACKUP_URL: '' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('no live DB endpoint');
    expect(sha(readFileSync(seedPath))).toBe(original);
    expect(existsSync(`${seedPath}.sha256`)).toBe(false);
  });

  it('refuses with no admin key configured', async () => {
    writeFileSync(seedPath, gzipSync(makeDb(join(work, 'old.db'), { purchases: 1 })));
    const original = sha(readFileSync(seedPath));
    const r = await run(['--url', 'http://127.0.0.1:9/api/admin/db-backup', '--out', seedPath], {
      PATTERN_ADMIN_SECRET: '',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('PATTERN_ADMIN_SECRET');
    expect(sha(readFileSync(seedPath))).toBe(original);
  });
});
