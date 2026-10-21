import { observer } from 'mobx-react-lite';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import StatsIcon from '@/assets/icons/stats.svg';
import SpinnerIcon from '@/assets/icons/spinner.svg';
import { type Cell } from '@/stores/devices';
import { uiStore } from '@/stores/ui';

type Point = { t: number; v: number };
const format = (value: number, locale: string) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
const time = (timestamp: number, seconds: number, locale: string) => new Date(timestamp).toLocaleString(locale, seconds > 86400 ? { day: 'numeric', month: 'short' } : { hour: '2-digit', minute: '2-digit' });

const OverviewHistory = observer(({ cell, historyProxy, clockOffset = 0, locale = 'en-US' }: { cell: Cell; historyProxy: any; clockOffset?: number; locale?: string }) => {
  const text = (ru: string, en: string) => locale.startsWith('ru') ? ru : en;
  const [seconds, setSeconds] = useState(86400);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; points: Point[]; end: number; status: string; error: string }>({ key: '', points: [], end: 0, status: 'idle', error: '' });
  const [active, setActive] = useState<number | null>(null);
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(880);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const resize = () => {
      const style = getComputedStyle(element);
      setChartWidth(Math.max(240, element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);
  const key = `${cell?.id}:${seconds}`;
  const connected = uiStore.isConnected;

  useEffect(() => {
    let cancelled = false;
    if (!cell || !connected) return;
    const end = (Date.now() + clockOffset) / 1000;
    setActive(null);
    setResult((previous) => ({ key, points: previous.key === key ? previous.points : [], end: end * 1000, status: 'loading', error: '' }));
    Promise.resolve(historyProxy.get_values({ channels: [[cell.deviceId, cell.controlId]], timestamp: { gt: end - seconds, lt: end }, limit: 600, max_records: 600, min_interval: Math.max(1, Math.floor(seconds * 1000 / 600)), ver: 1, with_milliseconds: true }))
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data?.values)) throw new Error('Unexpected history response');
        const sorted: Point[] = data.values
          .filter((row) => row.v != null && String(row.v).trim() !== '' && Number.isFinite(Number(row.t)) && Number.isFinite(Number(row.v)))
          .map((row) => ({ t: Number(row.t) * 1000, v: Number(row.v) }))
          .sort((a, b) => a.t - b.t);
        const points = sorted.filter((point, index) => index === sorted.length - 1 || point.t !== sorted[index + 1].t);
        setResult({ key, points, end: end * 1000, status: 'ready', error: '' });
      })
      .catch(() => {
        if (!cancelled) setResult((previous) => ({ ...previous, key, status: 'error', error: 'load' }));
      });
    return () => { cancelled = true; };
  }, [cell?.id, connected, seconds, revision, clockOffset]);

  const points = result.key === key ? result.points : [];
  const loading = connected && (result.key !== key || result.status === 'loading');
  const plot = useMemo(() => {
    if (!points.length) return null;
    const min = Math.min(...points.map((point) => point.v));
    const max = Math.max(...points.map((point) => point.v));
    const margin = max === min ? Math.max(1, Math.abs(min) * 0.05) : (max - min) * 0.15;
    const low = min - margin;
    const high = max + margin;
    const end = Math.max(result.end, points[points.length - 1].t);
    const start = end - seconds * 1000;
    const right = chartWidth - 18;
    const span = right - 58;
    const x = (t: number) => 58 + (t - start) / (end - start) * span;
    const y = (v: number) => 185 - (v - low) / (high - low) * 165;
    return { min, max, low, high, start, end, width: chartWidth, right, span, x, y, path: points.map((point, index) => `${index ? 'L' : 'M'}${x(point.t).toFixed(2)},${y(point.v).toFixed(2)}`).join(' ') };
  }, [points, result.end, seconds, chartWidth]);

  const selected = active == null ? points[points.length - 1] : points[active];
  const unit = (cell?.units || '').replace('deg C', '°C');
  const value = cell?.value;
  const setFromPointer = (event) => {
    if (!plot) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const target = plot.start + Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * plot.width - 58) / plot.span)) * (plot.end - plot.start);
    let index = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - target) < Math.abs(points[index].t - target)) index = i;
    setActive(index);
  };

  return (
    <div className="overview-chart" ref={containerRef}>
      <div className="overview-chartToolbar">
        <div className="overview-chartReading">
          <span>{text('Текущее значение', 'Current value')}</span>
          <strong>{value != null && value !== '' && Number.isFinite(Number(value)) ? format(Number(value), locale) : '—'} <small>{unit}</small></strong>
          {!!cell?.error?.length && <small className="overview-errorText">{text('Ошибка канала · последнее значение', 'Channel error · last received value')}</small>}
        </div>
        <div className="overview-chartActions">
          <div className="overview-segmented" role="group" aria-label={text('Период истории', 'History period')}>
            {[[3600, text('1ч', '1h')], [21600, text('6ч', '6h')], [86400, text('24ч', '24h')], [604800, text('7д', '7d')]].map(([range, label]) => <button type="button" key={range} aria-pressed={seconds === range} onClick={() => setSeconds(Number(range))}>{label}</button>)}
          </div>
          <button className="overview-iconButton" type="button" title={text('Обновить историю', 'Refresh history')} aria-label={text('Обновить историю', 'Refresh history')} disabled={loading || !connected} onClick={() => setRevision((value) => value + 1)}><SpinnerIcon /></button>
        </div>
      </div>
      {!connected && <p className="overview-chartNotice" role="status">{text('Нет соединения. На графике — ранее загруженные данные.', 'Disconnected. The chart shows previously loaded data.')}</p>}
      {result.status === 'error' && result.key === key && <p className="overview-chartNotice" role="status">{text('Не удалось загрузить историю. Проверьте связь с контроллером.', 'Could not load history. Check the controller connection.')} <button type="button" onClick={() => setRevision((value) => value + 1)}>{text('Повторить', 'Retry')}</button></p>}
      {plot ? (
        <>
          <p className="overview-srOnly" id={descriptionId}>{text(`История канала ${cell?.name}. Минимум ${format(plot.min, locale)} ${unit}, максимум ${format(plot.max, locale)} ${unit}. Используйте стрелки для просмотра значений.`, `History for ${cell?.name}. Minimum ${format(plot.min, locale)} ${unit}, maximum ${format(plot.max, locale)} ${unit}. Use arrow keys to inspect values.`)}</p>
          <svg className={`overview-chartSvg ${loading ? 'overview-chartLoading' : ''}`} viewBox={`0 0 ${plot.width} 226`} role="img" tabIndex={0} aria-label={`${text('График', 'Chart')}: ${cell?.name || text('температура', 'temperature')}`} aria-describedby={descriptionId} onPointerMove={setFromPointer} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)} onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Escape') setActive(null);
            else if (event.key === 'Home') setActive(0);
            else if (event.key === 'End') setActive(points.length - 1);
            else setActive((previous) => Math.max(0, Math.min(points.length - 1, (previous ?? points.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))));
          }}>
            {[0, 1, 2, 3].map((index) => {
              const value = plot.low + (plot.high - plot.low) * index / 3;
              return <g key={index}><line className="overview-chartGrid" x1="58" x2={plot.right} y1={plot.y(value)} y2={plot.y(value)} /><text className="overview-chartLabel" textAnchor="end" x="45" y={plot.y(value) + 4}>{format(value, locale)}</text></g>;
            })}
            {(chartWidth < 420 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((fraction) => <text className="overview-chartLabel" key={fraction} x={58 + plot.span * fraction} y="215" textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{time(plot.start + (plot.end - plot.start) * fraction, seconds, locale)}</text>)}
            <path className="overview-chartLine" d={plot.path} />
            {points.length === 1 && <circle className="overview-chartPoint" cx={plot.x(points[0].t)} cy={plot.y(points[0].v)} r="4" />}
            {active != null && selected && <g><line className="overview-chartGuide" x1={plot.x(selected.t)} x2={plot.x(selected.t)} y1="20" y2="185" /><circle className="overview-chartPoint" cx={plot.x(selected.t)} cy={plot.y(selected.v)} r="4" /></g>}
          </svg>
          <div className="overview-chartSummary">
            <span>{selected && <><time dateTime={new Date(selected.t).toISOString()}>{new Date(selected.t).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time> <strong>{format(selected.v, locale)} {unit}</strong></>}</span>
            <span>{text('Мин.', 'Min.')} <strong>{format(plot.min, locale)} {unit}</strong><i />{text('Макс.', 'Max.')} <strong>{format(plot.max, locale)} {unit}</strong></span>
          </div>
          {loading && <span className="overview-chartStatus" role="status">{text('Обновление истории…', 'Updating history…')}</span>}
        </>
      ) : <div className="overview-chartEmpty" role="status"><StatsIcon /><strong>{loading ? text('Загружаем историю…', 'Loading history…') : !connected ? text('Ожидание соединения', 'Waiting for connection') : !cell ? text('Канал температуры не найден', 'Temperature channel not found') : result.status === 'error' ? text('История недоступна', 'History unavailable') : text('За этот период нет данных', 'No data for this period')}</strong><span>{loading ? text('Запрашиваем показания контроллера', 'Requesting controller readings') : text('История хранится на контроллере и загружается по выбранному периоду.', 'History is stored on the controller and loaded for the selected period.')}</span></div>}
    </div>
  );
});

export default OverviewHistory;
