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

function getTagFromURL(urlStr) {
  const url = require('url');
  const queryObject = url.parse(urlStr, true).query;
  let tag = '';
  const values = Object.values(queryObject);
  const len = values.length;
  const useLastParameterNo = 5;
  for (let i = len - useLastParameterNo; i < len; i++) {
    if (i != len - 1) {
      tag += values[i] + '_';
    } else {
      tag += values[i];
    }
  }
  console.log(tag);
  return tag;
}

async function runSingleBenchmark(benchmarkObject) {
  const repeat = benchmarkObject['repeat'];
  const url = benchmarkObject['url'];

  console.log(benchmarkObject['tag1']);
  let logDir;
  if (benchmarkObject['tag1'] != null) {
    logDir = __dirname + '\\' + benchmarkObject['tag'];
  } else {
    logDir = __dirname + '\\' + getTagFromURL(url);
  }
  for (let i = 0; i < repeat; i++) {
    const timestamp = getTimestamp('second');
    const logFile = logDir + '-' + timestamp + '.log';
    await openPage(url, logFile);
  }
}
function cartesianProduct(arr) {
  return arr.reduce(function(a, b) {
    return a
        .map(function(x) {
          return b.map(function(y) {
            return x.concat([y]);
          })
        })
        .reduce(function(a, b) {
          return a.concat(b)
        }, [])
  }, [[]])
}

async function getURLFromCartesianProductJSON() {
  const fsasync = require('fs').promises;
  const pagesJson = JSON.parse(await fsasync.readFile('pages_comb.json'));
  const singleTest = pagesJson[0];
  const keys = Object.keys(singleTest);
  console.log(keys);
  const values = Object.values(singleTest);
  console.log(values);
  const cartesianProductArray = cartesianProduct(values);
  let urls = [];
  for (let i = 0; i < cartesianProductArray.length; i++) {
    let url = '';
    for (let j = 0; j < keys.length; j++) {
      url += keys[j] + '=' + cartesianProductArray[i][j] + '&';
    }
    urls.push(url.replace(`${keys[0]}=`, ''));
  }
  console.log(urls);
}

(async function() {
  const [jsonType, url] = getArgs();
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

function getArgs() {
  const myArgs = process.argv.slice(2);
  let jsonType = 'flat';
  let url = '';
  switch (myArgs[0]) {
    case '--jsontype':
      jsonType = myArgs[1];
      console.log(jsonType);
      break;
    case '--url':
      url = myArgs[1];
      console.log(url);
      break;
    default:
      console.log('Error parameters');
  }
  return [jsonType, url];
}