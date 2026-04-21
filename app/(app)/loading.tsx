function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-sm bg-ink-900/[0.06] ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="px-10 py-8 max-w-[1600px]">
      <header className="mb-10 flex items-end justify-between">
        <div className="space-y-4">
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="h-16 w-80" />
          <SkeletonBlock className="h-4 w-[28rem]" />
        </div>
        <SkeletonBlock className="h-14 w-72" />
      </header>

      <section className="grid grid-cols-6 gap-px rounded-sm overflow-hidden bg-ink-900/[0.06]">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="bg-paper-100 p-6">
            <SkeletonBlock className="h-3 w-24 mb-8" />
            <SkeletonBlock className="h-12 w-20 mb-4" />
            <SkeletonBlock className="h-3 w-28" />
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[1.2fr_1fr] gap-8 mt-12">
        <div>
          <div className="mb-5 space-y-3">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-8 w-56" />
          </div>
          <div className="card rounded-sm p-8 space-y-8">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <SkeletonBlock className="h-3 w-28 mb-3" />
                <SkeletonBlock className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-5 space-y-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-px rounded-sm overflow-hidden bg-ink-900/[0.06]">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="bg-paper-100 p-8">
                <SkeletonBlock className="h-3 w-28 mb-8" />
                <SkeletonBlock className="h-20 w-40" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 mt-12">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index}>
            <div className="mb-5 space-y-3">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-8 w-64" />
            </div>
            <div className="card rounded-sm p-4">
              <SkeletonBlock className="h-72 w-full" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
