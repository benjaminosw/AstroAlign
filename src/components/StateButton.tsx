'use client';

interface StateButtonProps {
  state: 'needsAction' | 'current';
  onClick: () => void;
  needsActionLabel: string;
  currentLabel: string;
  running?: boolean;
  runningLabel?: string;
  accentClasses?: string;
  testId?: string;
}

export default function StateButton({
  state,
  onClick,
  needsActionLabel,
  currentLabel,
  running = false,
  runningLabel = 'Running…',
  accentClasses,
  testId
}: StateButtonProps) {
  const isRunning = running;
  const isCurrent = !isRunning && state === 'current';
  const label = isRunning ? runningLabel : isCurrent ? currentLabel : needsActionLabel;

  let colorClasses = '';
  if (isRunning) {
    colorClasses = 'bg-slate-700 text-slate-300';
  } else if (isCurrent) {
    colorClasses = 'bg-slate-700 text-slate-200 hover:bg-slate-600';
  } else {
    colorClasses = accentClasses ?? 'bg-sky-500 text-slate-950 hover:bg-sky-400';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRunning}
      data-testid={testId}
      aria-label={label}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors duration-200 ${colorClasses} ${
        isRunning ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      {label}
    </button>
  );
}
