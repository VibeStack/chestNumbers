import PDFDocument from "pdfkit";
import { getQrPath, ensureQrOnDisk } from "../utils/qrCache.js";

// In-memory progress store for SSE
const progressStore = new Map();

// --- SSE Progress Endpoint ---
export const progressSSE = (req, res) => {
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
};

// --- PDF Generation Endpoint ---
export const generatePdf = async (req, res) => {
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

    // Phase 1: Parallel QR Disk Caching (0% → 40%)
    const CONCURRENCY = 15;
    for (let i = 0; i < numbers.length; i += CONCURRENCY) {
      const chunk = numbers.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((num) => ensureQrOnDisk(num)));
      updateProgress(((i + chunk.length) / totalItems) * 40);
    }

    // Phase 2: Setup PDFKit Doc
    const doc = new PDFDocument({ size: "A4", margin: 0 });

    const filename = Array.isArray(customNumbers)
      ? `Jerseys_custom_${numbers.length}.pdf`
      : `Jerseys_${start}_to_${end}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    doc.pipe(res);

    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const CARD_HEIGHT = A4_HEIGHT / 2;

    // Draw a single half-page jersey card
    const drawCard = (num, yOffset, qrPath) => {
      const leftPadding = 40;
      const rightPadding = 30;

      // Jersey Number — big bold italic, vertically centered
      const numStr = String(num).padStart(3, "0");
      const numSize = numStr.length > 3 ? 120 : 180;
      const numY = yOffset + CARD_HEIGHT / 2 - numSize / 2;

      doc
        .font("Helvetica-BoldOblique")
        .fontSize(numSize)
        .text(numStr, leftPadding, numY, { lineBreak: false });

      // "GNDEC ATHLETIX" — small text below number, right-aligned
      const numWidth = doc.widthOfString(numStr);
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text("GNDEC ATHLETIX", leftPadding, numY + numSize * 0.85 + 4, {
          width: numWidth,
          align: "right",
          lineBreak: false,
        });

      // QR Code — centered vertically on the right
      const qrSize = 150;
      const qrX = A4_WIDTH - rightPadding - qrSize;
      const qrY = yOffset + (CARD_HEIGHT - qrSize) / 2;
      doc.image(qrPath, qrX, qrY, { width: qrSize });
    };

    // Phase 3: Render Pages (40% → 100%)
    for (let idx = 0; idx < numbers.length; idx++) {
      const num = numbers[idx];
      if (idx > 0) doc.addPage();

      const qrPath = getQrPath(num);
      drawCard(num, 0, qrPath);
      drawCard(num, CARD_HEIGHT, qrPath);

      updateProgress(40 + ((idx + 1) / totalItems) * 59);
    }

    doc.end();

    if (requestId) progressStore.set(requestId, 100);
    if (requestId) {
      setTimeout(() => progressStore.delete(requestId), 10000);
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating PDF");
    }
  }
};
