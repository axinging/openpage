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
        config: configToString(item.config).toLowerCase(),
        result: item.result.toFixed(2),
      };
    });
    console.table(tableData);
    let md = "| Config | Result |\n|---------|------|--------|\n";
    tableData.forEach(({ config, result }) => {
      md += `| ${config} | ${result} |\n`;
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

function configToString(config) {
  return Object.entries(config)
    .map(([key, value]) => `${key}-${value}`)
    .join("_");
}

module.exports = {
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
};
