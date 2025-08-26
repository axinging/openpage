'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

const END_TAG = 'Glow effect applied to 1080x1080 image in(ms): ';
const browserPath =
  `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
const userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data11`;

// https://github.com/axinging/webtest/blob/support_tracing3/src/open_page.js
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

function log(info, logFile) {
  const fs = require('fs');
  fs.appendFileSync(logFile, String(info) + '\n');
}

async function clickDownloadButton() {
  const [newTab] = await Promise.all([
    this.page.waitForEvent("popup"),
    this.waitAndClick(this.elements.button_downloadButton)
  ]);
  return newTab;
}

async function startContext(exitCondition, browserArgs) {
  // console.warn("If hangs here, try use a new userDataDir!");

  let context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: browserPath,
    viewport: null,
    ignoreHTTPSErrors: true,
    args: browserArgs.split(' '),
  });
  var logFile = '';
  var tracingFile = '';
  let page = await context.newPage();
  page.on('console', async msg => {
    //for (let i = 0; i < msg.args().length; ++i) {
    //  log(`[console] ${i}: ${await msg.args()[i].jsonValue()}`, logFile);
    //}

    if (msg._event.text[0] == '{') {
      if (logFile.startsWith('fuse')) {
        const elem = logFile.split('.')[0].replace('fuse', '');
        global.results['fuse'][elem] = JSON.parse(msg._event.text);
      } else {
        const elem = logFile.split('.')[0].replace('nofuse', '');
        global.results['nofuse'][elem] = JSON.parse(msg._event.text);
      }
    }
    let msgStr = ('' + msg.args()[0]).replace('JSHandle@', '');
    if (msgStr.includes(END_TAG)) {
      global.result = parseFloat(msgStr.replace(END_TAG, ""));

      exitCondition.logEnd = true;
    } else {
      // Unsupported.
    }
  });
  page.on('pageerror', (err) => { console.log(err.message) });
  return [context, page];
}

async function closeContext(context) {
  await context.close();
}

async function openPage(url, browserArgs) {
  if (url == '') {
    throw 'URL is empty';
  }
  // console.log(url);
  let logStatus = { logEnd: false };

  const [context, page] = await startContext(logStatus, browserArgs);
  await page.goto(url);
  await waitForCondition(logStatus);
  // console.log(global.result);

  await closeContext(context);
  return {
    url: url,
    browserArgs: browserArgs,
    data: global.result
  };
}

async function runLoop(url, browserArgs, count) {
  var results = [];
  var result;
  for (var i = 0; i < count; i++) {
    result = await openPage(url, browserArgs);
    results.push(result);
  }
  return results;
}

function calculateAverage(dataArray) {
  const precision = 2;
  const defaultValue = 0;
  const propertyName = 'data';
  if (!Array.isArray(dataArray)) {
    throw new Error('Must be array');
  }
  if (dataArray.length === 0) {
    return defaultValue;
  }

  const validData = dataArray.filter(item =>
    item && typeof item === 'object' &&
    typeof item[propertyName] === 'number' &&
    !isNaN(item[propertyName])
  );

  if (validData.length === 0) {
    return defaultValue;
  }
  const sum = validData.reduce((total, item) => total + item[propertyName], 0);
  const average = sum / validData.length;
  return Number(average.toFixed(precision));
}

function saveArrayToJsonSync(array, filePath) {
  try {
    const jsonString = JSON.stringify(array, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf8');
    console.log(`Saved to  ${filePath}`);
    return true;
  } catch (error) {
    console.error('Save failed!', error.message);
    return false;
  }
}

async function runSingleBenchmark() {
  var results = [];
  var results_ = [];
  var browserArgs;
  var count = 1;
  var average = 0;
  var averages = [];
  var url = 'http://1..16:5500/gloworiginal.html?draw=1000';
  let commonArgs = ' --start-maximized ';

  var backends = ['dawn-d3d12', 'dawn-d3d11'];
  var records = [10, 15, 100, 1000];
  var type = 'graphite';
  for (const backend of backends) {
    // warmup
    browserArgs = commonArgs + ` --skia-graphite-backend=dawn-d3d11  --enable-features=SkiaGraphite:max_pending_recordings/1000`;
    await runLoop(url, browserArgs, 10);

    for (const record of records) {
      const browserArgs = commonArgs + ` --skia-graphite-backend=${backend}  --enable-features=SkiaGraphite:max_pending_recordings/${record}`;
      const results_ = await runLoop(url, browserArgs, count);
      results.push(results_);
      const average = calculateAverage(results_);
      const resultEntry = {
        backend: `${type}-${backend}`,
        record: record,
        average: average
      };
      results.push(resultEntry);
      averages.push(resultEntry);
    }
  }

  //warmup
  browserArgs = commonArgs + ` --disable-skia-graphite --enable-gpu-rasterization`;
  await runLoop(url, browserArgs, count);

  type = 'ganesh';
  browserArgs = commonArgs + ` --disable-skia-graphite --enable-gpu-rasterization`;
  results_ = await runLoop(url, browserArgs, count);
  results.push(results_);
  average = calculateAverage(results_);
  results.push({ backend: type, record: 0, average: average });
  averages.push({ backend: type, record: 0, average: average });


  console.log(averages);
  saveArrayToJsonSync(results, './graphite-ganesh' + count + '.json');
  saveArrayToJsonSync(averages, './graphite-ganesh-averages' + count + '.json');
}

// warmup();
runSingleBenchmark();