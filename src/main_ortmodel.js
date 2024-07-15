'use strict';
global.results = {};
global.results['pass'] = {};
global.results['fail'] = {};
const openPage = require('./open_page_ortmodel.js');
const fs = require('fs');
const args = require('yargs').argv;
const path = require('path');

async function runSingleBenchmark(benchmarkObject) {
  const url = benchmarkObject['url'];
  const repeat = benchmarkObject['repeat'];
  const logFile = benchmarkObject['logFile'];
  const model = benchmarkObject['model'];
  let logDir = __dirname + '\\out\\'
  //console.log(logFile)
  for (let i = 0; i < repeat; i++) {
    await openPage(url, logFile, model);
  }
}

const w = '1111';

async function runURL(modelName) {
  const port1 = "8080";
  const port2 = "8081"; // "should fail"
  const url1 = `https://10.239.47.10:${port1}/ort-toolkit/?ortUrl=https://10.239.47.10:${port1}/onnxruntime&modelName=`;
  const url1end = "&task=ortProfiling&ep=webgpu&modelUrl=wp-27&enableIoBinding=true&runTimes=1&warmupTimes=0&enableDebug=true&enableFreeDimensionOverrides=true&enableGraphCapture=true";


  const url2 = `https://10.239.47.10:${port2}/ort-toolkit/?ortUrl=https://10.239.47.10:${port2}/onnxruntime&modelName=`;
  const url2end = "&task=ortProfiling&ep=webgpu&modelUrl=wp-27&enableIoBinding=true&runTimes=1&warmupTimes=0&enableDebug=true&enableFreeDimensionOverrides=true&enableGraphCapture=true";

    let finalUrl1 = url1 + modelName + url1end;
    let finalUrl2 = url2 + modelName + url2end;
    //console.log(finalUrl1);
    //console.log(finalUrl2);
    await runSingleBenchmark(
       {'repeat': 1, 'url': finalUrl1, 'logFile': 'pass8080.txt', 'model': modelName});
    await runSingleBenchmark(
      {'repeat': 1, 'url': finalUrl2, 'logFile': 'fail8081.txt', 'model': modelName});
    // Start waiting for download before clicking. Note no await.
  return [0, 0];
}

function ensureDirectoryExistence(filePath) {
  if (fs.existsSync(filePath)) {
    return true;
  }
  fs.mkdirSync(filePath);
}

async function getURLFromCartesianProductJSON() {
  const models = ['whisper-tiny-decoder', 'whisper-tiny-encoder'];

  for (let i = 0; i < models.length; i++) {
    let model =models[i];
    global.results = {};
    global.results['pass'] = {};
    global.results['fail'] = {};
    const modelName = 'whisper-tiny-decoder';
    await runURL(model);

    //ensureDirectoryExistence('./fusedata'+w);
    //ensureDirectoryExistence('./fusedatano'+w);
    //fs.writeFileSync('./fusedata'+w+'/data'+startValue+ '-'+ endValue+ '.json', JSON.stringify(global.results['fuse']));
    //fs.writeFileSync('./fusedatano'+w+'/data'+startValue+ '-'+ endValue+ '.json', JSON.stringify(global.results['nofuse']));
    console.log(global.results);
    //console.log(global.results['fail']);
  }

}

(async function() {
  await getURLFromCartesianProductJSON();
  
})();
