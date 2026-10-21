import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { authStore, UserRole } from '@/stores/auth';
import { type Cell } from '@/stores/devices';
import { uiStore } from '@/stores/ui';
import './device-diagnostics.css';

export interface DeviceDiagnosticsProps {
  deviceId: string;
  device: any;
  cells: Cell[];
  installer: any | null;
  logsProxy: any;
}

type LogEntry = { time?: number; msg?: string; level?: number; cursor?: string };
type LogResult = { status: 'idle' | 'loading' | 'ready' | 'error'; filtered: boolean; entries: LogEntry[] };

// LogsCtrl uses a literal pattern unless regex is enabled. The default request
// starts at the latest journal entries; no cursor or timestamp is supplied.
export const buildDriverLogParams = (deviceId: string, filtered = true) => ({
  service: 'wb-mqtt-serial.service',
  limit: 20,
  ...(filtered ? { pattern: deviceId, regex: false, 'case-sensitive': true } : {}),
});

const DeviceDiagnosticsContent = observer(({ deviceId, device, cells, installer, logsProxy }: DeviceDiagnosticsProps) => {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US';
  const text = (ru: string, en: string) => locale.startsWith('ru') ? ru : en;
  const canConfigure = authStore.hasRights(UserRole.Admin);
  const canReadLogs = authStore.hasRights(UserRole.Operator);
  const matches = canConfigure ? installer?.getDeviceMatches(deviceId) || [] : [];
  const match = canConfigure ? installer?.getDeviceMatch(deviceId) : null;
  const software = match?.tab.embeddedSoftware;
  const errorCells = cells.filter((cell) => cell.deviceId === deviceId && !!cell.error?.length);
  const descriptions = {
    r: text('Ошибка чтения: драйвер не получил значение канала.', 'Read error: the driver could not read the channel value.'),
    w: text('Ошибка записи: драйвер не смог передать значение устройству.', 'Write error: the driver could not send the value to the device.'),
    p: text('Период чтения больше заданного: проверьте загрузку порта и настройки опроса.', 'Reading takes longer than configured: check bus load and polling settings.'),
  };
  const levels = [text('Авария', 'Emergency'), text('Тревога', 'Alert'), text('Критическая ошибка', 'Critical'), text('Ошибка', 'Error'), text('Предупреждение', 'Warning'), text('Уведомление', 'Notice'), text('Информация', 'Info'), text('Отладка', 'Debug')];
  const [logs, setLogs] = useState<LogResult>({ status: 'idle', filtered: true, entries: [] });
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current += 1; }, []);

  const loadLogs = async (filtered: boolean) => {
    if (!canReadLogs || !uiStore.isConnected || !logsProxy || logs.status === 'loading') return;
    const current = ++requestId.current;
    setLogs({ status: 'loading', filtered, entries: [] });
    try {
      const entries = await logsProxy.Load(buildDriverLogParams(deviceId, filtered));
      if (!Array.isArray(entries)) throw new Error('Unexpected journal response');
      if (current === requestId.current) setLogs({ status: 'ready', filtered, entries: entries.slice(0, 20) });
    } catch {
      if (current === requestId.current) setLogs({ status: 'error', filtered, entries: [] });
    }
  };

  return (
    <div className="device-diagnostics">
      <section className="device-diagnostics-section">
        <h3>{text('Состояние и ошибки', 'Status and errors')}</h3>
        <dl className="device-diagnostics-facts">
          <div><dt>{text('Связь интерфейса с MQTT', 'Interface connection to MQTT')}</dt><dd>{uiStore.isConnected ? text('Соединение установлено', 'Connected') : text('Нет соединения', 'Disconnected')}</dd></div>
          <div><dt>MQTT ID</dt><dd><code>{deviceId}</code></dd></div>
        </dl>
        <p className="device-diagnostics-hint">{text('Состояние MQTT относится к связи интерфейса с контроллером. Время последнего ответа физического устройства в метаданных каналов не передаётся.', 'MQTT status describes the interface connection to the controller. Channel metadata does not include the physical device’s last response time.')}</p>
        {device?.error ? <Alert variant="danger">{/^[rwp]+$/.test(String(device.error)) ? [...new Set(String(device.error).split(''))].map((code) => descriptions[code]).join(' ') : String(device.error)}</Alert> : <p>{text('Драйвер не сообщает об ошибке устройства.', 'The driver reports no device error.')}</p>}
        {!!errorCells.length && <ul className="device-diagnostics-errors">{errorCells.map((cell) => <li key={cell.id}>
          <strong>{cell.name}</strong><code>{cell.controlId}</code>
          <ul>{cell.error.map((error, index) => <li key={`${error}-${index}`}>{descriptions[error] || text(`Ошибка канала: ${error}`, `Channel error: ${error}`)}</li>)}</ul>
        </li>)}</ul>}
        {!errorCells.length && <p>{text('Ошибок чтения, записи и периода в каналах не получено.', 'No channel read, write or polling-period errors have been received.')}</p>}
      </section>

      <section className="device-diagnostics-section">
        <h3>{text('Подключение и версии', 'Connection and versions')}</h3>
        {!canConfigure || !installer ? <p className="device-diagnostics-hint">{text('Сопоставление с конфигурацией портов и сведения о прошивке доступны администратору.', 'Port configuration matching and firmware details are available to administrators.')}</p> : installer.loading || !installer.loaded && !installer.error ? <p role="status">{text('Загрузка конфигурации…', 'Loading configuration…')}</p> : installer.error ? <Alert variant="warn">{installer.error}</Alert> : matches.length > 1 ? <Alert variant="warn">
          {text('MQTT ID указан в нескольких устройствах. Подключение нельзя определить однозначно:', 'This MQTT ID belongs to multiple configured devices. The connection cannot be determined uniquely:')}
          <ul>{matches.map(({ port, tab }, index) => <li key={index}>{port.path || port.name} · {tab.name}</li>)}</ul>
        </Alert> : !match ? <p className="device-diagnostics-hint">{text('Для этого MQTT ID не найдена отдельная конфигурация wb-mqtt-serial. Это может быть системное, виртуальное устройство или устройство другого драйвера.', 'No separate wb-mqtt-serial configuration was found for this MQTT ID. It may be a system device, a virtual device or a device managed by another driver.')}</p> : <>
          <dl className="device-diagnostics-facts">
            <div><dt>{text('Порт', 'Port')}</dt><dd>{match.portName} {match.portPath && <code>{match.portPath}</code>}</dd></div>
            <div><dt>{text('Адрес', 'Address')}</dt><dd>{match.address ?? '—'}</dd></div>
            <div><dt>{text('Шаблон устройства', 'Device template')}</dt><dd>{match.typeName}</dd></div>
            <div><dt>{text('В конфигурации', 'Configuration state')}</dt><dd>{match.enabled ? text('Включено', 'Enabled') : text('Отключено', 'Disabled')}</dd></div>
          </dl>
          {match.tab.slaveIdIsDuplicate && <Alert variant="danger">{text('Адрес устройства повторяется на этом порту. Исправьте адрес в настройках.', 'This device address is duplicated on the port. Correct the address in settings.')}</Alert>}
          {!!match.tab.devicesWithTheSameId?.length && <Alert variant="danger">{text('MQTT ID конфликтует с другими устройствами:', 'MQTT ID conflicts with other devices:')} {match.tab.devicesWithTheSameId.join(', ')}</Alert>}
          <dl className="device-diagnostics-facts device-diagnostics-versions">{[
            [text('Прошивка', 'Firmware'), software?.firmware],
            [text('Загрузчик', 'Bootloader'), software?.bootloader],
          ].map(([label, component]: [string, any]) => <div key={label}>
            <dt>{label}</dt><dd>{component?.current || text('Версия не получена', 'Version not received')}{component?.available && <span className="device-diagnostics-available">{text('Доступная версия:', 'Available version:')} {component.available}</span>}</dd>
          </div>)}</dl>
          <p className="device-diagnostics-hint">{text('Показаны уже полученные сведения о версиях. Диагностика не запускает чтение регистров или обновление прошивки.', 'Previously received version information is shown. Diagnostics does not start register reads or firmware updates.')}</p>
        </>}
      </section>

      <section className="device-diagnostics-section">
        <h3>{text('Журнал драйвера', 'Driver journal')}</h3>
        <p className="device-diagnostics-hint">{text('До 20 последних записей wb-mqtt-serial.service с буквальным вхождением MQTT ID. Драйвер может записывать сообщения без этого ID; отсутствие строк не подтверждает исправность устройства.', 'Up to 20 latest wb-mqtt-serial.service entries containing the literal MQTT ID. The driver may log messages without this ID; no matching entries does not confirm device health.')}</p>
        {!canReadLogs ? <p>{text('Журнал доступен оператору и администратору.', 'The journal is available to operators and administrators.')}</p> : <>
          <div className="device-diagnostics-logActions">
            <Button variant="secondary" label={text('Загрузить журнал драйвера', 'Load driver journal')} disabled={!uiStore.isConnected || !logsProxy || logs.status === 'loading'} isLoading={logs.status === 'loading' && logs.filtered} onClick={() => loadLogs(true)} />
            <Button variant="unaccented" label={text('Последние записи без фильтра', 'Latest entries without filter')} disabled={!uiStore.isConnected || !logsProxy || logs.status === 'loading'} isLoading={logs.status === 'loading' && !logs.filtered} onClick={() => loadLogs(false)} />
          </div>
          {!uiStore.isConnected && <p role="status">{text('Для загрузки журнала восстановите соединение с контроллером.', 'Reconnect to the controller to load the journal.')}</p>}
          {!logsProxy && <p role="status">{text('Сервис журнала недоступен.', 'The journal service is unavailable.')}</p>}
          {logs.status === 'error' && <Alert variant="warn">{text('Не удалось загрузить журнал. Проверьте соединение и повторите загрузку.', 'Could not load the journal. Check the connection and try loading again.')}</Alert>}
          {logs.status === 'ready' && <>
            <p className="device-diagnostics-logScope" role="status">{logs.filtered ? text(`Записи с вхождением «${deviceId}»: ${logs.entries.length}.`, `Entries containing “${deviceId}”: ${logs.entries.length}.`) : text(`Общий журнал драйвера: ${logs.entries.length} записей. Они могут относиться к любым устройствам.`, `Full driver journal: ${logs.entries.length} entries. These may relate to any device.`)}</p>
            {!logs.entries.length && <p>{text('Записей не найдено. Загрузите последние записи без фильтра, если драйвер использует адрес или название вместо MQTT ID.', 'No entries found. Load the latest entries without a filter if the driver uses an address or name instead of MQTT ID.')}</p>}
            {!!logs.entries.length && <ol className="device-diagnostics-logEntries">{logs.entries.map((entry, index) => {
              const date = entry.time == null ? null : new Date(entry.time);
              return <li key={entry.cursor || index}>
                <div>{date && Number.isFinite(date.getTime()) && <time dateTime={date.toISOString()}>{date.toLocaleString(locale)}</time>}<span className={entry.level <= 3 ? 'device-diagnostics-danger' : entry.level === 4 ? 'device-diagnostics-warning' : ''}>{levels[entry.level] || text('Запись', 'Entry')}</span></div>
                <pre>{entry.msg || ''}</pre>
              </li>;
            })}</ol>}
          </>}
        </>}
      </section>
    </div>
  );
});

const DeviceDiagnostics = (props: DeviceDiagnosticsProps) => <DeviceDiagnosticsContent key={props.deviceId} {...props} />;

export default DeviceDiagnostics;
