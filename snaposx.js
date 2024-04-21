#!/usr/bin/env node
const { execSync } = require("child_process");
const { loadImage, Canvas } = require("canvas");
const puppeteer = require("puppeteer");
const fs = require("fs");
const os = require("os");

const saveDir = `${os.homedir()}/Documents/Snaposx`;
const imageName = `snap-${Date.now()}.png`;
const imagePath = `${saveDir}/${imageName}`;

// Take snapshot
execSync(`mkdir -p ${saveDir}`);
execSync(`screencapture -i -x -t png ${imagePath}`);

(async () => {
  // wait for three seconds
  // await new Promise((resolve) => setTimeout(resolve, 3000));

  loadImage(imagePath)
    .then(async (image) => {
      // Launch a headless browser
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      // Modify the image.
      const screenshotWidth = image.width;
      const screenshotHeight = image.height;
      const screenshotSize = [screenshotWidth, screenshotHeight];
      const screenshotAspectRatio = screenshotSize[1] / screenshotSize[0];
      const targetAspectRatio = 2 / 3;
      const independentAxis = screenshotAspectRatio > targetAspectRatio ? 1 : 0;
      // Pad based off of percent of final image size
      const outerPadPercent = 0.1;
      const screenshotPadPercent = 0.02;
      const screenshotPercent =
        1 - (2 * outerPadPercent + 2 * screenshotPadPercent);
      const finalIndependentAxisSize = Math.round(
        screenshotSize[independentAxis] / screenshotPercent,
      );
      const finalDependentAxisSize = Math.round(
        independentAxis === 0
          ? finalIndependentAxisSize * targetAspectRatio
          : finalIndependentAxisSize / targetAspectRatio,
      );
      const finalSize =
        independentAxis === 0
          ? [finalIndependentAxisSize, finalDependentAxisSize]
          : [finalDependentAxisSize, finalIndependentAxisSize];
      const outerPad = finalIndependentAxisSize * outerPadPercent;
      const screenshotPad = finalIndependentAxisSize * screenshotPadPercent;
      const bottomLeftColor = `#0069a3`;
      const topRightColor = `#00bb8a`;
      const gradient = `linear-gradient(45deg, ${bottomLeftColor}, ${topRightColor})`;
      // const borderColor = `#1e1e1e`;
      const borderColor = (() => {
        // Find the most common color in the outer pixels of the image
        const ctx = new Canvas(screenshotWidth, screenshotHeight).getContext(
          "2d",
        );
        ctx.drawImage(image, 0, 0, screenshotWidth, screenshotHeight);
        const imageData = ctx.getImageData(
          0,
          0,
          screenshotWidth,
          screenshotHeight,
        );
        const data = imageData.data;
        const colorCounts = {};
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const rgb = `${r},${g},${b}`;
          if (colorCounts[rgb]) {
            colorCounts[rgb]++;
          } else {
            colorCounts[rgb] = 1;
          }
        }
        const sortedColors = Object.keys(colorCounts).sort(
          (a, b) => colorCounts[b] - colorCounts[a],
        );
        const mostCommonColor = sortedColors[0];
        return `rgb(${mostCommonColor})`;
      })();

      // Set your HTML content
      const customHTML = `
      <style>
        * { margin: 0; padding: 0; }
        body, html { width: 100%; height: 100%; overflow: hidden; }
      </style>
      <div style="width: ${finalSize[0]}px; height: ${
        finalSize[1]
      }px; display: flex; justify-content: center; align-items: center; background-image: ${gradient};">
        <div style="width: ${
          screenshotPad * 2 + screenshotSize[0]
        }px; height: ${
        screenshotPad * 2 + screenshotSize[1]
      }px; border-radius: ${
        screenshotPad * 2
      }px; display: flex; justify-content: center; align-items: center; background-color: ${borderColor}; overflow: hidden;">
          <img id="myImage" style="width: ${screenshotSize[0]}px; height: ${
        screenshotSize[1]
      }px; object-fit: contain; border: none;" src="data:image/jpeg;base64,${fs
        .readFileSync(imagePath)
        .toString("base64")}" />
        </div>
      </div>`;

      // Set the viewport size and page content
      const width = finalSize[0]; // Adjust dimensions as needed
      const height = finalSize[1];
      await page.setViewport({ width, height });
      await page.setContent(customHTML, {
        waitUntil: "networkidle0",
      });

      // Take a screenshot and save it
      await page.screenshot({ path: imagePath });

      // Close the browser
      await browser.close();

      console.log(`Saved to ${imageName}`);

      // Open image in finder, or if a window is already open at the saveDir, select the image
      execSync(`open -R ${imagePath}`);

      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
})();
