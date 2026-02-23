import Image from "next/image";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      {/* Logo mark */}
      <div
        className="grid h-10 w-10 place-items-center rounded-lg shadow-sm overflow-hidden"
        style={{ background: "#233136" }}
      >
        <Image
          src="/brandmark.png"
          alt="FlowPilot"
          width={28}
          height={28}
          className="object-contain"
        />
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
