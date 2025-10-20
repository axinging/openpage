const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const robot = require("robotjs");

// 要执行的命令列表
const commands = [
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=1&rows=1&columns=1&import_texture_api=1" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-import-180p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=3&rows=1&columns=1&import_texture_api=1" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-import-320p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=7&rows=1&columns=1&import_texture_api=1" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-import-720p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=10&rows=1&columns=1&import_texture_api=1" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-import-1080p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=1&rows=1&columns=1&import_texture_api=0" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-copy-180p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=3&rows=1&columns=1&import_texture_api=0" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-copy-320p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=7&rows=1&columns=1&import_texture_api=0" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-copy-720p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
  String.raw`D:\workspace\users\xing\chrome.packed\chrome\Chrome-bin\chrome.exe --enable-features=D3D11VideoDecoderUseSharedHandle "http://127.0.0.1:8000/vc/webgpu_videos_mxn.html?use_large_size_video=10&rows=1&columns=1&import_texture_api=0" --enable-tracing=startup,gpu,blink.console,disabled-by-default-gpu=*,disabled-by-default-gpu.graphite,disabled-by-default-webgpu,disabled-by-default-gpu.dawn --trace-startup-file=D:\workspace\users\xing\webgpuvideo-copy-1080p.json --trace-startup-duration=5  --trace-startup-format=json --no-sandbox`,
];

// 要搜索的关键词列表
const funclist = ["Func::abc", "zero_copy"];

// 运行时间（毫秒）
const RUN_DURATION = 8000; // 10秒

class CommandRunner {
  constructor() {
    this.currentProcess = null;
    this.commandIndex = 0;
  }

  // 解析命令行参数
  parseCommand(command) {
    const args = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
      } else if (char === " " && !inQuotes) {
        if (current) {
          args.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
  }

  // 从命令中提取trace文件路径
  extractTraceFilePath(command) {
    const traceFileMatch = command.match(/--trace-startup-file=([^\s]+)/);
    return traceFileMatch ? traceFileMatch[1] : null;
  }

  // 处理tracing文件，提取包含funclist内容的行
  async processTraceFile(traceFilePath) {
    if (!traceFilePath) {
      console.log("❌ 未找到trace文件路径");
      return;
    }

    if (!fs.existsSync(traceFilePath)) {
      console.log(`❌ Trace文件不存在: ${traceFilePath}`);
      return;
    }

    console.log(`📖 处理trace文件: ${traceFilePath}`);

    try {
      // 读取文件内容
      const data = await fs.promises.readFile(traceFilePath, "utf8");

      // 按行分割
      const lines = data.split("\n");
      const matchingLines = [];

      // 查找包含funclist中任何关键词的行
      for (const line of lines) {
        if (funclist.some((func) => line.includes(func))) {
          matchingLines.push(line.trim());
        }
      }

      // 生成输出文件名
      const outputFileName =
        path.basename(traceFilePath, path.extname(traceFilePath)) + "out.json";
      const outputFilePath = path.join(
        path.dirname(traceFilePath),
        outputFileName
      );

      // 写入匹配的行到输出文件
      if (matchingLines.length > 0) {
        await fs.promises.writeFile(
          outputFilePath,
          matchingLines.join("\n"),
          "utf8"
        );
        console.log(
          `✅ 找到 ${matchingLines.length} 行匹配内容，已保存到: ${outputFilePath}`
        );

        // 在控制台也显示匹配的内容
        console.log("📋 匹配的内容:");
        matchingLines.forEach((line, index) => {
          console.log(
            `  ${index + 1}. ${line.substring(0, 100)}${
              line.length > 100 ? "..." : ""
            }`
          );
        });
      } else {
        console.log(`ℹ️  未找到包含 ${funclist.join(", ")} 的行`);
        // 创建空文件表示处理完成但无匹配
        await fs.promises.writeFile(
          outputFilePath,
          "No matching lines found.",
          "utf8"
        );
      }
    } catch (error) {
      console.log(`❌ 处理trace文件时出错: ${error.message}`);
    }
  }

  // 执行单个命令
  async executeCommand(command) {
    console.log(`\n🚀 执行命令 ${this.commandIndex + 1}:`);
    console.log(`   ${command.substring(0, 100)}...`);

    const traceFilePath = this.extractTraceFilePath(command);
    console.log(`📄 Trace文件将保存到: ${traceFilePath}`);

    const args = this.parseCommand(command);
    const program = args[0];
    const programArgs = args.slice(1);

    return new Promise((resolve, reject) => {
      try {
        console.log(`📁 启动程序: ${path.basename(program)}`);

        this.currentProcess = spawn(program, programArgs, {
          stdio: "pipe",
          detached: false,
        });

        this.currentProcess.stdout.on("data", (data) => {
          const output = data.toString().trim();
          if (output) console.log(`📤 ${output}`);
        });

        this.currentProcess.stderr.on("data", (data) => {
          const output = data.toString().trim();
          if (output) console.log(`❌ ${output}`);
        });

        this.currentProcess.on("error", (error) => {
          console.log(`💥 进程错误: ${error.message}`);
          reject(error);
        });

        this.currentProcess.on("close", async (code) => {
          console.log(`🔚 进程退出，代码: ${code}`);
          this.currentProcess = null;

          // 进程结束后处理trace文件
          if (traceFilePath) {
            console.log(`\n🔍 开始处理trace文件...`);
            await this.processTraceFile(traceFilePath);
          }

          resolve();
        });
      } catch (error) {
        console.log(`💥 启动进程时出错: ${error.message}`);
        reject(error);
      }
    });
  }

  // 等待指定时间
  async wait(duration) {
    return new Promise((resolve) => {
      console.log(`⏰ 等待 ${duration / 1000} 秒...`);
      setTimeout(resolve, duration);
    });
  }

  // 模拟Alt+F4关闭窗口
  simulateAltF4() {
    try {
      console.log("正在发送 Alt+F4 关闭窗口...");

      // 按下 Alt 键
      robot.keyToggle("alt", "down");

      // 按下 F4 键
      robot.keyToggle("f4", "down");
      robot.keyToggle("f4", "up");

      // 释放 Alt 键
      robot.keyToggle("alt", "up");

      console.log("Alt+F4 已发送");
    } catch (error) {
      console.error("发送 Alt+F4 失败:", error);
    }
  }

  // 运行所有命令
  async runAllCommands() {
    console.log("🎯 开始执行命令序列...");
    console.log(`📋 总共 ${commands.length} 个命令`);
    console.log(`🔍 搜索关键词: ${funclist.join(", ")}`);
    console.log("=".repeat(50));

    for (let i = 0; i < commands.length; i++) {
      this.commandIndex = i;
      const command = commands[i];

      console.log(`\n📊 进度: ${i + 1}/${commands.length}`);

      try {
        // 执行命令
        const executionPromise = this.executeCommand(command);

        // 等待指定时间
        await this.wait(RUN_DURATION);
        this.simulateAltF4();
        await this.wait(RUN_DURATION); // 给进程一些时间来处理关闭
      } catch (error) {
        console.log(`❌ 执行命令时出错: ${error.message}`);
      }
    }

    console.log("\n🎉 所有命令执行完成!");
  }
}

// 创建运行器实例并启动
const runner = new CommandRunner();

// 启动命令序列
runner.runAllCommands().catch(console.error);
