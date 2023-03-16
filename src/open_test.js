'use strict';

const {chromium} = require('playwright');
const browserPath =
    `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
const userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data`;

async function startContext() {
  let browserArgs = ``;
  let context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: browserPath,
    viewport: null,
    ignoreHTTPSErrors: true,
    args: browserArgs.split(' '),
  });
  let page = await context.newPage();
  return [context, page];
}

async function closeContext(context) {
  await context.close();
}

async function openPage(url) {
  if (url == '') {
    throw 'URL is empty';
  }
  const [context, page] = await startContext();
  await page.goto(url);
  await closeContext(context);
}

async function runSingleBenchmark() {
  await openPage(
      'https://storage.googleapis.com/tfjs-models/demos/pose-detection/index.html?model=blazepose&backend=tfjs-webgpu',
      'log.txt');
}

runSingleBenchmark();