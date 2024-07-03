'use strict';
global.results = {};
global.results['fuse'] = {};
global.results['nofuse'] = {};
const openPage = require('./open_page.js');
const fs = require('fs');
const args = require('yargs').argv;

async function runSingleBenchmark(benchmarkObject) {
  const url = benchmarkObject['url'];
  const repeat = benchmarkObject['repeat'];
  const logFile = benchmarkObject['logFile'];
  let logDir = __dirname + '\\out\\'
  console.log(logFile)
  for (let i = 0; i < repeat; i++) {
    await openPage(url, logFile);
  }
}

async function runURL(dataJson) {
  const pagesJson = dataJson['urlinfo'];
  const singleTest = pagesJson;
  const keys = Object.keys(singleTest);
  const values = Object.values(singleTest);
  console.log(values);
  console.log('pagesJson' + JSON.stringify(pagesJson))
  const startValue = pagesJson.inputSize[0];
  const endValue = pagesJson.inputSize[1];
  let url = pagesJson.url;
  console.log(startValue);
  console.log(endValue);
  for (let i = startValue; i <= endValue; i++) {
    let finalUrl = url + '?value=' + i;
    let urls =
        'https://10.239.47.10:8080/onnx-model-nofuse-clamp-debug56.html' +
        '?value=' + i;
    console.log(urls);
    await runSingleBenchmark(
        {'repeat': 1, 'url': urls, 'logFile': 'nofuse' + i + '.txt'});
    urls = 'https://10.239.47.10:8080/onnx-model-fuse-clamp-debug56.html' +
        '?value=' + i;
    await runSingleBenchmark(
        {'repeat': 1, 'url': urls, 'logFile': 'fuse' + i + '.txt'});
    // Start waiting for download before clicking. Note no await.
  }
}

async function getURLFromCartesianProductJSON() {
  const fsasync = require('fs').promises;
  const allDataJson = JSON.parse(await fsasync.readFile('pages_ort.json'));
  console.log(allDataJson.length);
  for (let i = 0; i < allDataJson.length; i++) {
    await runURL(allDataJson[i]);
  }
}

(async function() {
  const jsonType = args.jsontype;
  const email = args.email;
  console.log(jsonType + ', Please add allPredictEnd to your case.');
  if (jsonType != 'flat') {
    await getURLFromCartesianProductJSON();
  } else {
    const fsasync = require('fs').promises;
    const pagesJson = JSON.parse(await fsasync.readFile('pages.json'));
    for (let i = 0; i < pagesJson.length; i++) {
      await runSingleBenchmark(pagesJson[i]);
    }
  }
  // console.log(global.results['fuse']);
  fs.writeFileSync('fusedata.json', JSON.stringify(global.results['fuse']));
  fs.writeFileSync('nofusedata.json', JSON.stringify(global.results['nofuse']));
})();
