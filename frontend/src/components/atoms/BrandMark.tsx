import Image from "next/image";

export function BrandMark() {
  return (
    <div className="flex flex-col gap-1">
      {/* Full FlowPilot logo (inline version with wordmark) */}
      <Image
        src="/logo-inline.png"
        alt="FlowPilot"
        width={140}
        height={32}
        className="object-contain"
      />
      <div className="text-[10px] font-medium text-quiet tracking-wide">
        Mission Control
      </div>
    </div>
  );
}
