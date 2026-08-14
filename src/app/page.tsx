import AlignmentApp from '../components/AlignmentApp';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">AstroAlign</p>
          <h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">Astronomical Alignment Planner</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Plan line-of-sight alignment between a target landmark and the Sun or Moon from your camera location.
          </p>
        </header>

        <AlignmentApp />
      </div>
    </main>
  );
}
