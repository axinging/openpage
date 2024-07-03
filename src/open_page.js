'use strict';
const {chromium} = require('playwright');
// https://github.com/axinging/webtest/blob/support_tracing3/src/open_page.js
let logStatus = {logEnd: false};

async function waitForCondition(condition) {
  return new Promise(resolve => {
    var start_time = Date.now();
    function checkCondition() {
      if (condition.logEnd == true) {
        console.log('Test end');
        condition.logEnd = false;
        resolve();
      } else if (Date.now() > start_time + 3600 * 1000) {
        console.log('Test time out');
        resolve();
      } else {
        setTimeout(checkCondition, 1000);
      }
    }
    checkCondition();
  });
}

const browserPath =
    `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
const userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data`;

function log(info, logFile) {
  // console.log(info);
  const fs = require('fs');
  fs.appendFileSync(logFile, String(info) + '\n');
}

async function clickDownloadButton(){
  const [newTab] = await Promise.all([
      this.page.waitForEvent("popup"),
      this.waitAndClick(this.elements.button_downloadButton)
  ]);
  return newTab;
}

async function startContext(exitCondition, logFile, tracingFile = '') {
  let browserArgs =`--enable-dawn-features=allow_unsafe_apis,use_dxc --enable-features=SharedArrayBuffer`;
  /*
  --enable-dawn-features=record_detailed_timing_in_trace_events,disable_timestamp_query_conversion 
  --enable-tracing=disabled-by-default-gpu.dawn  --trace-startup-file=${
          tracingFile} --trace-startup-format=json`;
  */
  console.log(browserArgs);
  let context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: browserPath,
    viewport: null,
    ignoreHTTPSErrors: true,
    args: browserArgs.split(' '),
  });
  let page = await context.newPage();
  page.on('console', async msg => {
    for (let i = 0; i < msg.args().length; ++i) {
      log(`[console] ${i}: ${await msg.args()[i].jsonValue()}`, logFile);
    }

    if (msg._event.text[0]== '{') {
      if(logFile.startsWith('fuse')) {
        global.results['fuse'][logFile] = JSON.parse(msg._event.text);
      } else {
        global.results['nofuse'][logFile] = JSON.parse(msg._event.text);
      }
    }
    let msgStr = ('' + msg.args()[0]).replace('JSHandle@', '');
    if (msgStr.includes('ortend')) {

      exitCondition.logEnd = true;
    } else {
      // Unsupported.
    }
  });
  page.on('pageerror', (err) => {console.log(err.message)});
  return [context, page];
}

async function closeContext(context) {
  await context.close();
}

async function openPage(url, logFile, tracingFile = '') {
  if (url == '') {
    throw 'URL is empty';
  }
  const [context, page] = await startContext(logStatus, logFile, tracingFile);
  await page.goto(url);
  await waitForCondition(logStatus);

  //const downloadPromise = page.waitForEvent('download');
  // await page.getByText('Download file').click();
  //const download = await downloadPromise;
  // const downloadPromise = page.waitForEvent('download');
  // console.log("xxx 1");
  // // await page.getByText('Download file').click();
  // console.log("xxx 2");
  // const download = await downloadPromise;
  // console.log("xxx 3 " + download.suggestedFilename());
  // await download.saveAs('./' + download.suggestedFilename());

  await closeContext(context);
  return logFile;
}


module.exports = openPage;
