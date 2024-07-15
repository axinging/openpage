'use strict';
const {chromium} = require('playwright');
// https://github.com/axinging/webtest/blob/support_tracing3/src/open_page.js
let logStatus = {logEnd: false};

async function waitForCondition(condition) {
  return new Promise(resolve => {
    var start_time = Date.now();
    function checkCondition() {
      if (condition.logEnd == true) {
        condition.logEnd = false;
        resolve();
      } else if (Date.now() > start_time + 3600 * 1000) {
        resolve();
      } else {
        setTimeout(checkCondition, 1000);
      }
    }
    checkCondition();
  });
}

const browserPath =
    `C:\\Users\\abc\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe`;
const userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data`;

function log(info, logFile) {
  const fs = require('fs');
  fs.appendFileSync(logFile, String(info) + '\n');
}

async function clickDownloadButton() {
  const [newTab] = await Promise.all([
    this.page.waitForEvent('popup'),
    this.waitAndClick(this.elements.button_downloadButton)
  ]);
  return newTab;
}

async function startContext(exitCondition, logFile, model, url) {
  let browserArgs =
      `--enable-dawn-features=allow_unsafe_apis,use_dxc --enable-features=SharedArrayBuffer`;
  /*
  --enable-dawn-features=record_detailed_timing_in_trace_events,disable_timestamp_query_conversion
  --enable-tracing=disabled-by-default-gpu.dawn  --trace-startup-file=${
          tracingFile} --trace-startup-format=json`;
  */
  let context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: browserPath,
    viewport: null,
    ignoreHTTPSErrors: true,
    args: browserArgs.split(' '),
  });
  let page = await context.newPage();
  page.on('console', async msg => {
    // for (let i = 0; i < msg.args().length; ++i) {
    //   log(`[console] ${i}: ${await msg.args()[i].jsonValue()}`, logFile);
    // }

    // if (msg._event.text[0]== '{') {
    //   if(logFile.startsWith('fuse')) {
    //     const elem = logFile.split('.')[0].replace('fuse','');
    //     global.results['fuse'][elem] = JSON.parse(msg._event.text);
    //   } else {
    //     const elem = logFile.split('.')[0].replace('nofuse','');
    //     global.results['nofuse'][elem] = JSON.parse(msg._event.text);
    //   }
    // }
    let msgStr = ('' + msg.args()[0]).replace('JSHandle@', '');
    // console.log(msgStr);
    if (msgStr.includes('ortend')) {
      console.log(msgStr);
      global.results[url] = 'pass';
      exitCondition.logEnd = true;
    }
  });
  page.on('pageerror', (err) => {
    console.log('xxx' + err.message);
    global.results[url] = err.message;
    // console.log(msgStr);
    exitCondition.logEnd = true;
  });
  return [context, page];
}

async function closeContext(context) {
  await context.close();
}

async function openPage(url, logFile, model) {
  if (url == '') {
    throw 'URL is empty';
  }
  console.log(url);
  const [context, page] = await startContext(logStatus, logFile, model, url);
  await page.goto(url);
  await waitForCondition(logStatus);

  // const downloadPromise = page.waitForEvent('download');
  //  await page.getByText('Download file').click();
  // const download = await downloadPromise;
  //  const downloadPromise = page.waitForEvent('download');
  //  console.log("xxx 1");
  //  // await page.getByText('Download file').click();
  //  console.log("xxx 2");
  //  const download = await downloadPromise;
  //  console.log("xxx 3 " + download.suggestedFilename());
  //  await download.saveAs('./' + download.suggestedFilename());

  await closeContext(context);
  return logFile;
}


module.exports = openPage;
