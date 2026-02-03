import { type FC, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { formatTokens, getModelColor, getModelDisplayName } from './WeeklyUsageChart';

interface ModelStat {
  model: string;
  tokens: number;
  requests: number;
}

interface ModelBreakdownChartProps {
  data: ModelStat[];
  metric?: 'tokens' | 'requests';
  height?: number;
}

// Model colors for pie chart - use same palette as getModelColor for consistency
const MODEL_PIE_COLORS = [
  '#8b5cf6', // violet (Opus)
  '#3b82f6', // blue (Sonnet)
  '#10b981', // green (Haiku)
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#a855f7', // purple
];

function getModelPieColor(model: string, index: number): string {
  // Try to get the standard model color first
  const standardColor = getModelColor(model);
  if (standardColor && standardColor !== '#6b7280') {
    return standardColor;
  }
  // Fall back to palette colors
  return MODEL_PIE_COLORS[index % MODEL_PIE_COLORS.length];
}

export const ModelBreakdownChart: FC<ModelBreakdownChartProps> = ({
  data,
  metric = 'tokens',
  height = 300,
}) => {
  // Sort by the selected metric (descending)
  const sortedData = useMemo(() => {
    return [...data]
      .sort((a, b) => b[metric] - a[metric])
      .map((item, index) => ({
        ...item,
        displayName: getModelDisplayName(item.model),
        color: getModelPieColor(item.model, index),
        value: item[metric],
      }));
  }, [data, metric]);

  // Calculate total
  const total = useMemo(() => {
    return sortedData.reduce((sum, item) => sum + item.value, 0);
  }, [sortedData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    const percentage = ((item.value / total) * 100).toFixed(1);

    return (
      <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--elevation-2)] p-3 text-[var(--text-sm)]">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-semibold text-[var(--color-text-primary)]">{item.displayName}</span>
        </div>
        <div className="text-[var(--color-text-secondary)]">
          {metric === 'tokens' ? formatTokens(item.value) : item.value.toLocaleString()} {metric}
        </div>
        <div className="text-[var(--color-text-muted)]">{percentage}% of total</div>
      </div>
    );
  };

  // Custom legend with colors that match chart
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 px-2">
        {payload.map((entry: any, index: number) => {
          const item = sortedData[index];
          const percentage = ((item.value / total) * 100).toFixed(1);
          return (
            <div key={entry.value} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[var(--color-text-secondary)]">{item.displayName}</span>
              <span className="text-[var(--color-text-muted)]">({percentage}%)</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (sortedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
        No data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={sortedData}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="displayName"
          >
            {sortedData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />

          {/* Center text showing total */}
          <text
            x="50%"
            y="45%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--color-text-primary)] text-lg font-semibold"
          >
            {metric === 'tokens' ? formatTokens(total) : total.toLocaleString()}
          </text>
          <text
            x="50%"
            y="45%"
            dy={20}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--color-text-muted)] text-xs"
          >
            total {metric}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
