/**
 * Rasterizes the megabyte-scale role-grid SVGs (vector files with embedded
 * bitmaps, 0.5-2.5 MB each) into small transparent PNGs at 3x display size.
 * ~11 MB of icon downloads becomes a few hundred kB.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BROWSER = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ASSETS = resolve('public/assets');
const OUT = resolve('public/assets/optimized');
mkdirSync(OUT, { recursive: true });

// [file, render height px (≈3x display size)]
const ICONS = [
  ['Customer.svg', 144],
  ['Products.svg', 144],
  ['Orders.svg', 144],
  ['Rider.svg', 144],
  ['Activator.svg', 144],
  ['Salesperson.svg', 144],
  ['Attendant2.svg', 144],
  ['Keypad2.svg', 144],
  ['BleDeviceAttendant.svg', 144],
  ['Bikes Oves.png', 400],
];

const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
try {
  const page = await browser.newPage();
  for (const [file, h] of ICONS) {
    const mime = file.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    const src = `data:${mime};base64,${readFileSync(resolve(ASSETS, file)).toString('base64')}`;
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><img id="i" src="${src}" style="height:${h}px;display:block"></body></html>`,
    );
    await page.waitForFunction(() => {
      const i = document.getElementById('i');
      return i && i.complete && i.naturalWidth > 0;
    });
    const dims = await page.evaluate(() => {
      const i = document.getElementById('i');
      const r = i.getBoundingClientRect();
      return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
    });
    await page.setViewport({ width: Math.max(dims.w, 1), height: Math.max(dims.h, 1), deviceScaleFactor: 1 });
    const outName = file.replace(/\.(svg|png)$/i, '.png');
    const outPath = resolve(OUT, outName);
    await page.screenshot({
      path: outPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width: dims.w, height: dims.h },
    });
    const inKB = Math.round(statSync(resolve(ASSETS, file)).size / 1024);
    const outKB = Math.round(statSync(outPath).size / 1024);
    console.log(`${file}: ${inKB} kB -> optimized/${outName}: ${outKB} kB`);
  }
} finally {
  await browser.close();
}
