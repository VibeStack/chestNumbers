import express from "express";
import cors from "cors";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// Use OS temp directory for caching in serverless environments
const CACHE_DIR = path.join(os.tmpdir(), "qrcache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Store progress of active requests
const progressStore = new Map();

app.use(cors());
app.use(express.json());

// SSE Progress Endpoint
app.get("/api/progress/:id", (req, res) => {
  const { id } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendProgress = () => {
    const progress = progressStore.get(id) || 0;
    res.write(`data: ${JSON.stringify({ progress })}\n\n`);

    if (progress >= 100) {
      clearInterval(interval);
      res.end();
    }
  };

  const interval = setInterval(sendProgress, 500);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

const getQrPath = (number) => path.join(CACHE_DIR, `qr_${number}.png`);

const ensureQrOnDisk = async (number) => {
  const filePath = getQrPath(number);
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  await QRCode.toFile(filePath, JSON.stringify(number), {
    margin: 1,
    width: 300,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return filePath;
};

app.post("/api/generate-pdf", async (req, res) => {
  const { start, end, numbers: customNumbers, requestId } = req.body;

  // Build numbers list from either custom array or range
  let numbers;
  if (Array.isArray(customNumbers) && customNumbers.length > 0) {
    numbers = customNumbers
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (numbers.length === 0) {
      return res.status(400).send("No valid numbers provided");
    }
  } else if (!isNaN(start) && !isNaN(end) && start <= end) {
    numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  } else {
    return res
      .status(400)
      .send("Invalid parameters: provide start/end or numbers array");
  }

  const updateProgress = (val) => {
    if (requestId) {
      progressStore.set(requestId, Math.min(Math.round(val), 99));
    }
  };

  try {
    const totalItems = numbers.length;

    // 1. Parallel QR Disk Caching (Phase 1: 40% progress)
    const CONCURRENCY = 15;
    for (let i = 0; i < numbers.length; i += CONCURRENCY) {
      const chunk = numbers.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((num) => ensureQrOnDisk(num)));
      updateProgress(((i + chunk.length) / totalItems) * 40);
    }

    // 2. Setup PDFKit Doc (Streaming)
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
    });

    const filename = Array.isArray(customNumbers)
      ? `Jerseys_custom_${numbers.length}.pdf`
      : `Jerseys_${start}_to_${end}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    doc.pipe(res);

    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const CARD_HEIGHT = A4_HEIGHT / 2;

    // 3. Render Pages (Phase 2: 40% to 100% progress)
    for (let idx = 0; idx < numbers.length; idx++) {
      const num = numbers[idx];
      if (idx > 0) doc.addPage();

      const qrPath = getQrPath(num);

      const drawCard = (num, yOffset) => {
        const col65 = A4_WIDTH * 0.65;
        const col35 = A4_WIDTH * 0.35;

        // Branding
        doc
          .font("Helvetica-Bold")
          .fontSize(24)
          .text("GNDEC ATHLETIX", 0, yOffset + 60, {
            width: col65,
            align: "center",
          });

        // Branding Underline
        const textWidth = doc.widthOfString("GNDEC ATHLETIX");
        doc
          .moveTo((col65 - textWidth) / 2, yOffset + 90)
          .lineTo((col65 + textWidth) / 2, yOffset + 90)
          .lineWidth(3)
          .stroke();

        // Jersey Number
        const numStr = String(num);
        const numSize = numStr.length > 3 ? 120 : 180;
        doc
          .fontSize(numSize)
          .text(numStr, 0, yOffset + CARD_HEIGHT / 2 - numSize / 2, {
            width: col65,
            align: "center",
          });

        // Footer
        doc
          .fontSize(14)
          .text("ATHLETIC MEET 2026", 0, yOffset + CARD_HEIGHT - 60, {
            width: col65,
            align: "center",
          });

        // QR Code
        const qrSize = 160;
        doc.image(
          qrPath,
          col65 + (col35 - qrSize) / 2,
          yOffset + (CARD_HEIGHT - qrSize) / 2,
          {
            width: qrSize,
          },
        );

        // Outer Dotted Border
        const padding = 15;
        doc
          .rect(
            padding,
            yOffset + padding,
            A4_WIDTH - padding * 2,
            CARD_HEIGHT - padding * 2,
          )
          .dash(5, { space: 5 })
          .lineWidth(4)
          .stroke()
          .undash();
      };

      drawCard(num, 0);
      drawCard(num, CARD_HEIGHT);

      updateProgress(40 + ((idx + 1) / totalItems) * 59);
    }

    doc.end();

    if (requestId) progressStore.set(requestId, 100);

    // Cleanup progress after a delay
    if (requestId) {
      setTimeout(() => progressStore.delete(requestId), 10000);
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating PDF");
    }
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`ChestNumbers Backend running on port ${PORT}`);
  });
}

export default app;
