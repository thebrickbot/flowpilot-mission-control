export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      {/* Logo mark: Mountain background with Lime text */}
      <div
        className="grid h-10 w-10 place-items-center rounded-lg text-xs font-semibold shadow-sm"
        style={{ background: "#233136" }}
      >
        <span
          className="font-heading tracking-[0.15em]"
          style={{ color: "#CDF765" }}
        >
          FP
        </span>
      </div>
      <div className="leading-tight">
        <div className="font-heading text-sm uppercase tracking-[0.26em] text-strong">
          FLOWPILOT
        </div>
        <div className="text-[11px] font-medium text-quiet">
          Mission Control
        </div>
      </div>
    </div>
  );
}
