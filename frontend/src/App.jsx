import { useState, useEffect, memo, useMemo } from "react";
import axios from "axios";
import { generateLightQr } from "./utils/generateQr";

const getQrForPreview = async (number) => {
  return generateLightQr(number, { width: 240 });
};

// Memoized Jersey Card for browser preview
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

      {/* RIGHT SIDE — QR Code (enlarged) */}
      <div className="flex items-center justify-center">
        {qr ? (
          <img
            src={qr}
            alt={`QR for ${number}`}
            className="w-[180px] h-[180px] object-contain"
          />
        ) : (
          <div className="w-[180px] h-[180px] border border-gray-300 flex items-center justify-center text-xs text-gray-400">
            QR
          </div>
        )}
      </div>
    </div>
  );
});

JerseyCard.displayName = "JerseyCard";

const API_BASE = import.meta.env.VITE_API_URL || "";

function App() {
  const PREVIEW_PAGE_SIZE = 20;

  const [startInput, setStartInput] = useState(1);
  const [endInput, setEndInput] = useState(500);

  const [activeStart, setActiveStart] = useState(1);
  const [activeEnd, setActiveEnd] = useState(500);

  const [page, setPage] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customQr, setCustomQr] = useState("");

  // Custom jersey numbers input
  const [customNumbersInput, setCustomNumbersInput] = useState("");

  // Parse custom numbers from input string
  const parsedCustomNumbers = useMemo(() => {
    if (!customNumbersInput.trim()) return [];
    return [
      ...new Set(
        customNumbersInput
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n > 0),
      ),
    ].sort((a, b) => a - b);
  }, [customNumbersInput]);

  const hasCustomNumbers = parsedCustomNumbers.length > 0;

  // Handle custom numbers input — auto-convert space to comma
  const handleCustomNumbersChange = (e) => {
    const value = e.target.value.replace(/[\s,]+/g, ",");
    setCustomNumbersInput(value);
    setPage(0);
  };

  const clearCustomNumbers = () => {
    setCustomNumbersInput("");
    setPage(0);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveStart(startInput);
      setActiveEnd(endInput);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [startInput, endInput]);

  const generatePdf = async (useCustom = false) => {
    const numbersToGenerate = useCustom ? parsedCustomNumbers : null;
    if (useCustom && parsedCustomNumbers.length === 0) return;

    setIsGeneratingPdf(true);
    setIsProcessing(true);
    setGenerationProgress(0);
    setDownloadProgress(0);

    const requestId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. Establish SSE connection for generation progress
    const eventSource = new EventSource(
      `${API_BASE}/api/progress/${requestId}`,
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setGenerationProgress(data.progress);

      if (data.progress >= 100) {
        eventSource.close();
        setIsProcessing(false);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsProcessing(false);
    };

    try {
      // 2. Trigger PDF generation
      const body = numbersToGenerate
        ? { numbers: numbersToGenerate, requestId }
        : { start: activeStart, end: activeEnd, requestId };

      const response = await axios.post(`${API_BASE}/api/generate-pdf`, body, {
        responseType: "blob",
        onDownloadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          setDownloadProgress(percent);
        },
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = numbersToGenerate
        ? `Jerseys_custom_${numbersToGenerate.length}.pdf`
        : `Jerseys_${activeStart}_to_${activeEnd}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to generate PDF. Make sure the backend is running.");
      eventSource.close();
      setIsProcessing(false);
    } finally {
      setTimeout(() => setIsGeneratingPdf(false), 300);
    }
  };

  const generateCustomQr = async (url) => {
    if (!url) {
      setCustomQr("");
      return;
    }
    const qr = await generateLightQr(url, { width: 400 });
    setCustomQr(qr);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      generateCustomQr(customUrl);
    }, 300);
    return () => clearTimeout(timer);
  }, [customUrl]);

  // Use custom numbers if provided; otherwise, use range
  const activeNumbers = useMemo(() => {
    if (hasCustomNumbers) return parsedCustomNumbers;
    const nums = [];
    for (let i = activeStart; i <= activeEnd; i++) nums.push(i);
    return nums;
  }, [hasCustomNumbers, parsedCustomNumbers, activeStart, activeEnd]);

  const totalItems = activeNumbers.length;
  const totalPages = Math.ceil(totalItems / PREVIEW_PAGE_SIZE);

  const visibleNumbers = useMemo(() => {
    const start = page * PREVIEW_PAGE_SIZE;
    return activeNumbers.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [activeNumbers, page]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100 pb-20">
      <div className="max-w-4xl mx-auto p-4 md:p-8 no-print animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="bg-white rounded-4xl p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
          <div className="flex flex-col items-center justify-center gap-6 mb-16 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-4xl shadow-sm animate-bounce-subtle">
              🏃
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                Jersey Number{" "}
                <span className="text-indigo-600 italic">Generator</span>
              </h1>
              <p className="text-slate-400 font-medium tracking-wide">
                Professional Grade Jersey Layouts
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 mb-12">
            <div className="group space-y-4">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                Start Number
              </label>
              <div className="relative group/input">
                <input
                  type="number"
                  min="1"
                  value={startInput}
                  onChange={(e) =>
                    setStartInput(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-[1.25rem] px-8 py-5 text-2xl font-black text-slate-900 text-center focus:ring-12 focus:ring-indigo-500/5 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-300"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-focus-within/input:opacity-100 transition-opacity">
                  <span className="text-indigo-500">✨</span>
                </div>
              </div>
            </div>

            <div className="group space-y-4">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                End Number
              </label>
              <div className="relative group/input">
                <input
                  type="number"
                  min="1"
                  value={endInput}
                  onChange={(e) =>
                    setEndInput(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-[1.25rem] px-8 py-5 text-2xl font-black text-slate-900 text-center focus:ring-12 focus:ring-indigo-500/5 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-300"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-focus-within/input:opacity-100 transition-opacity">
                  <span className="text-indigo-500">✨</span>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Jersey Numbers Input */}
          <div className="mb-12 space-y-4">
            <div className="flex justify-between items-end px-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                Custom Numbers
              </label>
              {customNumbersInput && (
                <button
                  onClick={clearCustomNumbers}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-[0.2em]"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative group/input">
              <input
                type="text"
                placeholder="e.g. 1, 5, 12, 45, 100"
                value={customNumbersInput}
                onChange={handleCustomNumbersChange}
                className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-[1.25rem] px-8 py-5 text-lg font-bold text-slate-900 focus:ring-12 focus:ring-indigo-500/5 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-300"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-focus-within/input:opacity-100 transition-opacity">
                <span className="text-indigo-500">🎯</span>
              </div>
            </div>

            {/* Parsed number tags */}
            {parsedCustomNumbers.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 animate-in fade-in duration-300">
                {parsedCustomNumbers.map((num) => (
                  <span
                    key={num}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 font-black text-xs rounded-xl border border-indigo-100 tracking-wide"
                  >
                    #{num}
                  </span>
                ))}
              </div>
            )}

            {hasCustomNumbers && (
              <p className="text-xs text-indigo-500 font-bold px-2">
                {parsedCustomNumbers.length} jersey
                {parsedCustomNumbers.length !== 1 ? "s" : ""} selected — this
                overrides the range above
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full sm:flex-1 px-8 py-5 bg-slate-900 hover:bg-black text-white font-black rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
              <span className="text-lg">{showPreview ? "👁️‍🗨️" : "👁️"}</span>
            </button>

            <button
              onClick={() => generatePdf(hasCustomNumbers)}
              disabled={isGeneratingPdf}
              className="w-full sm:flex-1 px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 uppercase tracking-widest text-xs disabled:opacity-50 relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-3">
                {isGeneratingPdf ? (
                  isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      Processing {generationProgress}%
                    </span>
                  ) : (
                    `Downloading ${downloadProgress}%`
                  )
                ) : (
                  <>
                    <span>
                      {hasCustomNumbers
                        ? `Download (${parsedCustomNumbers.length} Selected)`
                        : "Download (Print All)"}
                    </span>
                    <span className="text-lg group-hover:translate-y-0.5 transition-transform">
                      📄
                    </span>
                  </>
                )}
              </span>

              {isGeneratingPdf && (
                <div
                  className="absolute left-0 top-0 h-full bg-indigo-800 transition-all duration-300"
                  style={{
                    width: `${isProcessing ? generationProgress : downloadProgress}%`,
                  }}
                />
              )}
            </button>

            <button
              onClick={() => setShowUrlModal(true)}
              className="w-full sm:w-auto px-10 py-5 bg-white hover:bg-slate-50 border-2 border-slate-100 text-slate-900 font-black rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span>🔗</span>
              <span className="uppercase tracking-widest text-xs">URL QR</span>
            </button>
          </div>

          <div className="mt-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
            Ready to generate {totalItems} jersey{totalItems !== 1 ? "s" : ""} •
            2 per A4 page
          </div>
        </div>
      </div>

      {showPreview && (
        <>
          <div className="max-w-4xl mx-auto px-4 md:px-8 no-print mb-12">
            <div className="bg-white rounded-3xl p-4 md:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center justify-between">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="flex items-center gap-2 px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest"
              >
                <span>&lsaquo;</span>
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">
                  Page Layout Preview
                </span>
                <div className="font-black text-sm text-slate-900">
                  <span className="text-indigo-600">{page + 1}</span>
                  <span className="mx-2 text-slate-200">/</span>
                  <span className="text-slate-400">{totalPages}</span>
                </div>
              </div>

              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-2 px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest"
              >
                <span className="hidden sm:inline">Next</span>
                <span>&rsaquo;</span>
              </button>
            </div>
          </div>

          <div className="preview-area w-full max-w-[210mm] mx-auto pb-20 no-print overflow-x-hidden md:overflow-visible">
            <div className="flex flex-col items-center gap-8 md:gap-12 p-4 md:p-0 origin-top transform scale-[0.45] sm:scale-[0.7] md:scale-100 mb-[-120%] sm:mb-[-40%] md:mb-0">
              {visibleNumbers.map((number) => (
                <div
                  key={number}
                  className="bg-white text-black p-[5mm] w-[210mm] h-[297mm] shadow-[0_40px_100px_rgba(0,0,0,0.1)] flex flex-col justify-around overflow-hidden border border-slate-100 rounded-sm"
                  style={{ contain: "layout size style" }}
                >
                  <JerseyCard number={number} />
                  <div className="w-full border-b-4 border-slate-100 border-dashed my-8" />
                  <JerseyCard number={number} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* URL QR Modal */}
      {showUrlModal && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md no-print animate-in fade-in duration-300"
          onClick={() => setShowUrlModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-[2.5rem] p-6 md:p-10 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all text-2xl group"
              onClick={() => setShowUrlModal(false)}
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
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
      )}
    </div>
  );
}

export default App;
