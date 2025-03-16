import { chromium } from 'playwright';
import { normalizeUrl, generateUrlPath, createRawMarkdown } from './utils.js';
import * as fs from 'fs/promises';
import { extractData, createMarkdownContent } from './data.js';

export async function captureScreenshot(url: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({ path: outputPath });
  } catch (error) {
    console.error(`Error capturing screenshot for ${url}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

export async function fetchPage(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    return html;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

export async function getShortestTitle(html: string): Promise<string> {
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);

  const titles = [
    $('meta[property="og:title"]').attr('content'),
    $('title').text(),
    $('h1').first().text(),
  ];

  let shortestTitle = '';
  for (const title of titles) {
    if (title && (shortestTitle === '' || title.length < shortestTitle.length)) {
      shortestTitle = title;
    }
  }
  return shortestTitle;
}

export async function processWebsite(url: string, refresh: boolean, currentDate: string): Promise<void> {
    const normalizedUrl = normalizeUrl(url);
    const urlPath = generateUrlPath(url);
    const folderPath = `src/content/websites/${urlPath}`;
    const filePath = `${folderPath}/index.md`;
    const htmlFilePath = `${folderPath}/raw.html`;
    const markdownFilePath = `${folderPath}/raw.md`;

    if (refresh) {
        console.log(`Refreshing data for ${url}`);
        const html = await fetchPage(url);
        if (html) {
            const extractedData = await extractData(html, url, currentDate);
            if (!extractedData) {
                console.error(`Skipping ${url} due to missing data.`);
                return;
            }

            const screenshotFilename = `screenshots/${normalizedUrl.replace(/[^a-z0-9]/gi, '_')}.png`;
            const screenshotPath = `public/${screenshotFilename}`;
            try {
                await captureScreenshot(url, screenshotPath);
                extractedData.desktopSnapshot = screenshotFilename;
            } catch (error) {
                // Error is already logged in captureScreenshot, but we still continue
                extractedData.desktopSnapshot = ''; // Set to empty string if capture fails
            }

            const markdownContent = createMarkdownContent(extractedData);
            try {
                await fs.mkdir(folderPath, { recursive: true });
                await fs.writeFile(filePath, markdownContent, 'utf-8');
                await fs.writeFile(htmlFilePath, html, 'utf-8');
                console.log(`Successfully wrote to ${filePath} and ${htmlFilePath}`);

            } catch (writeError) {
                console.error(`Error writing to ${filePath} or ${htmlFilePath}:`, writeError);
            }
        }
    } else {
      let existingContent: string | null = null;
      try {
          existingContent = await fs.readFile(filePath, 'utf-8');
      } catch (e) {
          // File doesn't exist, which is fine
      }
      if (!existingContent) {
        console.log(`Creating new file for ${url}`);
          const html = await fetchPage(url);
          if (html) {
              const extractedData = await extractData(html, url, currentDate);
              if (!extractedData) {
                console.error(`Skipping ${url} due to missing data.`);
                return;
              }

              const screenshotFilename = `screenshots/${normalizedUrl.replace(/[^a-z0-9]/gi, '_')}.png`;
              const screenshotPath = `public/${screenshotFilename}`;
              try {
                await captureScreenshot(url, screenshotPath);
                extractedData.desktopSnapshot = screenshotFilename;
              } catch (error) {
                // Error is already logged in captureScreenshot, but we still continue
                extractedData.desktopSnapshot = ''; // Set to empty string if capture fails
              }

              const markdownContent = createMarkdownContent(extractedData);
              try {
                  await fs.mkdir(folderPath, { recursive: true });
                  await fs.writeFile(filePath, markdownContent, 'utf-8');
                  await fs.writeFile(htmlFilePath, html, 'utf-8');
                  console.log(`Successfully wrote to ${filePath} and ${htmlFilePath}`);

              } catch(e) {
                  console.error('Error writing file', e);
              }
          }
      } else {
        console.log(`Skipping URL: ${url}`);
      }
    }
}