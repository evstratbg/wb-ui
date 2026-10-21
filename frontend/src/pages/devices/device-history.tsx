import { observer } from 'mobx-react-lite';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/dropdown';
import { type Cell } from '@/stores/devices';
import { encodeControls } from '@/stores/history/history-url';
import OverviewHistory from '@/pages/overview/overview-history';
import '@/pages/overview/styles.css';
import './device-history.css';

export interface DeviceHistoryProps {
  deviceId: string;
  cells: Cell[];
  historyProxy: any;
  channelId?: string;
  onChannelChange?: (cellId: string) => void;
}

export const isHistoryPlotCell = (cell: Cell) => cell.valueType === 'number' || cell.valueType === 'boolean';

export const getDeviceHistoryChannels = (deviceId: string, cells: Cell[]) => cells.filter((cell) => (
  cell.deviceId === deviceId && !cell.hidden && cell.isComplete && cell.valueType !== 'pushbutton'
));

export const getDefaultHistoryCell = (cells: Cell[]) => (
  cells.find((cell) => cell.type === 'range' && !cell.readOnly)
  || cells.find((cell) => cell.valueType === 'number' && !!cell.units)
  || cells.find((cell) => cell.valueType === 'boolean' && !cell.readOnly)
  || cells.find(isHistoryPlotCell)
  || cells[0]
);

const DeviceHistoryChannels = observer(({ deviceId, cells, historyProxy, channelId, onChannelChange }: DeviceHistoryProps) => {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US';
  const text = (ru: string, en: string) => locale.startsWith('ru') ? ru : en;
  const channels = getDeviceHistoryChannels(deviceId, cells);
  const [clockOffset, setClockOffset] = useState(0);
  const [selectedId, setSelectedId] = useState(() => getDefaultHistoryCell(channels)?.id || '');
  const requestedId = channelId !== undefined || onChannelChange ? channelId : selectedId;
  const selected = channels.find((cell) => cell.id === requestedId) || getDefaultHistoryCell(channels);
  const inputId = useId();

  useEffect(() => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    const start = Date.now();
    fetch('/device/info', { credentials: 'same-origin', signal: abort.signal }).then((response) => {
      if (!response.ok || abort.signal.aborted) return;
      const date = Date.parse(response.headers.get('date'));
      if (Number.isFinite(date)) setClockOffset(date + 500 - (start + Date.now()) / 2);
    }).catch(() => {}).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); abort.abort(); };
  }, []);

  if (!selected) {
    return <p className="device-history-empty" role="status">{text('У устройства пока нет каналов с данными для истории.', 'This device has no data channels available for history yet.')}</p>;
  }

  return (
    <div className="device-history">
      <div className="device-history-toolbar">
        <div className="device-history-selector">
          <label htmlFor={inputId}>{text('Канал устройства', 'Device channel')}</label>
          <Dropdown
            id={inputId}
            value={selected.id}
            isSearchable
            ariaLabel={text('Канал устройства для истории', 'Device channel for history')}
            placeholder={text('Найти канал…', 'Find a channel…')}
            options={channels.map((cell) => ({ value: cell.id, label: cell.name === cell.controlId ? cell.name : `${cell.name} · ${cell.controlId}` }))}
            onChange={(option) => {
              const id = String(option.value);
              setSelectedId(id);
              onChannelChange?.(id);
            }}
          />
        </div>
        <a className="device-history-full" href={`#!/history/${encodeControls([{ d: selected.deviceId, c: selected.controlId }])}`}>
          {text('Сравнить каналы и выгрузить данные', 'Compare channels and export data')}
        </a>
      </div>
      {isHistoryPlotCell(selected) ? (
        <OverviewHistory cell={selected} historyProxy={historyProxy} clockOffset={clockOffset} locale={locale} />
      ) : (
        <p className="device-history-empty" role="status">{text('У этого канала нечисловые значения. Откройте общую историю по ссылке выше, чтобы посмотреть записи и выгрузить их.', 'This channel has non-numeric values. Open the full history using the link above to view and export its records.')}</p>
      )}
    </div>
  );
});

// A different device starts with its own default channel and history period.
const DeviceHistory = (props: DeviceHistoryProps) => <DeviceHistoryChannels key={props.deviceId} {...props} />;

export default DeviceHistory;
