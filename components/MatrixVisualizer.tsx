import React, { useState } from 'react';
import { MatrixMath } from '../utils/matrixMath';

interface MatrixVisualizerProps {
  data: number[][];
  title: string;
  color?: string;
}

export const MatrixVisualizer: React.FC<MatrixVisualizerProps> = ({ data, title, color = "bg-blue-500" }) => {
  const [isTransposed, setIsTransposed] = useState(false);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  
  // Selection state
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);

  const displayData = isTransposed ? MatrixMath.transpose(data) : data;
  const rows = displayData.length;
  const cols = displayData[0]?.length || 0;

  // Normalize data for visualization opacity
  const flat = data.flat();
  const max = Math.max(...flat, 1);
  const min = Math.min(...flat);

  const handleCellClick = (i: number, j: number) => {
    if (selectedRow === i && selectedCol === j) {
        // Deselect
        setSelectedRow(null);
        setSelectedCol(null);
    } else {
        setSelectedRow(i);
        setSelectedCol(j);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border border-gray-800 rounded-lg bg-black/40 backdrop-blur-md transition-all">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest" dir="ltr">
          {title} <span className="text-gray-600">[{isTransposed ? `${cols}x${rows}` : `${rows}x${cols}`}]</span>
        </h3>
        <div className="flex gap-2">
            <button 
            onClick={() => { setSelectedRow(null); setSelectedCol(null); }}
            className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition-colors"
            >
            Reset
            </button>
            <button 
            onClick={() => setIsTransposed(!isTransposed)}
            className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-cyan-500 transition-colors"
            >
            {isTransposed ? 'Original' : 'Transpose'}
            </button>
        </div>
      </div>
      
      <div 
        className="grid gap-px bg-gray-900 overflow-hidden rounded-md border border-slate-800"
        style={{ 
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
        }}
        dir="ltr"
        onMouseLeave={() => { setHoverRow(null); setHoverCol(null); }}
      >
        {displayData.map((row, i) => (
          row.map((val, j) => {
            const normalized = (val - min) / (max - min);
            
            // Logic for highlighting:
            // 1. If something is selected, highlight the specific cell strongly, and the row/col weakly.
            // 2. If nothing selected, use hover.
            
            const isSelectedCell = selectedRow === i && selectedCol === j;
            const isSelectedRowCol = selectedRow === i || selectedCol === j;
            
            const isHovered = hoverRow === i || hoverCol === j;
            
            const isActive = (selectedRow !== null) ? isSelectedRowCol : isHovered;
            const isStrong = isSelectedCell || (selectedRow === null && isHovered);

            return (
              <div 
                key={`${i}-${j}`}
                onMouseEnter={() => { setHoverRow(i); setHoverCol(j); }}
                onClick={() => handleCellClick(i, j)}
                className={`h-3 w-full transition-all duration-300 relative group cursor-crosshair`}
                style={{ 
                  backgroundColor: isActive ? '#fff' : undefined,
                  opacity: isActive ? (isStrong ? 0.6 : 0.2) : undefined,
                  zIndex: isSelectedCell ? 10 : 0
                }}
              >
                <div 
                  className={`absolute inset-0 ${color}`}
                  style={{ opacity: 0.1 + (normalized * 0.9) }}
                />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-nowrap border border-slate-700 font-mono">
                  {val.toFixed(2)} <span className="text-slate-500">[{i},{j}]</span>
                </div>
              </div>
            );
          })
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 px-1">
        <span>Min: {min.toFixed(1)}</span>
        <span>Max: {max.toFixed(1)}</span>
        {selectedRow !== null && (
            <span className="text-cyan-500 font-bold">Selected: [{selectedRow}, {selectedCol}]</span>
        )}
      </div>
    </div>
  );
};