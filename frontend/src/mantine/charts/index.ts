/**
 * Chart Components
 *
 * Recharts wrappers with Mantine styling.
 * These integrate Recharts with the Mantine theme.
 */

// Re-export Recharts components we commonly use
// Note: Tooltip is renamed to avoid conflict with Mantine Tooltip
export {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  PieChart,
  Line,
  Area,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

// Custom chart wrappers will be added here
// export { ChartCard } from './ChartCard';
// export { StatCard } from './StatCard';
