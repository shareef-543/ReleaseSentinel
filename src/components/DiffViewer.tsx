import React, { useMemo, useState } from 'react';
import { Columns, AlignJustify } from 'lucide-react';

interface DiffViewerProps {
  original: string;
  modified: string;
  originalTitle?: string;
  modifiedTitle?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  leftLineNum?: number;
  rightLineNum?: number;
}

export function DiffViewer({
  original,
  modified,
  originalTitle = 'Original Input',
  modifiedTitle = 'AI Corrected Manifest',
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  const diffLines = useMemo(() => {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const result: DiffLine[] = [];

    let i = 0;
    let j = 0;

    while (i < origLines.length || j < modLines.length) {
      if (i < origLines.length && j < modLines.length) {
        if (origLines[i] === modLines[j]) {
          result.push({
            type: 'unchanged',
            content: origLines[i],
            leftLineNum: i + 1,
            rightLineNum: j + 1,
          });
          i++;
          j++;
        } else {
          // Look ahead to find matches
          let foundModMatch = -1;
          for (let lookJ = j; lookJ < Math.min(modLines.length, j + 4); lookJ++) {
            if (origLines[i] === modLines[lookJ]) {
              foundModMatch = lookJ;
              break;
            }
          }

          if (foundModMatch !== -1) {
            while (j < foundModMatch) {
              result.push({
                type: 'added',
                content: modLines[j],
                rightLineNum: j + 1,
              });
              j++;
            }
          } else {
            result.push({
              type: 'removed',
              content: origLines[i],
              leftLineNum: i + 1,
            });
            i++;
            if (j < modLines.length) {
              result.push({
                type: 'added',
                content: modLines[j],
                rightLineNum: j + 1,
              });
              j++;
            }
          }
        }
      } else if (i < origLines.length) {
        result.push({
          type: 'removed',
          content: origLines[i],
          leftLineNum: i + 1,
        });
        i++;
      } else if (j < modLines.length) {
        result.push({
          type: 'added',
          content: modLines[j],
          rightLineNum: j + 1,
        });
        j++;
      }
    }

    return result;
  }, [original, modified]);

  const stats = useMemo(() => {
    const added = diffLines.filter((l) => l.type === 'added').length;
    const removed = diffLines.filter((l) => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden text-xs font-mono">
      {/* Header controls */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-300 font-sans">Diff Breakdown</span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-emerald-400">+{stats.added} additions</span>
            <span className="text-rose-400">-{stats.removed} deletions</span>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-0.5">
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-all ${
              viewMode === 'split' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="h-3 w-3" /> Split
          </button>
          <button
            onClick={() => setViewMode('unified')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-all ${
              viewMode === 'unified' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlignJustify className="h-3 w-3" /> Unified
          </button>
        </div>
      </div>

      {/* Split view */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-2 divide-x divide-slate-800 max-h-96 overflow-auto">
          {/* Left panel (original) */}
          <div>
            <div className="sticky top-0 bg-slate-950/90 px-3 py-1.5 text-[11px] font-sans font-medium text-slate-400 border-b border-slate-800">
              {originalTitle}
            </div>
            <div className="p-2 space-y-0.5">
              {original.split('\n').map((line, idx) => (
                <div key={idx} className="flex gap-2 text-slate-400 hover:bg-slate-800/40 px-1 py-0.5 rounded">
                  <span className="w-6 shrink-0 select-none text-right text-slate-600">{idx + 1}</span>
                  <span className="whitespace-pre overflow-x-auto text-slate-300">{line || ' '}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel (corrected) */}
          <div className="bg-emerald-950/10">
            <div className="sticky top-0 bg-slate-950/90 px-3 py-1.5 text-[11px] font-sans font-medium text-emerald-400 border-b border-slate-800">
              {modifiedTitle}
            </div>
            <div className="p-2 space-y-0.5">
              {modified.split('\n').map((line, idx) => (
                <div key={idx} className="flex gap-2 text-emerald-300 hover:bg-emerald-900/20 px-1 py-0.5 rounded">
                  <span className="w-6 shrink-0 select-none text-right text-emerald-600/70">{idx + 1}</span>
                  <span className="whitespace-pre overflow-x-auto">{line || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Unified view */
        <div className="max-h-96 overflow-auto p-2 space-y-0.5">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 px-2 py-0.5 rounded ${
                line.type === 'added'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : line.type === 'removed'
                  ? 'bg-rose-500/15 text-rose-300 line-through opacity-70'
                  : 'text-slate-400'
              }`}
            >
              <span className="w-6 select-none text-right text-slate-600">
                {line.type === 'removed' ? line.leftLineNum : line.rightLineNum || ''}
              </span>
              <span className="w-3 select-none font-bold">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="whitespace-pre overflow-x-auto">{line.content || ' '}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
