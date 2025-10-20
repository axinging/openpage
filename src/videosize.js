const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const fs = require("fs");
const path = require("path");

// 设置ffmpeg路径
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// 宽高组合
const wxh = [{ width: 1280, height: 720 }];

/**
 * 转换WebM文件到指定宽高
 */
async function convertWebM(inputFile, outputDir) {
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const conversionPromises = wxh.map((dimension) => {
    return new Promise((resolve, reject) => {
      const outputFile = path.join(
        outputDir,
        `${dimension.width}x${dimension.height}.webm`
      );

      console.log(`正在转换: ${inputFile} -> ${outputFile}`);

      ffmpeg(inputFile)
        .size(`${dimension.width}x${dimension.height}`)
        .output(outputFile)
        .videoCodec("libvpx-vp9")
        .audioCodec("libvorbis")
        .on("end", () => {
          console.log(`转换完成: ${outputFile}`);
          resolve(outputFile);
        })
        .on("error", (err) => {
          console.error(`转换失败: ${outputFile}`, err);
          reject(err);
        })
        .run();
    });
  });

  return Promise.allSettled(conversionPromises);
}

/**
 * 获取视频文件的宽高信息
 */
async function getVideoDimensions(videoFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoFile, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video"
      );
      if (videoStream) {
        resolve({
          filename: path.basename(videoFile),
          width: videoStream.width,
          height: videoStream.height,
        });
      } else {
        reject(new Error("未找到视频流"));
      }
    });
  });
}

/**
 * 读取目录中的所有WebM文件并获取宽高信息
 */
async function readConvertedFiles(outputDir) {
  try {
    const files = fs.readdirSync(outputDir);
    const webmFiles = files.filter((file) => file.endsWith(".webm"));

    console.log("\n=== 读取转换后的文件信息 ===");

    const dimensionPromises = webmFiles.map((file) => {
      const filePath = path.join(outputDir, file);
      return getVideoDimensions(filePath);
    });

    const results = await Promise.allSettled(dimensionPromises);

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const { filename, width, height } = result.value;
        console.log(`文件: ${filename}, 宽度: ${width}, 高度: ${height}`);
      } else {
        console.error("读取文件信息失败:", result.reason);
      }
    });

    return results;
  } catch (error) {
    console.error("读取目录失败:", error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  const inputFile = process.argv[2] || "input.webm";
  const outputDir = process.argv[3] || "./output";

  // 检查输入文件是否存在
  if (!fs.existsSync(inputFile)) {
    console.error(`错误: 输入文件 ${inputFile} 不存在`);
    console.log("使用方法: node webm-converter.js <input-file> [output-dir]");
    return;
  }

  try {
    // 第一步：转换文件
    console.log("开始转换WebM文件...");
    await convertWebM(inputFile, outputDir);

    // 第二步：读取并显示文件信息
    await readConvertedFiles(outputDir);

    console.log("\n所有操作完成!");
  } catch (error) {
    console.error("程序执行出错:", error);
  }
}

// 运行程序
if (require.main === module) {
  main();
}

module.exports = { convertWebM, getVideoDimensions, readConvertedFiles };
