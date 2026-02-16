const PreviewPagination = ({ page, totalPages, onPrev, onNext }) => {
  return (
    <div className="bg-white rounded-3xl p-4 md:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center justify-between">
      <button
        disabled={page === 0}
        onClick={onPrev}
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
        onClick={onNext}
        className="flex items-center gap-2 px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest"
      >
        <span className="hidden sm:inline">Next</span>
        <span>&rsaquo;</span>
      </button>
    </div>
  );
};

export default PreviewPagination;
