/**
 * QA P0: the guard map of every HTTP route, read from the Nest metadata (class + method guards).
 * 69 routes; 47 protected by an auth guard (35 AdminGuard, 9 JwtAuthGuard, 3 OptionalAuthGuard);
 * every /admin route is behind AdminGuard except the admin login itself. A new or changed route
 * makes this test fail until the map below is updated on purpose.
 *
 * The controllers are not listed by hand: they are discovered twice — from every
 * `src/**\/*.controller.ts` file (Nest's controller watermark) and from the module graph that
 * starts at AppModule — and both sets must match, so a new controller (or one registered but not
 * in a *.controller.ts file, or a file that no module registers) cannot slip past this test.
 *
 * Run (no database, no server — modules and controllers are only imported for their decorators;
 * importing AppModule does not connect: TypeORM/JWT factories run only when Nest boots):
 *   node --import tsx --test test/route-guards.test.ts        (from server/)
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join as joinPath, relative, resolve } from 'node:path';
import { before, describe, it } from 'node:test';
import { RequestMethod } from '@nestjs/common';
import {
  CONTROLLER_WATERMARK,
  GUARDS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AppModule } from '../src/app.module';
import { AdminGuard, JwtAuthGuard, OptionalAuthGuard } from '../src/common/auth';

const SRC = resolve(__dirname, '../src');
const EXPECTED_CONTROLLERS = 15;

type Ctor = abstract new (...args: never[]) => unknown;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = joinPath(dir, name);
    if (statSync(file).isDirectory()) return sourceFiles(file);
    return file.endsWith('.ts') && !file.endsWith('.d.ts') ? [file] : [];
  });
}

/** Every exported class carrying Nest's @Controller watermark, per *.controller.ts file. */
function controllersFromFiles(): Map<Ctor, string> {
  const found = new Map<Ctor, string>();
  for (const file of sourceFiles(SRC).filter((f) => f.endsWith('.controller.ts'))) {
    // require() (CommonJS, like the static imports of AppModule) so a class is the same object in
    // both discoveries; a separate ESM import could load a second copy of the module.
    const exports = require(file) as Record<string, unknown>;
    for (const value of Object.values(exports)) {
      if (typeof value === 'function' && Reflect.getMetadata(CONTROLLER_WATERMARK, value) === true) {
        found.set(value as Ctor, relative(SRC, file));
      }
    }
  }
  return found;
}

/** Every controller registered anywhere in the module graph reachable from AppModule. */
function controllersFromModules(root: unknown): Set<Ctor> {
  const found = new Set<Ctor>();
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];
  while (queue.length > 0) {
    let entry = queue.shift();
    if (entry && typeof entry === 'object' && 'forwardRef' in entry) {
      entry = (entry as { forwardRef: () => unknown }).forwardRef();
    }
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    // A class module carries its metadata; a dynamic module ({ module, imports, controllers }) also
    // carries its own lists next to the class's.
    const moduleClass = typeof entry === 'function' ? entry : (entry as { module?: unknown }).module;
    const lists = [moduleClass, typeof entry === 'object' ? entry : undefined];
    for (const source of lists) {
      if (!source) continue;
      const controllers =
        typeof source === 'function'
          ? (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, source) as unknown[] | undefined)
          : (source as { controllers?: unknown[] }).controllers;
      const imports =
        typeof source === 'function'
          ? (Reflect.getMetadata(MODULE_METADATA.IMPORTS, source) as unknown[] | undefined)
          : (source as { imports?: unknown[] }).imports;
      for (const c of controllers ?? []) found.add(c as Ctor);
      queue.push(...(imports ?? []));
    }
  }
  return found;
}

let CONTROLLERS: Ctor[] = [];
let fromFiles = new Map<Ctor, string>();
let fromModules = new Set<Ctor>();

before(() => {
  fromFiles = controllersFromFiles();
  fromModules = controllersFromModules(AppModule);
  CONTROLLERS = [...fromFiles.keys()];
});

type Route = { method: string; path: string; guards: unknown[] };

const join = (...parts: (string | undefined)[]) =>
  '/api/' + parts.flatMap((p) => (p ?? '').split('/')).filter(Boolean).join('/');

function routes(): Route[] {
  const out: Route[] = [];
  for (const controller of CONTROLLERS) {
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
    const classGuards = (Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[] | undefined) ?? [];
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as Record<string, unknown>)[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (path === undefined) continue;
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
      const guards = [...classGuards, ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined) ?? [])];
      out.push({ method, path: join(base, path === '/' ? '' : path), guards });
    }
  }
  return out;
}

const AUTH_GUARDS = [AdminGuard, JwtAuthGuard, OptionalAuthGuard];
const key = (r: Route) => `${r.method} ${r.path}`;
const withGuard = (guard: unknown) => routes().filter((r) => r.guards.includes(guard)).map(key).sort();

describe('controller inventory (no hand-written list)', () => {
  it(`${EXPECTED_CONTROLLERS} controllers in *.controller.ts files, exactly the ones registered in the AppModule graph`, () => {
    const name = (c: Ctor) => c.name;
    assert.equal(fromFiles.size, EXPECTED_CONTROLLERS, [...fromFiles.values()].join(', '));
    const notRegistered = [...fromFiles.keys()].filter((c) => !fromModules.has(c)).map(name);
    const notInFiles = [...fromModules].filter((c) => !fromFiles.has(c)).map(name);
    assert.deepEqual(notRegistered, [], 'controllers in files that no module registers');
    assert.deepEqual(notInFiles, [], 'registered controllers that are not in a *.controller.ts file');
  });

  it('no @Controller(...) decorator outside a *.controller.ts file', () => {
    const outside = sourceFiles(SRC)
      .filter((f) => !f.endsWith('.controller.ts'))
      .filter((f) => /^\s*@Controller\(/m.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    assert.deepEqual(outside, []);
  });
});

describe('route guard map', () => {
  it('69 routes, 47 behind an auth guard (35 admin, 9 jwt, 3 optional), none with two auth guards', () => {
    const all = routes();
    assert.equal(all.length, 69);
    const protectedRoutes = all.filter((r) => r.guards.some((g) => AUTH_GUARDS.includes(g as never)));
    assert.equal(protectedRoutes.length, 47);
    assert.equal(withGuard(AdminGuard).length, 35);
    assert.equal(withGuard(JwtAuthGuard).length, 9);
    assert.equal(withGuard(OptionalAuthGuard).length, 3);
    for (const r of protectedRoutes) {
      assert.equal(r.guards.filter((g) => AUTH_GUARDS.includes(g as never)).length, 1, key(r));
    }
    assert.equal(new Set(all.map(key)).size, all.length, 'no duplicate method + path');
  });

  it('every /admin route is behind AdminGuard, except POST /api/auth/admin/login', () => {
    const adminPaths = routes().filter((r) => /(^|\/)admin(\/|$)/.test(r.path.slice('/api/'.length)));
    const unguarded = adminPaths.filter((r) => !r.guards.includes(AdminGuard)).map(key);
    assert.deepEqual(unguarded, ['POST /api/auth/admin/login']);
  });

  it('JwtAuthGuard routes are exactly the learner routes', () => {
    assert.deepEqual(withGuard(JwtAuthGuard), [
      'GET /api/auth/me',
      'GET /api/courses/:courseId/progress',
      'GET /api/me/enrollments',
      'POST /api/courses/:courseId/progress/certificate',
      'POST /api/courses/:courseId/progress/lessons/:lessonId/complete',
      'POST /api/courses/:courseId/progress/sync',
      'POST /api/courses/:courseRef/final-test/grade',
      'POST /api/courses/:ref/reviews',
      'PUT /api/auth/me',
    ]);
  });

  it('OptionalAuthGuard routes are exactly the three public reads that depend on the viewer', () => {
    assert.deepEqual(withGuard(OptionalAuthGuard), [
      'GET /api/courses/:courseId/lessons',
      'GET /api/courses/:courseRef/final-test',
      'GET /api/courses/:ref/reviews',
    ]);
  });

  it('every mutating route without an auth guard is one of the known public forms or auth endpoints', () => {
    const open = routes()
      .filter((r) => r.method !== 'GET' && !r.guards.some((g) => AUTH_GUARDS.includes(g as never)))
      .map(key)
      .sort();
    assert.deepEqual(open, [
      'POST /api/auth/admin/login',
      'POST /api/auth/confirm-code',
      'POST /api/auth/forgot-password',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/auth/resend-code',
      'POST /api/auth/reset-password',
      'POST /api/qa/:slug/view',
      'POST /api/teacher-questions',
    ]);
  });
});
