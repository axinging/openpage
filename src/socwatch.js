const { chromium } = require('playwright');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const browserPath =
  `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
const userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data11`;
browserArgs = '--start-maximized';
async function monitorAndExecute() {
    let browser = null;
    let page = null;
    
    try {
        console.log('Wait cpu usage lower 2%...');
        // Wait 2%
        await waitForLowCpuUsage(50);
        console.log('CPU usage < 2%, Wait 2 mins...');
        
        // Wait 2 mins, 2 * 60 * 1000
        await delay(10*1000);
        
        console.log('Start browser...');
        /*
        browser = await chromium.launch({
            headless: false,
            args: ['--start-maximized']
        });
        */
        
        //const context = await browser.newContext();
          let context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: browserPath,
    viewport: null,
    ignoreHTTPSErrors: true,
    args: browserArgs.split(' '),
  });
        page = await context.newPage();
        
        console.log('open: https://www.com/');
        await page.goto('https://taste1981.github.io/workspace/videoeffect/blur4.html#renderer=webgpu&zeroCopy=on&directOutput=on&fakeSegmentation=fakeSegmentation&displaySize=original', {
            waitUntil: 'networkidle'
        });
        
        console.log('Wait 2 mins...');
        // Wait 2 mins
        await delay(10*1000);
        
        console.log('Click Start ...');

        const startButton = await page.$('#startButton');
        if (startButton) {
            await startButton.click();
            console.log('Button clicked!');
        } else {
            throw new Error('Cannot find #startButton');
        }
        
        console.log('Start socwatch...');

        const command = 'socwatch.exe -f cpu -f gfx -f ddr-bw -t 120 -s 20 -o test_result_1';
        await executeCommand(command);
        
        console.log('Wait 3 mins...');
        // Wait 3 mins
        await delay(10 * 1000);
        
        console.log('Close browser...');

        await browser.close();
        browser = null;
        
        console.log('Parse results...');
        await delay(3 * 60 * 1000);
        // Parse results
        const result = parseSocwatchResult('test_result_1.csv');
        return result;
        
    } catch (error) {
        console.error('Error:', error);
        
        if (browser) {
            await browser.close();
        }
        
        throw error;
    }
}

async function waitForLowCpuUsage(thresholdPercent) {
    return new Promise((resolve) => {
        const checkCpu = () => {
            getCpuUsage().then(usage => {
                if (usage < thresholdPercent) {
                    resolve();
                } else {
                    console.log(`Current cpu usage: ${usage.toFixed(2)}%，waiting...`);
                    setTimeout(checkCpu, 5000);
                }
            }).catch(error => {
                console.error('Get CPU usage failed:', error);
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
        
        cpus.forEach(cpu => {
            for (let type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        

        setTimeout(() => {
            const cpus2 = os.cpus();
            let totalIdle2 = 0;
            let totalTick2 = 0;
            
            cpus2.forEach(cpu => {
                for (let type in cpu.times) {
                    totalTick2 += cpu.times[type];
                }
                totalIdle2 += cpu.times.idle;
            });
            
            const idleDiff = totalIdle2 - totalIdle;
            const totalDiff = totalTick2 - totalTick;
            const cpuUsage = 100 - (100 * idleDiff / totalDiff);
            
            resolve(cpuUsage);
        }, 100);
    });
}


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Find "Total ,                      ,"
        const KEY = 'Total ,                      ,';
        const targetLine = lines.find(line => 
            line.includes(KEY)
        );
        
        if (!targetLine) {
            throw new Error(`Cannot find ${KEY}`);
        }
        
        return targetLine.trim();
    } catch (error) {
        console.error('Parse fail:', error);
        throw error;
    }
}

async function main() {
    try {
        const result = await monitorAndExecute();
        console.log('Result:', result);
    } catch (error) {
        console.error('Fail:', error);
    }
}

module.exports = {
    monitorAndExecute,
    waitForLowCpuUsage,
    getCpuUsage,
    parseSocwatchResult
};

if (require.main === module) {
    main();
}