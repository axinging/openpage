const { chromium } = require("playwright");
const { exec, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const args = require("yargs").argv;

const {
  extractFirstNumber,
  extractFirstNumberPower,
  extractFirstNumberMemory,
  saveArrayToJsonSync,
  createTimeStampedFolder,
  waitForLowCpuUsage,
  getCpuUsage,
  startNotification,
  stopNotification,
  delay,
  executeCommand,
  parseSocwatchResult,
  changeFileExtension,
  generateMarkdownTable,
  getRenderer,
  saveBrowserConfigToRootFolder,
  configToString,
} = require("./socwatch_util");

async function monitorAndExecute(
  url,
  type,
  folder,
  browserConfig,
  isFastRun = false
) {
  const browserPath = browserConfig.browserPath; //`${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
  const userDataDir = browserConfig.userDataDir; //`${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data11`;
  // const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-user-data-"));
  let page = null;

  try {
    console.log("Wait 2 mins till CPU usage < 5%...");
    // Wait 5%
    isFastRun ? await waitForLowCpuUsage(50) : await waitForLowCpuUsage(5);

    // Wait 2 mins, 2 * 60 * 1000
    const TWO_MINS = isFastRun ? 5 * 1000 : 2 * 60 * 1000;
    const ONE_MINS = isFastRun ? 5 * 1000 : 1 * 60 * 1000;
    await delay(TWO_MINS);

    console.log("Start browser...");
    var context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath: browserPath,
      viewport: null,
      ignoreHTTPSErrors: true,
      headless: false,
      permissions: ["camera", "microphone", "geolocation"],
      args: browserConfig.args,
    });

    page = await context.newPage();

    console.log(`Open: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle",
    });

    console.log("Wait 1 mins after open page...");
    // Wait 1 mins
    await delay(ONE_MINS);
    /*
    console.log("Click start button...");
    const startButton = await page.$("#startButton");
    if (startButton) {
      await startButton.click();
    } else {
      throw new Error("Cannot find #startButton");
    }*/
    console.log("Start video processing...");
    await page.evaluate(() => {
      if (typeof startVideoProcessing === "function") {
        startVideoProcessing();
      } else {
        throw new Error("startVideoProcessing is not defined");
      }
    });

    console.log("Start socwatch...");
    const resultFileName = "result";
    const command_memory = `socwatch.exe -f cpu -f gfx -f ddr-bw -t 120 -s 20 -o .\\${folder}\\${resultFileName}`;
    const command_power = `socwatch.exe -t 120 -s 20 -f power -o .\\${folder}\\${resultFileName}`;
    const command = type == "power" ? command_power : command_memory;
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
    const result = parseSocwatchResult(
      type,
      `.\\${folder}\\${resultFileName}.csv`
    );
    //fs.rmSync(userDataDir, { recursive: true, force: true });
    return result;
  } catch (error) {
    console.error("Error:", error);
    if (context) {
      await context.close();
    }
    //fs.rmSync(userDataDir, { recursive: true, force: true });
    throw error;
  }
  // Clean up
}

async function socwatch(
  type = "power",
  browserConfig = "",
  info = "",
  repeat = 5,
  isDryRun = false,
  isFastRun = false
) {
  const rootFolder = `.\\output_${info}`;
  try {
    const renderersConfigs = {
      // test compute non-blur
      webgpucompute_0c_noblur_1directoutput: {
        renderer: "webgpu-compute",
        zerocopy: true,
        blur: false,
        directoutput: true,
      },
      webgpucompute_1c_noblur_1directoutput: {
        renderer: "webgpu-compute",
        zerocopy: false,
        blur: false,
        directoutput: true,
      },
      webgpucompute_0c_noblur_0directoutput: {
        renderer: "webgpu-compute",
        zerocopy: true,
        blur: false,
        directoutput: false,
      },
      webgpucompute_1c_noblur_0directoutput: {
        renderer: "webgpu-compute",
        zerocopy: false,
        blur: false,
        directoutput: false,
      },
      // test graphics non-blur
      webgpugraphics_0c_noblur: {
        renderer: "webgpu-graphics",
        zerocopy: true,
        blur: false,
      },
      webgpugraphics_1c_noblur: {
        renderer: "webgpu-graphics",
        zerocopy: false,
        blur: false,
      },
      webglgraphics_noblur: { renderer: "webgl-graphics", blur: false },
    };
    const renderers = Object.keys(renderersConfigs);
    //const renderers = ["webgpu"];
    const loops = [0];
    // const loops = [4];
    const results = [];
    for (const renderer of renderers) {
      for (let i = 0; i < repeat; i++) {
        const config = renderersConfigs[renderer];
        const params = new URLSearchParams(config).toString();
        const url = `https://10.239.47.2:8080/blur.html?autostart=false&${params}`;
        console.log(url);

        const folder = createTimeStampedFolder(
          rootFolder,
          `${type}_${configToString(config)}_repeat${repeat}_i${i}`
        );
        const result = isDryRun
          ? { dryRun: true }
          : await monitorAndExecute(
              url,
              type,
              folder,
              browserConfig,
              isFastRun
            );
        saveArrayToJsonSync(result, `${folder}\\1.json`);
        const result2 = {
          config: config,
          type: type,
          repeat: repeat,
          url: url,
          result: extractFirstNumber(result, type),
        };
        console.log(JSON.stringify(result2));
        results.push(result2);
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
    const summaryFile = `${rootFolder}\\${type}-summary-${readableTimestamp}.json`;
    saveArrayToJsonSync(results, summaryFile);
    saveBrowserConfigToRootFolder(browserConfig, rootFolder);
    generateMarkdownTable(summaryFile);
  } catch (error) {
    console.error("Fail:", error);
  }
}

function createBrowserConfig(backend) {
  const backendArg =
    !backend || backend === "" ? "" : `--use-webgpu-adapter=${backend}`;
  if (backend) {
    args.push(`--use-webgpu-adapter=${backend}`);
  }
  return {
    browserPath: `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`,
    userDataDir: `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data1111`,
    args: [
      "--start-maximized",
      "--disable-web-security",
      "--allow-running-insecure-content",
      "--disable-session-crashed-bubble",
      "--hide-crash-restore-bubble",
      `--enable-webgpu-developer-features  --enable-unsafe-webgpu ${backendArg}`,
      // If put backendArg in another line, playwright reports No available adapters.
      // backendArg,
    ],
  };
}

function createBrowserConfig2(backend) {
  const args = [
    "--start-maximized",
    "--disable-web-security",
    "--allow-running-insecure-content",
    "--disable-session-crashed-bubble",
    "--hide-crash-restore-bubble",
    "--enable-webgpu-developer-features",
    "--enable-unsafe-webgpu",
  ];
  if (backend) {
    args.push(`--use-webgpu-adapter=${backend}`);
  }
  return {
    browserPath: `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`,
    userDataDir: `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data1111`,
    args,
  };
}

async function main() {
  stopNotification();
  const start = performance.now();
  const info = args.info && args.info != "" ? args.info : "";
  // memory, power
  const type = args.type && args.type != "" ? args.type : "power";
  const repeat = args.repeat && args.repeat != "" ? args.repeat : 5;
  const isDryRun = args.dryRun || args.dryrun || false;
  const isFastRun = args.fastRun || args.fastrun || false;

  for (const backend of ["d3d11", "d3d12"]) {
    const browserConfig = createBrowserConfig(backend);
    await socwatch(
      type,
      browserConfig,
      info + backend,
      isDryRun ? 1 : repeat,
      isDryRun,
      isFastRun
    );
  }

  const end = performance.now();
  const durationInSeconds = (end - start) / 1000;
  console.log(`Time used: ${durationInSeconds.toFixed(3)} s`);
  startNotification();
}

module.exports = {
  socwatch,
};

if (require.main === module) {
  main();
}
