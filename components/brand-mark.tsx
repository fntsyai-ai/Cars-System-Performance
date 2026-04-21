import { cn } from "@/lib/utils";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const small = size === "sm";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0",
        small ? "w-8 h-8" : "w-9 h-9",
      )}
    >
      <div
        className={cn(
          "absolute rotate-45 rounded-[4px] border border-clay-500/60",
          small ? "inset-[4px]" : "inset-[3px]",
        )}
      />
      <span
        className={cn(
          "relative font-display text-clay-500 leading-none",
          small ? "text-lg" : "text-xl",
        )}
      >
        A
      </span>
      <span
        className={cn(
          "absolute rounded-full bg-clay-500",
          small ? "right-[5px] bottom-[5px] w-[3px] h-[3px]" : "right-[5px] bottom-[5px] w-[4px] h-[4px]",
        )}
      />
    </div>
  );
}
