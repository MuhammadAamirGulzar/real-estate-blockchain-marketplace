import React from 'react';

const AreaChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>No chart data available</p>
      </div>
    );
  }

  // Simple SVG chart implementation
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue;
  
  const width = 400;
  const height = 200;
  const padding = 40;
  
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
    const y = height - padding - ((item.value - minValue) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-[300px] flex items-center justify-center">
      <svg width={width} height={height} className="border rounded">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Area fill */}
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="none"
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
        />
        
        {/* Data points */}
        {data.map((item, index) => {
          const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
          const y = height - padding - ((item.value - minValue) / range) * (height - 2 * padding);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="4"
              fill="rgb(59, 130, 246)"
              className="hover:r-6 transition-all"
            />
          );
        })}
        
        {/* Labels */}
        {data.map((item, index) => {
          const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
          return (
            <text
              key={index}
              x={x}
              y={height - 10}
              textAnchor="middle"
              fontSize="12"
              fill="#6b7280"
            >
              {item.month}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default AreaChart;