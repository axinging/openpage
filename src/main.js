'use strict';

const openPage = require('./open_page.js');
const fs = require('fs');
const args = require('yargs').argv;

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
    logDir = __dirname + '\\out\\' + benchmarkObject['tag'];
  } else {
    logDir = __dirname + '\\out\\' + getTagFromURL(url);
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

async function runURL(dataJson) {
  const repeat = dataJson["runinfo"]["repeat"];
  const endTag = dataJson["runinfo"]["endtag"];
  const pagesJson = dataJson["urlinfo"];
  const singleTest = pagesJson;
  const keys = Object.keys(singleTest);
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
    const finalUrl = url.replace(`${keys[0]}=`, '');
    await runSingleBenchmark({"repeat":repeat, "url":finalUrl});
  }
  console.log(urls);
}

async function getURLFromCartesianProductJSON() {
  const fsasync = require('fs').promises;
  const allDataJson = JSON.parse(await fsasync.readFile('pages_comb.json'));
  for (let i =0 ; i < allDataJson.length;i++) {
    await runURL(allDataJson[i]);
  }

}

(async function() {
  const jsonType = args.jsontype;
  const email = args.email;
  console.log(jsonType+ ", Please add allPredictEnd to your case.");
  if (jsonType != 'flat') {
    await getURLFromCartesianProductJSON();
  } else {
    const fsasync = require('fs').promises;
    const pagesJson = JSON.parse(await fsasync.readFile('pages.json'));
    for (let i = 0; i < pagesJson.length; i++) {
      await runSingleBenchmark(pagesJson[i]);
    }
  }
  if(email&& email!='') {
    await sendMail(email, "Will Read Test id done");
  }
})();

async function sendMail(to, subject, html = '') {
  let from = to;
  var domain = from.substring(from.lastIndexOf("@") +1);

  const nodemailer = require('nodemailer');
  let transporter = nodemailer.createTransport({
    host: `ecsmtp.sh.${domain}`,
    port: 25,
    secure: false,
    auth: false,
  });

  transporter.verify(error => {
    if (error)
      console.log('transporter error: '+error);
    else
      console.log('Email was sent!');
  });

  let info = await transporter.sendMail({
    from: from,
    to: to,
    subject: subject,
    html: html,
  });
  return Promise.resolve();
}
