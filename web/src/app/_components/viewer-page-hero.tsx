"use client";

type ViewerPageHeroProps = {
  title: string;
  subtitle: string;
};

export function ViewerPageHero({ title, subtitle }: ViewerPageHeroProps) {
  return (
    <header className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-7 py-7 md:px-8 md:py-8">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-500 md:text-[17px]">
          {subtitle}
        </p>
      </div>
    </header>
  );
}
