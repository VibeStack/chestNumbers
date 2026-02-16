import { useState, useEffect } from "react";
import { generateLightQr } from "../utils/generateQr";

const UrlQrModal = ({ onClose }) => {
  const [customUrl, setCustomUrl] = useState("");
  const [customQr, setCustomQr] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!customUrl) {
        setCustomQr("");
        return;
      }
      const qr = await generateLightQr(customUrl, { width: 400 });
      setCustomQr(qr);
    }, 300);
    return () => clearTimeout(timer);
  }, [customUrl]);

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md no-print animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-[2.5rem] p-6 md:p-10 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all text-2xl group"
          onClick={onClose}
        >
          <span className="group-hover:rotate-90 transition-transform duration-300">
            &times;
          </span>
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">
            🔗
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Website QR
            </h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">
              Instant Link Generator
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex justify-between items-end px-1">
              <label
                htmlFor="targetUrl"
                className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
              >
                Target URL
              </label>
              {customUrl && (
                <button
                  onClick={() => setCustomUrl("")}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-[0.2em]"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative group/modal-input">
              <input
                id="targetUrl"
                name="targetUrl"
                type="text"
                placeholder="https://athletix.gndec.ac.in"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                autoFocus
                className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-3xl px-6 py-4 text-slate-900 focus:ring-12 focus:ring-indigo-500/5 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-300"
              />
            </div>
          </div>

          <div className="relative p-8 md:p-10 bg-slate-50/50 rounded-[2.5rem] border-2 border-slate-100 border-dashed group transition-all duration-500 hover:bg-slate-50 hover:border-indigo-100">
            {customQr ? (
              <div className="flex flex-col items-center gap-6 animate-in zoom-in-90 duration-500">
                <div className="relative">
                  <div className="absolute -inset-4 bg-indigo-500/5 blur-3xl rounded-full" />
                  <img
                    src={customQr}
                    alt="Custom QR"
                    className="relative z-10 w-48 h-48 md:w-56 md:h-56 rounded-3xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border-8 border-white grayscale transition-all duration-500 hover:grayscale-0 hover:scale-105"
                  />
                </div>

                <a
                  href={customQr}
                  download="website-qr.png"
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-600 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                >
                  <span>Download PNG</span>
                  <span className="text-lg">📥</span>
                </a>
              </div>
            ) : (
              <div className="py-12 text-slate-400 font-bold text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm animate-bounce duration-1000">
                  ✨
                </div>
                <div>
                  <p className="text-slate-900 text-sm font-black uppercase tracking-widest">
                    Waiting for URL
                  </p>
                  <p className="text-xs opacity-50 font-medium normal-case mt-1 italic">
                    The magic happens here...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
            High Resolution • Print Ready
          </p>
        </div>
      </div>
    </div>
  );
};

export default UrlQrModal;
