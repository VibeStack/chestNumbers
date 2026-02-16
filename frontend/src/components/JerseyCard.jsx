import { useState, useEffect, memo } from "react";
import { generateLightQr } from "../utils/generateQr";

const getQrForPreview = async (number) => {
  return generateLightQr(number, { width: 240 });
};

const JerseyCard = memo(({ number }) => {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let mounted = true;
    getQrForPreview(number).then((img) => {
      if (mounted) setQr(img);
    });
    return () => (mounted = false);
  }, [number]);

  return (
    <div className="w-full h-[135mm] bg-white flex items-center justify-between pl-[40px] pr-[30px] box-border">
      {/* LEFT SIDE — Number + Label */}
      <div className="flex flex-col items-start">
        {/* Big Race Number — bold italic centered in half page */}
        <div
          className="font-black italic leading-[0.85] tracking-tight text-black"
          style={{ fontSize: "clamp(140px, 22vw, 220px)" }}
        >
          {String(number).padStart(3, "0")}
        </div>

        {/* Event Name — bottom-right of number */}
        <div className="text-[16px] font-semibold tracking-[0.15em] text-black/70 mt-1 self-end">
          GNDEC ATHLETIX
        </div>
      </div>

      {/* RIGHT SIDE — QR Code */}
      <div className="flex items-center justify-center">
        {qr ? (
          <img
            src={qr}
            alt={`QR for ${number}`}
            className="w-[170px] h-[170px] object-contain"
          />
        ) : (
          <div className="w-[170px] h-[170px] border border-gray-300 flex items-center justify-center text-xs text-gray-400">
            QR
          </div>
        )}
      </div>
    </div>
  );
});

JerseyCard.displayName = "JerseyCard";

export default JerseyCard;
