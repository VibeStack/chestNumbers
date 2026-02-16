import fs from "fs";
import path from "path";
import QRCode from "qrcode";

const CACHE_DIR = "/tmp/qrcache";

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export const getQrPath = (number) => path.join(CACHE_DIR, `qr_${number}.png`);

export const ensureQrOnDisk = async (number) => {
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
