const { chromium } = require("playwright");
const { exec, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const args = require("yargs").argv;

function extractFirstNumber(text, type) {
  return type == "power"
    ? extractFirstNumberPower(text)
    : extractFirstNumberMemory(text);
}

function extractFirstNumberPower(text) {
  if (typeof text !== "string") return 0;
  const match = text.match(
    /(?:^|[\s,]+)([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(?=[\s,.]|$)/
  );
  if (!match) return 0;

  const numericValue = parseFloat(match[1]);
  return isNaN(numericValue) ? 0 : numericValue;
}

function extractFirstNumberMemory(text) {
  if (typeof text !== "string") return 0;
  const match = text.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  if (!match) return 0;
  const numericValue = parseFloat(match[0]);
  return isNaN(numericValue) ? 0 : numericValue;
}

function saveArrayToJsonSync(array, filePath) {
  try {
    if (!array || !filePath) {
      throw new Error("Array and filePath are required");
    }

    filePath = String(filePath);
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      console.log(`Directory does not exist, creating: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const jsonString = JSON.stringify(array, null, 2);
    fs.writeFileSync(filePath, jsonString, "utf8");
    console.log(`Successfully saved to ${filePath}`);
    return true;
  } catch (error) {
    console.error("Save failed!", error.message);
    if (error.code === "ENOENT") {
      console.error(
        `The directory path does not exist: ${path.dirname(filePath)}`
      );
    } else if (error.code === "EACCES") {
      console.error(`Permission denied: ${filePath}`);
    }

    return false;
  }
}

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
    await waitForLowCpuUsage(5);

    // Wait 2 mins, 2 * 60 * 1000
    const TWO_MINS = isFastRun ? 10 * 1000 : 2 * 60 * 1000;
    const ONE_MINS = isFastRun ? 10 * 1000 : 1 * 60 * 1000;
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

function createTimeStampedFolder(rootFolder, prefix = "") {
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
  fs.mkdir(rootFolder, { recursive: true }, (err) => {
    if (err) {
      console.error("Error creating folder:", err);
      return;
    }
    console.log(`Folder created: ${rootFolder}`);
  });
  // Create folder
  const currentFolder = rootFolder + "\\" + folderPath;
  fs.mkdir(currentFolder, { recursive: true }, (err) => {
    if (err) {
      console.error("Error creating folder:", err);
      return;
    }
    console.log(`Folder created: ${currentFolder}`);
  });

  return currentFolder;
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

function parseSocwatchResult(type, filename) {
  try {
    const filePath = path.resolve(filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Result file not exist: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Find "Total ,                      ,"
    const KEY_POWER = "CPU/Package_0, Power";
    const KEY_MEMORY = "Total ,                      ,";
    const KEY = type == "power" ? KEY_POWER : KEY_MEMORY;
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

function changeFileExtension(file, newExtension) {
  const parsedPath = path.parse(file);
  parsedPath.base = parsedPath.name + newExtension;
  return path.format(parsedPath);
}

function generateMarkdownTable(file) {
  try {
    const rawData = fs.readFileSync(file, "utf8");
    const data = JSON.parse(rawData);
    const tableData = data.map((item) => {
      if (typeof item.result !== "number") {
        throw new Error(
          `Invalid result value in record: ${JSON.stringify(item)}`
        );
      }

      return {
        renderer: item.render.toUpperCase(),
        loop: item.loop,
        result: item.result.toFixed(2),
      };
    });
    console.table(tableData);
    let md = "| Renderer | Loop | Result |\n|---------|------|--------|\n";
    tableData.forEach(({ renderer, loop, result }) => {
      md += `| ${renderer} | ${loop} | ${result} |\n`;
    });
    fs.writeFileSync(changeFileExtension(file, ".md"), md);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

function getRenderer(renderer) {
  return renderer.includes("_") ? renderer.split("_")[0] : renderer;
}

function saveBrowserConfigToRootFolder(browserConfig, rootFolder) {
  try {
    const filePath = path.join(rootFolder, "browser_config.json");
    fs.writeFileSync(filePath, JSON.stringify(browserConfig, null, 2), "utf8");
    console.log(`Browser config saved to: ${filePath}`);
  } catch (error) {
    console.error("Failed to save browser config:", error.message);
  }
}

async function socwatch(
  type,
  info,
  repeat,
  isDryRun = false,
  isFastRun = false
) {
  const rootFolder = `.\\output_${info}`;
  const browserConfig = {
    browserPath: `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`,
    userDataDir: `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data11`,
    args: [
      "--start-maximized",
      "--disable-web-security",
      "--allow-running-insecure-content",
      "--disable-session-crashed-bubble",
      "--hide-crash-restore-bubble",
      "--enable-webgpu-developer-features  --enable-unsafe-webgpu --use-webgpu-adapter=d3d11",
    ],
  };

  try {
    const renderersConfigs = {
      // test compute non-blur
      webgpucompute_0c_noblur_do: {
        renderer: "webgpu-compute",
        zerocopy: true,
        blur: false,
        directoutput: true,
      },
      webgpucompute_1c_noblur_do: {
        renderer: "webgpu-compute",
        zerocopy: false,
        blur: false,
        directoutput: true,
      },
      webgpucompute_0c_noblur_nodo: {
        renderer: "webgpu-compute",
        zerocopy: true,
        blur: false,
        directoutput: false,
      },
      webgpucompute_1c_noblur_nodo: {
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
    for (const render of renderers) {
      for (const loop of loops) {
        for (let i = 0; i < repeat; i++) {
          const config = renderersConfigs[render];
          const params = new URLSearchParams(config).toString();
          const url = `https://10.239.47.2:8080/blur.html?${params}`;
          console.log(url);

          const folder = createTimeStampedFolder(
            rootFolder,
            `${type}_${render}_loop${loop}repeat${repeat}_i${i}`
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
            render: render,
            type: type,
            loop: loop,
            repeat: repeat,
            url: url,
            result: extractFirstNumber(result, type),
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
    const summaryFile = `${rootFolder}\\${type}-summary-${readableTimestamp}.json`;
    saveArrayToJsonSync(results, summaryFile);
    saveBrowserConfigToRootFolder(browserConfig, rootFolder);
    generateMarkdownTable(summaryFile);
  } catch (error) {
    console.error("Fail:", error);
  }
}

function startNotification() {
  try {
    execSync(
      'powershell.exe -Command "New-ItemProperty -Path HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings -Name FocusAssist -Value 0 -PropertyType DWord -Force"'
    );
    console.log("Start Focus Assist.");
  } catch (e) {
    console.error("Set Focus Assist failed:", e.message);
  }
}

function stopNotification() {
  try {
    execSync(
      'powershell.exe -Command "New-ItemProperty -Path HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings -Name FocusAssist -Value 2 -PropertyType DWord -Force"'
    );
    console.log("Start Focus Assist.");
  } catch (e) {
    console.error("Set Focus Assist failed:", e.message);
  }
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
  await socwatch(type, info, isDryRun ? 1 : repeat, isDryRun, isFastRun);
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
