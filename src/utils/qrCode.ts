import QRCode from "qrcode";

export const generateQrCode = async (text: string): Promise<string> => {
  // Avoid spending time segmenting a paste that cannot fit even in numeric mode.
  if (text.length > 8000) throw new Error("QR capacity exceeded");
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const width = 1024;
  const cellPixels = Math.floor(width / (qr.modules.size + 8));
  // Draw uniform whole-pixel cells. Put the remainder into the quiet zone,
  // keeping at least four white cells on each side, even for version 40.
  const margin = (width / cellPixels - qr.modules.size) / 2;
  return QRCode.toDataURL(text, {
    version: qr.version,
    maskPattern: qr.maskPattern,
    errorCorrectionLevel: "M",
    margin,
    width,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
};
