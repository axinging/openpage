const { chromium } = require("playwright");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const args = require("yargs").argv;

const browserPath = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
const userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data11`;
browserArgs = "--start-maximized";
async function monitorAndExecute(url, folder) {
  let browser = null;
  let page = null;

  try {
    console.log("Wait 2 mins till CPU usage < 5%...");
    // Wait 5%
    await waitForLowCpuUsage(5);

    // Wait 2 mins, 2 * 60 * 1000
    const TWO_MINS = 2 * 60 * 1000;
    const ONE_MINS = 1 * 60 * 1000;
    await delay(TWO_MINS);

    console.log("Start browser...");
    var context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath: browserPath,
      viewport: null,
      ignoreHTTPSErrors: true,
      headless: false,
      permissions: ["camera", "microphone", "geolocation"],
      args: [
        "--start-maximized",
        "--disable-web-security",
        "--allow-running-insecure-content",
      ],
    });

    page = await context.newPage();

    console.log(`Open: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle",
    });

    console.log("Wait 1 mins after open page...");
    // Wait 1 mins
    await delay(ONE_MINS);

    console.log("Click start button...");
    const startButton = await page.$("#startButton");
    if (startButton) {
      await startButton.click();
    } else {
      throw new Error("Cannot find #startButton");
    }

    console.log("Start socwatch...");
    const resultFileName = "result";
    const command = `socwatch.exe -f cpu -f gfx -f ddr-bw -t 120 -s 20 -o .\\${folder}\\${resultFileName}`;
    await executeCommand(command);

    console.log("Wait 3 mins, socwatch needs 2 mins...");
    // Wait 3 mins
    const THREE_MINS = 3 * 60 * 1000;
    await delay(THREE_MINS);

    console.log("Close browser...");

    await context.close();
    context = null;

    console.log("Parse results...");
    // await delay(ONE_MINS);
    // Parse results
    const result = parseSocwatchResult(`.\\${folder}\\${resultFileName}.csv`);
    return result;
  } catch (error) {
    console.error("Error:", error);

    if (context) {
      await context.close();
    }

    throw error;
  }
}

function createTimeStampedFolder(prefix = "") {
  const basePath = "./";
  // Get current timestamp
  const now = new Date();

  // Format timestamp as YYYY-MM-DD_HH-MM-SS
  const timestamp = now
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "")
    .replace("T", "_");

  // Create folder path
  const folderName = `${prefix}_${timestamp}`;
  const folderPath = path.join(basePath, folderName);

  // Create folder
  fs.mkdir(folderPath, { recursive: true }, (err) => {
    if (err) {
      console.error("Error creating folder:", err);
      return;
    }
    console.log(`Folder created: ${folderPath}`);
  });

  return folderPath;
}

async function waitForLowCpuUsage(thresholdPercent) {
  return new Promise((resolve) => {
    const checkCpu = () => {
      getCpuUsage()
        .then((usage) => {
          if (usage < thresholdPercent) {
            resolve();
          } else {
            console.log(`Current cpu usage: ${usage.toFixed(2)}%，waiting...`);
            setTimeout(checkCpu, 5000);
          }
        })
        .catch((error) => {
          console.error("Get CPU usage failed:", error);
          setTimeout(checkCpu, 5000);
        });
    };

    checkCpu();
  });
}

function getCpuUsage() {
  return new Promise((resolve, reject) => {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    setTimeout(() => {
      const cpus2 = os.cpus();
      let totalIdle2 = 0;
      let totalTick2 = 0;

      cpus2.forEach((cpu) => {
        for (let type in cpu.times) {
          totalTick2 += cpu.times[type];
        }
        totalIdle2 += cpu.times.idle;
      });

      const idleDiff = totalIdle2 - totalIdle;
      const totalDiff = totalTick2 - totalTick;
      const cpuUsage = 100 - (100 * idleDiff) / totalDiff;

      resolve(cpuUsage);
    }, 100);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Command error: ${error}`);
        reject(error);
        return;
      }
      console.log(`Command output: ${stdout}`);
      if (stderr) {
        console.error(`Command error output: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

function parseSocwatchResult(filename) {
  try {
    const filePath = path.resolve(filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Result file not exist: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Find "Total ,                      ,"
    const KEY = "Total ,                      ,";
    const targetLine = lines.find((line) => line.includes(KEY));

    if (!targetLine) {
      console.error(`Cannot find ${KEY}`);
      return "";
    }

    return targetLine.trim();
  } catch (error) {
    console.error("Parse fail:", error);
    throw error;
  }
}

function saveArrayToJsonSync(array, filePath) {
  try {
    const jsonString = JSON.stringify(array, null, 2);
    fs.writeFileSync(filePath, jsonString, "utf8");
    console.log(`Saved to  ${filePath}`);
    return true;
  } catch (error) {
    console.error("Save failed!", error.message);
    return false;
  }
}

async function main() {
  const start = performance.now();
  const info = args.info && args.info != "" ? args.info : "";
  const repeat = args.repeat && args.repeat != "" ? args.repeat : 4;

  try {
    const renderers = ["webgpu", "webgl2"];
    const loops = [4, 0];
    const results = [];
    for (const render of renderers) {
      for (const loop of loops) {
        for (let i = 0; i < repeat; i++) {
          const baseUrl = `https://10.239.47.2:8080/blur4.html?renderer=${render}&fakeSegmentation=fakeSegmentation&displaySize=original`;

          const url =
            render === "webgpu"
              ? `${baseUrl}&zeroCopy=on&directOutput=on&loop=${loop}`
              : `${baseUrl}&loop=${loop}`;

          const folder = createTimeStampedFolder(
            `${render}loop${loop}repeat${repeat}_i${i}`
          );
          const result = await monitorAndExecute(url, folder);
          saveArrayToJsonSync(result, `${folder}/1.json`);
          const result2 = {
            render: render,
            loop: loop,
            repeat: repeat,
            result: extractFirstNumber(result),
          };
          console.log(JSON.stringify(result2));
          results.push(result2);
        }
      }
    }
    const readableTimestamp = new Date()
      .toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-")
      .replace(/:/g, "-")
      .replace(" ", "_");
    saveArrayToJsonSync(results, `summary-${readableTimestamp}.json`);
  } catch (error) {
    console.error("Fail:", error);
  }
  const end = performance.now();
  const durationInSeconds = (end - start) / 1000;
  console.log(`Time used: ${durationInSeconds.toFixed(3)} s`);
}

module.exports = {
  monitorAndExecute,
  waitForLowCpuUsage,
  getCpuUsage,
  parseSocwatchResult,
};

if (require.main === module) {
  main();
}

function extractFirstNumber(text) {
  if (typeof text !== "string") return 0;
  const match = text.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  if (!match) return 0;
  const numericValue = parseFloat(match[0]);
  return isNaN(numericValue) ? 0 : numericValue;
}
