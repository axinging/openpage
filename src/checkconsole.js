const { chromium } = require("playwright");
const renderersConfigs = {
  // test compute non-blur
  webgpucompute_0c_noblur: {
    renderer: "webgpu-compute",
    zerocopy: true,
    blur: false,
  },
  webgpucompute_1c_noblur: {
    renderer: "webgpu-compute",
    zerocopy: false,
    blur: false,
  },
  // test compute blur
  webgpucompute_0c_blur: {
    renderer: "webgpu-compute",
    zerocopy: true,
    blur: true,
  },
  webgpucompute_1c_blur: {
    renderer: "webgpu-compute",
    zerocopy: false,
    blur: true,
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
  // test graphics blur
  webgpugraphics_0c_blur: {
    renderer: "webgpu-graphics",
    zerocopy: true,
    blur: true,
  },
  webgpugraphics_1c_blur: {
    renderer: "webgpu-graphics",
    zerocopy: false,
    blur: true,
  },
  webglgraphics_noblur: { renderer: "webgl-graphics", blur: false },
  webglgraphics_blur: { renderer: "webgl-graphics", blur: true },
};
const renderers = Object.keys(renderersConfigs);
//const renderers = ["webgpu"];
const loops = [0];
// const loops = [4];
const results = [];
const repeat = 1;
async function main() {
  for (const render of renderers) {
    for (const loop of loops) {
      for (let i = 0; i < repeat; i++) {
        const config = renderersConfigs[render];
        const params = new URLSearchParams(config).toString();
        const url = `https://10.239.47.16:8080/blur.html?${params}`;
        console.log(url);
        await testUrls([url]);
      }
    }
  }
}
main();

async function testUrls(urls) {
  const browserPath = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
  const userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data11`;
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
  /*
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ["camera"],
  });*/
  const page = await context.newPage();

  for (const url of urls) {
    let consoleError = null;
    page.removeAllListeners("console");
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleError = msg.text();
      }
    });

    console.log(`Open: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    try {
      await page.waitForFunction(
        () => typeof window.startVideoProcessing === "function",
        { timeout: 10000 }
      );
    } catch {
      console.error("startVideoProcessing is not defined after 10s");
      break;
    }

    try {
      await page.evaluate(() => {
        if (typeof startVideoProcessing === "function") {
          startVideoProcessing();
        } else {
          throw new Error("startVideoProcessing is not defined");
        }
      });
    } catch (e) {
      console.error("Error calling startVideoProcessing:", e.message);
      break;
    }

    await new Promise((r) => setTimeout(r, 10000));

    if (consoleError) {
      console.error("Console error detected:", consoleError);
      break;
    }
  }

  await context.close();
}
