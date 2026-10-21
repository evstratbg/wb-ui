import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowRightIcon from '@/assets/icons/arrow-right.svg';
import CheckIcon from '@/assets/icons/check.svg';
import DesktopIcon from '@/assets/icons/desktop.svg';
import EthernetIcon from '@/assets/icons/ethernet.svg';
import FlashIcon from '@/assets/icons/flash.svg';
import SettingsIcon from '@/assets/icons/settings.svg';
import SitemapIcon from '@/assets/icons/sitemap.svg';
import WarnIcon from '@/assets/icons/warn.svg';
import { Cell as CellContent } from '@/components/cell';
import { Dropdown } from '@/components/dropdown';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import { type DevicesStore, type Cell } from '@/stores/devices';
import { uiStore } from '@/stores/ui';
import OverviewHistory from './overview-history';
import { deviceHref } from '@/pages/devices/device-model';
import './styles.css';

const channelCount = (count: number, locale: string) => {
  const plural = new Intl.PluralRules(locale).select(count);
  return `${count} ${locale.startsWith('ru') ? { one: 'канал', few: 'канала', many: 'каналов', other: 'канала' }[plural] : plural === 'one' ? 'channel' : 'channels'}`;
};
const label = (cell: Cell, locale: string) => (locale.startsWith('ru') ? { 'CPU Temperature': 'Температура CPU', 'Board Temperature': 'Температура платы', Vin: 'Входное напряжение', V_OUT: 'Выход питания V_OUT' } : { 'CPU Temperature': 'CPU temperature', 'Board Temperature': 'Board temperature', Vin: 'Input voltage', V_OUT: 'V_OUT power output' })[cell?.controlId] || cell?.name;
const display = (cell: Cell, locale: string) => {
  if (cell?.value == null || cell.value === '') return '—';
  if (cell.type === 'text') return locale.startsWith('ru') ? String(cell.value).replace(/(\d+)d/g, '$1 д').replace(/(\d+)h/g, '$1 ч').replace(/(\d+)m/g, '$1 мин') : String(cell.value);
  return Number.isFinite(Number(cell.value)) ? Number(cell.value).toLocaleString(locale, { maximumFractionDigits: 2 }) : String(cell.value);
};
const Reading = observer(({ cell, locale }: { cell: Cell; locale: string }) => <span className={`overview-reading ${cell?.error?.length ? 'overview-errorText' : ''}`} title={cell?.error?.length ? locale.startsWith('ru') ? 'Ошибка канала: показано последнее полученное значение' : 'Channel error: showing the last received value' : undefined}>{display(cell, locale)} <small>{(cell?.units || '').replace('deg C', '°C')}</small>{!!cell?.error?.length && <WarnIcon />}</span>);
const Panel = ({ title, children, action = null, icon: Icon = null }) => <section className="overview-panel"><header className="overview-panelHeader"><h2>{Icon && <Icon />}{title}</h2>{action}</header>{children}</section>;
const Link = ({ href, children }) => authStore.hasRights(['serial-config', 'system', 'network-connections'].includes(href) ? UserRole.Admin : href === 'devices' ? UserRole.Operator : UserRole.User) ? <a className="overview-textLink" href={`#!/${href}`}>{children}<ArrowRightIcon /></a> : null;

const OverviewPage = observer(({ devicesStore: store, historyProxy }: { devicesStore: DevicesStore; historyProxy: any }) => {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('ru') ? 'ru-RU' : 'en-US';
  const text = (ru: string, en: string) => locale.startsWith('ru') ? ru : en;
  const canViewDevices = authStore.hasRights(UserRole.Operator);
  const canConfigure = authStore.hasRights(UserRole.Admin);
  const DeviceRow = canViewDevices ? 'a' : 'div';
  const [info, setInfo] = useState<any>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [sensor, setSensor] = useState('CPU Temperature');
  const [isEditingPins, setIsEditingPins] = useState(false);
  const [savedPins, setSavedPins] = useState<string[] | null>(() => {
    try { const value = JSON.parse(localStorage.getItem('wb-ui-pins') || 'null'); return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : null; } catch { return null; }
  });
  useEffect(() => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    const start = Date.now();
    fetch('/device/info', { credentials: 'same-origin', signal: abort.signal }).then(async (response) => {
      if (!response.ok) return;
      const date = Date.parse(response.headers.get('date'));
      if (Number.isFinite(date)) setClockOffset(date + 500 - (start + Date.now()) / 2);
      setInfo(await response.json());
    }).catch(() => {}).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); abort.abort(); };
  }, []);

  const cells = [...store.cells.values()].filter((cell) => cell.isComplete && !cell.hidden);
  const find = (deviceId: string, controlId: string) => store.cells.get(`${deviceId}/${controlId}`);
  const cpu = find('hwmon', 'CPU Temperature');
  const board = find('hwmon', 'Board Temperature');
  const voltage = find('power_status', 'Vin') || find('wb-adc', 'Vin');
  const uptime = find('system', 'Current uptime');
  const revision = find('system', 'HW Revision')?.value;
  const model = revision ? `Wiren Board ${String(revision).split('.')[0]}` : 'Wiren Board';
  const serial = info?.sn || find('system', 'Short SN')?.value || '—';
  const issues = cells.filter((cell) => !!cell.error?.length);
  const defaultPins = ['hwmon/CPU Temperature', 'hwmon/Board Temperature', 'power_status/Vin', 'wb-gpio/V_OUT'].filter((id) => store.cells.has(id));
  const pins = savedPins || defaultPins;
  const favorites = pins.map((id) => store.cells.get(id)).filter((cell) => cell?.isComplete && !cell.hidden);
  const devices = [...store.devices.values()].filter((device) => !device.isSystemDevice && store.getDeviceCells(device.id).length).sort((a, b) => Number(store.getDeviceCells(b.id).some((cell) => !!cell.error?.length)) - Number(store.getDeviceCells(a.id).some((cell) => !!cell.error?.length)) || a.name.localeCompare(b.name, locale));
  const savePins = (next: string[]) => { setSavedPins(next); try { localStorage.setItem('wb-ui-pins', JSON.stringify(next)); } catch {} };
  const ethernet = find('network', 'Ethernet IP')?.value;
  const hasEthernet = ethernet && !['-', 'unknown', 'None', ''].includes(String(ethernet));
  const batteryValue = find('power_status', 'working on battery')?.value;
  const onBattery = batteryValue === true || batteryValue === 1 || batteryValue === '1';

  return (
    <PageLayout title={text('Обзор контроллера', 'Controller overview')} hasRights={authStore.hasRights(UserRole.User)} actions={canConfigure ? <Link href="serial-config">{text('Настроить устройства', 'Configure devices')}</Link> : null}>
      <div className="overview">
        <p className="overview-description">{text('Состояние системы и важные каналы — в одном месте.', 'System status and important channels in one place.')}</p>
        <section className="overview-controller">
          <div className="overview-identity"><span className="overview-boardMark"><SitemapIcon /></span><div><h2>{model}<span className="overview-modelTag">{revision ? `WB${String(revision).split('.')[0]}` : text('Контроллер', 'Controller')}</span></h2><p><i className={`overview-dot ${uiStore.isConnected ? 'overview-online' : ''}`} />{uiStore.isConnected ? text('Данные поступают в реальном времени', 'Receiving live data') : text('Ожидание соединения', 'Waiting for connection')}<span>·</span><code>{serial}</code></p></div></div>
          <div className="overview-telemetry">
            <div><span>{text('Температура CPU', 'CPU temperature')}</span><Reading cell={cpu} locale={locale} /><small>{text('Плата', 'Board')} <Reading cell={board} locale={locale} /></small></div>
            <div><span><FlashIcon />{text('Питание', 'Power supply')}</span><Reading cell={voltage} locale={locale} /><small>{onBattery ? text('Работа от батареи', 'Running on battery') : text('Входное напряжение', 'Input voltage')}</small></div>
            <div><span>{text('Время работы', 'Uptime')}</span><strong className="overview-uptime">{display(uptime, locale)}</strong><small>{text('С последней перезагрузки', 'Since the last restart')}</small></div>
            <div><span><SitemapIcon />{text('Устройства', 'Devices')}</span><strong>{store.devices.size || '—'}<small> / {channelCount(cells.length, locale)}</small></strong><small className={issues.length ? 'overview-errorText' : ''}>{issues.length ? `${channelCount(issues.length, locale)} ${text('с ошибками', 'with errors')}` : text('Ошибок каналов не получено', 'No channel errors reported')}</small></div>
          </div>
        </section>
        <div className="overview-grid">
          <div className="overview-mainColumn">
            <Panel title={text('Температура контроллера', 'Controller temperature')} action={<div className="overview-segmented" role="group" aria-label={text('Датчик температуры', 'Temperature sensor')}>{[['CPU Temperature', 'CPU'], ['Board Temperature', text('Плата', 'Board')]].map(([id, name]) => <button type="button" key={id} aria-pressed={sensor === id} onClick={() => setSensor(id)}>{name}</button>)}</div>}>
              <OverviewHistory cell={sensor === 'CPU Temperature' ? cpu : board} historyProxy={historyProxy} clockOffset={clockOffset} locale={locale} />
            </Panel>
            <Panel title={text('Избранные каналы', 'Favorite channels')} action={<button type="button" className="overview-textButton" onClick={() => setIsEditingPins(!isEditingPins)}>{isEditingPins ? text('Готово', 'Done') : text('Настроить', 'Customize')}</button>}>
              <div className="overview-favorites">{favorites.length ? favorites.map((cell) => <div className="overview-favorite" key={cell.id}><div className="overview-favoriteDevice">{store.devices.get(cell.deviceId)?.name || cell.deviceId}{isEditingPins && <button className="overview-removePin" type="button" aria-label={text(`Убрать ${label(cell, locale)} из избранного`, `Remove ${label(cell, locale)} from favorites`)} onClick={() => savePins(pins.filter((id) => id !== cell.id))}>{text('Убрать', 'Remove')}</button>}</div><CellContent cell={cell} name={label(cell, locale)} /></div>) : <p className="overview-emptyText">{text('Добавьте каналы, которые хотите держать под рукой.', 'Add channels you want to keep close at hand.')}</p>}</div>
              {isEditingPins && <div className="overview-pinEditor"><Dropdown ariaLabel={text('Добавить избранный канал', 'Add a favorite channel')} placeholder={text('Найти и добавить канал…', 'Find and add a channel…')} options={store.topics.filter((option) => !('options' in option) || option.options.length)} value={null} isSearchable onChange={(option) => { const id = String(option.value); if (store.cells.has(id) && !pins.includes(id)) savePins([...pins, id]); }} /></div>}
              {canViewDevices && <div className="overview-panelFooter"><Link href="devices">{text('Все каналы', 'All channels')}</Link></div>}
            </Panel>
            <Panel title={text('Устройства', 'Devices')} action={<Link href="devices">{text('Все устройства', 'All devices')}</Link>}>
              <div className="overview-deviceList">{devices.slice(0, 5).map((device) => {
                const controls = store.getDeviceCells(device.id);
                const hasError = controls.some((cell) => !!cell.error?.length);
                return <DeviceRow className="overview-deviceRow" key={device.id} href={canViewDevices ? deviceHref({ device: device.id }) : undefined}><span className="overview-deviceTile"><SitemapIcon /></span><span className="overview-deviceName"><strong>{device.name}</strong><small>{device.id} · {channelCount(controls.length, locale)}</small></span><span className={`overview-statusTag ${hasError ? 'overview-warning' : ''}`}><i className="overview-dot" />{hasError ? text('Есть ошибки', 'Errors reported') : text('Без ошибок', 'No errors reported')}</span>{canViewDevices && <ArrowRightIcon />}</DeviceRow>;
              })}{!devices.length && <p className="overview-emptyText">{text('Устройства появятся после подключения к контроллеру.', 'Devices will appear after connecting to the controller.')}</p>}</div>
            </Panel>
          </div>
          <aside className="overview-sideColumn">
            <Panel title={text('О контроллере', 'About the controller')} icon={DesktopIcon}>
              <dl className="overview-info"><div><dt>{text('Модель', 'Model')}</dt><dd>{model}</dd></div><div><dt>{text('Ревизия', 'Revision')}</dt><dd>{revision || '—'}</dd></div><div><dt>{text('Серийный номер', 'Serial number')}</dt><dd><code>{serial}</code></dd></div><div><dt>{text('Релиз', 'Release')}</dt><dd>{info?.release_name || find('system', 'Release name')?.value || '—'}</dd></div><div><dt>{text('Ветка', 'Suite')}</dt><dd>{info?.release_suite || find('system', 'Release suite')?.value || '—'}</dd></div></dl>
              {canConfigure && <div className="overview-panelFooter"><Link href="system">{text('Информация и настройки', 'Information and settings')}</Link></div>}
            </Panel>
            <Panel title={text('Сеть', 'Network')} icon={EthernetIcon}>
              <div className="overview-network"><span className="overview-networkIcon"><EthernetIcon /></span><div><strong>Ethernet</strong><span>{hasEthernet ? ethernet : text('Адрес не получен', 'No address received')}</span></div><i className={`overview-dot ${hasEthernet ? 'overview-online' : ''}`} /></div>
              <dl className="overview-info overview-networkInfo">{[['Wi-Fi', 'Wi-Fi IP'], ['Ethernet 2', 'Ethernet 2 IP'], [text('Мобильная сеть', 'Mobile network'), 'GPRS IP']].map(([name, id]) => <div key={id}><dt>{name}</dt><dd>{find('network', id)?.value || text('Не используется', 'Not in use')}</dd></div>)}</dl>
              {canConfigure && <div className="overview-panelFooter"><Link href="network-connections">{text('Настроить сеть', 'Configure network')}</Link></div>}
            </Panel>
            <Panel title={text('Состояние каналов', 'Channel status')} icon={SettingsIcon}>
              {issues.length ? <div className="overview-issues">{issues.slice(0, 5).map((cell) => <DeviceRow href={canViewDevices ? deviceHref({ device: cell.deviceId, tab: 'diagnostics' }) : undefined} key={cell.id}><WarnIcon /><span><strong>{label(cell, locale)}</strong><small>{cell.deviceId} · {text('ошибка', 'error')} {cell.error.join('')}</small></span>{canViewDevices && <ArrowRightIcon />}</DeviceRow>)}</div> : <div className="overview-health"><CheckIcon /><strong>{uiStore.isConnected ? text('Ошибок каналов не получено', 'No channel errors reported') : text('Ожидание соединения', 'Waiting for connection')}</strong><p>{text('Статусы и показания каждого канала доступны в разделе устройств.', 'View the status and readings of every channel in Devices.')}</p></div>}
            </Panel>
          </aside>
        </div>
      </div>
    </PageLayout>
  );
});

export default OverviewPage;
