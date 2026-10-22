import { ChartType, type PlotlyData, type PlotlyLayout } from './types';
import type { ChartTraits } from './chart-traits';

export const getAxis = (chart: ChartTraits, layout: Partial<PlotlyLayout>) => {
  const axes = Object.keys(layout).filter(
    (key) => /^yaxis\d*$/.test(key) && layout[key]?.customdata
  );
  const unit = chart.units || '';
  const existing = axes.find(
    (key) => layout[key].customdata === chart.type && layout[key].unit === unit
  );

  if (existing) return existing === 'yaxis' ? 'y' : existing.replace('yaxis', 'y');
  const index = axes.length + 1;
  const key = index === 1 ? 'yaxis' : `yaxis${index}`;
  layout[key] = {
    customdata: chart.type,
    unit,
    automargin: true,
    type: chart.type === ChartType.String ? 'category' : 'linear',
    title: { text: unit || chart.channelName },
    ...(chart.type === ChartType.Boolean
      ? { tickmode: 'array', tickvals: [0, 1], range: [-0.1, 1.1] }
      : {}),
  };
  return index === 1 ? 'y' : `y${index}`;
};

// Separate units/types share a time axis, not a numeric scale. Stacked domains
// avoid hiding a voltage or a switch state behind a temperature scale.
export const fixBoolAxes = (
  layout: Partial<PlotlyLayout>,
  _config: PlotlyData[],
  _min?: number,
  _max?: number
) => {
  const axes = Object.keys(layout).filter(
    (key) => /^yaxis\d*$/.test(key) && layout[key]?.customdata
  );
  const gap = axes.length > 1 ? Math.min(0.07, 0.2 / axes.length) : 0;
  axes.forEach((key, index) => {
    layout[key].domain = [1 - (index + 1) / axes.length + gap, 1 - index / axes.length];
    layout[key].anchor = 'x';
  });
};
