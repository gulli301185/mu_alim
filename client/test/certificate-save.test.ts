/**
 * Certificate PDF: one download button per page, how the file reaches the user on each device,
 * and long names fitting the frame. Pure helpers only — no jsPDF, no DOM.
 *
 * Run: node --import tsx --test client/test/certificate-save.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chooseSaveStrategy,
  fitFontSize,
  isIosDevice,
  showSidebarCertificateButton,
} from '../src/lib/certificate-save';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('save strategy per device', () => {
  it('iPhone → ios (PDF tab / Save to Files)', () => {
    assert.equal(isIosDevice({ userAgent: IPHONE }), true);
    assert.equal(chooseSaveStrategy({ userAgent: IPHONE }), 'ios');
  });
  it('iPad reporting a Mac with touch → ios', () => {
    assert.equal(chooseSaveStrategy({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  });
  it('Android Chrome → plain download (no share sheet)', () => {
    assert.equal(chooseSaveStrategy({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 }), 'download');
  });
  it('desktop Mac without touch → plain download', () => {
    assert.equal(chooseSaveStrategy({ userAgent: DESKTOP_CHROME, platform: 'MacIntel', maxTouchPoints: 0 }), 'download');
  });
});

describe('one certificate download button per page', () => {
  it('certificate issued, all lessons done → main area only (sidebar hidden)', () => {
    assert.equal(showSidebarCertificateButton({ hasIssuedCertificate: true, allLessonsDone: true }), false);
  });
  it('certificate issued, a lesson added later → sidebar keeps it downloadable', () => {
    assert.equal(showSidebarCertificateButton({ hasIssuedCertificate: true, allLessonsDone: false }), true);
  });
  it('no certificate yet → no sidebar button', () => {
    assert.equal(showSidebarCertificateButton({ hasIssuedCertificate: false, allLessonsDone: true }), false);
    assert.equal(showSidebarCertificateButton({ hasIssuedCertificate: false, allLessonsDone: false }), false);
  });
});

describe('fitFontSize (student name on the certificate)', () => {
  const perChar = (chars: number) => (size: number) => chars * size * 0.5;
  it('a short name keeps the start size', () => {
    assert.equal(fitFontSize(perChar(12), 40, 22, 760), 40);
  });
  it('a long name shrinks until it fits', () => {
    const size = fitFontSize(perChar(50), 40, 22, 760);
    assert.ok(size < 40 && 50 * size * 0.5 <= 760, `size ${size}`);
  });
  it('never below the minimum, even if it still does not fit', () => {
    assert.equal(fitFontSize(perChar(500), 40, 22, 760), 22);
  });
});
