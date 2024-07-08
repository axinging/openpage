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
  //console.log(logFile)
  for (let i = 0; i < repeat; i++) {
    await openPage(url, logFile);
  }
}

async function runURL(dataJson, startValue, endValue) {
  const pagesJson = dataJson['urlinfo'];
  const singleTest = pagesJson;
  const keys = Object.keys(singleTest);
  const values = Object.values(singleTest);
  //const startValue = pagesJson.inputSize[0];
  //const endValue = pagesJson.inputSize[1];
  let url = pagesJson.url;
  console.log(startValue + ', ' + endValue);
  for (let i = startValue; i <= endValue; i++) {
    let finalUrl = url + '?value=' + i;
    let urls =
        'https://10.239.47.10:8080/onnx-model-nofuse-clamp-debug56.html' +
        '?value=' + i;
    await runSingleBenchmark(
        {'repeat': 1, 'url': urls, 'logFile': 'nofuse' + i + '.txt'});
    urls = 'https://10.239.47.10:8080/onnx-model-fuse-clamp-debug56.html' +
        '?value=' + i;
    await runSingleBenchmark(
        {'repeat': 1, 'url': urls, 'logFile': 'fuse' + i + '.txt'});
    // Start waiting for download before clicking. Note no await.
  }
  return [startValue, endValue];
}

async function getURLFromCartesianProductJSON() {
  const fsasync = require('fs').promises;
  const allDataJson = JSON.parse(await fsasync.readFile('pages_ort.json'));
  for (let i = 171; i < 660; i++) {
    global.results = {};
    global.results['fuse'] = {};
    global.results['nofuse'] = {};
    const startValue = i *100;
    const endValue = (i+1)*100 - 1;
     await runURL(allDataJson[0], startValue, endValue);
      // console.log(global.results['fuse']);
    fs.writeFileSync('fusedata'+startValue+ '-'+ endValue+ '.json', JSON.stringify(global.results['fuse']));
    fs.writeFileSync('nofusedata'+startValue+ '-'+ endValue+ '.json', JSON.stringify(global.results['nofuse']));
  }
}

(async function() {
  const jsonType = args.jsontype;
  const email = args.email;
  if (jsonType != 'flat') {
    await getURLFromCartesianProductJSON();
  } else {
    const fsasync = require('fs').promises;
    const pagesJson = JSON.parse(await fsasync.readFile('pages.json'));
    for (let i = 0; i < pagesJson.length; i++) {
      await runSingleBenchmark(pagesJson[i]);
    }
  }

})();
