'use strict';

const openPage = require('./open_page.js');
const fs = require('fs');

function padZero(str) {
  return ('0' + str).slice(-2);
}
function getTimestamp(format) {
  const date = new Date();
  let timestamp = date.getFullYear() + padZero(date.getMonth() + 1) +
      padZero(date.getDate());
  if (format == 'second') {
    timestamp += padZero(date.getHours()) + padZero(date.getMinutes()) +
        padZero(date.getSeconds());
  }
  return timestamp;
}

async function runSingleBenchmark(benchmarkObject) {
  console.log(benchmarkObject);

  const repeat = benchmarkObject['repeat'];
  const url = benchmarkObject['url'];
  const logDir = __dirname + '\\' +benchmarkObject['tag'];

  for (let i = 0; i < repeat; i++) {
    const timestamp = getTimestamp('second');
    const logFile = logDir +'-'+ timestamp+ ".log";
    await openPage(url, logFile);
  }
}


(async function() {
  const fsasync = require('fs').promises;
  const pagesJson = JSON.parse(await fsasync.readFile("pages.json"));

  for (let i = 0; i < pagesJson.length; i++) {
    await runSingleBenchmark(pagesJson[i]);
  }
})();
