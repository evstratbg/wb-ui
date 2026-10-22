import { observer } from 'mobx-react-lite';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowLeftIcon from '@/assets/icons/arrow-left.svg';
import ArrowRightIcon from '@/assets/icons/arrow-right.svg';
import StatsIcon from '@/assets/icons/stats.svg';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Cell } from '@/components/cell';
import { Confirm } from '@/components/confirm';
import { Input } from '@/components/input';
import { Tabs, TabContent } from '@/components/tabs';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import { type DevicesStore } from '@/stores/devices';
import { uiStore } from '@/stores/ui';
import { ChannelPolling } from './channel-polling';
import DeviceHistory from './device-history';
import DeviceSettings from './device-settings';
import DeviceDiagnostics from './device-diagnostics';
import {
  deviceHref,
  groupChannels,
  type DeviceRoute,
  type ChannelGroup } from './device-model';
import './styles.css';

export const DevicesPage = observer(
  ({
    store,
    installer,
    historyProxy,
    logsProxy,
    route = {},
    onNavigate,
  }: {
    store: DevicesStore;
    installer?: any;
    historyProxy?: any;
    logsProxy?: any;
    route?: DeviceRoute;
    onNavigate?: (patch: DeviceRoute, options?: { replace?: boolean }) => void;
  }) => {
    const { i18n } = useTranslation();
    const ru = i18n.language.startsWith('ru');
    const text = (r: string, e: string) => (ru ? r : e);
    const isAdmin = authStore.hasRights(UserRole.Admin);
    const blockDisconnectedActions = (event: SyntheticEvent) => {
      if (!uiStore.isConnected) {
        // Let Tab move focus, without allowing react-select to commit an option.
        if (!('key' in event && event.key === 'Tab')) event.preventDefault();
        event.stopPropagation();
      }
    };
    const [search, setSearch] = useState(route.search || '');
    const [channelSearch, setChannelSearch] = useState('');
    const [polling, setPolling] = useState<any>(null);
    useEffect(() => setPolling(null), [route.device]);
    const [deletedDeviceId, setDeletedDeviceId] = useState<string | null>(null);
    useEffect(() => setSearch(route.search || ''), [route.search]);
    useEffect(() => setChannelSearch(''), [route.device]);
    useEffect(() => {
      if (search === (route.search || '')) return;
      const timer = setTimeout(
        () => onNavigate?.({ search }, { replace: true }),
        250);
      return () => clearTimeout(timer);
    }, [search, route.search, onNavigate]);

    const filter = ['ports', 'errors'].includes(route.filter)
      ? route.filter
      : 'all';
    const query = search.trim().toLocaleLowerCase();
    const entries = new Map(
      [...store.filteredDevices].map(([id, device]) => [
        id,
        { id, name: device.name, error: device.error, runtime: true },
      ])
    );
    installer?.matches.forEach((match) => {
      if (typeof match.id === 'string' && match.id && !entries.has(match.id)) {
        entries.set(match.id, {
          id: match.id,
          name: match.tab.name || match.id,
          error: '',
          runtime: false,
        });
      }
    });
    const descriptors = [...entries.values()]
      .map((device) => {
        const cells = store.getDeviceCells(device.id);
        const matches = installer?.getDeviceMatches(device.id) || [];
        const match = installer?.getDeviceMatch(device.id);
        const errorCount = cells.filter((cell) => !!cell.error?.length).length;
        const hasError = !!device.error || !!errorCount || matches.length > 1;
        return { ...device, cells, matches, match, errorCount, hasError };
      })
      .sort(
        (a, b) =>
          Number(!!b.matches.length) - Number(!!a.matches.length) ||
          a.name.localeCompare(b.name, ru ? 'ru' : 'en')
      );
    const devices = descriptors.filter((device) => {
      const words = [
        device.name,
        device.id,
        device.match?.portName,
        device.match?.portPath,
        device.match?.address,
        device.match?.typeName,
        ...device.cells.map((cell) => `${cell.name} ${cell.controlId}`),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return (
        words.includes(query) &&
        (filter !== 'ports' || device.matches.length) &&
        (filter !== 'errors' || device.hasError)
      );
    });
    const selected = descriptors.find((device) => device.id === route.device);
    const activeTab = ['history', 'diagnostics', ...(isAdmin ? ['settings'] : [])].includes(
      route.tab
    )
      ? route.tab
      : 'channels';
    const routeWithSearch = { ...route, search };
    const backHref = deviceHref({ search, filter });
    const groups = groupChannels(
      selected?.cells.filter((cell) =>
        `${cell.name} ${cell.controlId}`
          .toLocaleLowerCase()
          .includes(channelSearch.trim().toLocaleLowerCase())
      ) || []
    );
    const groupLabels: Record<ChannelGroup, string> = {
      control: text('Управление', 'Controls'),
      input: text('Входы', 'Inputs'),
      value: text('Измерения', 'Measurements'),
      detail: text('Счётчики и служебные каналы', 'Counters and technical channels'),
    };
    const tabItems = [
      { id: 'device-channels', label: text('Каналы', 'Channels') },
      ...(isAdmin ? [{ id: 'device-settings', label: text('Настройки', 'Settings') }] : []),
      { id: 'device-history', label: text('История', 'History') },
      { id: 'device-diagnostics', label: text('Диагностика', 'Diagnostics') },
    ];
    const status = (device) =>
      device.matches.length > 1
        ? text('Конфликт MQTT ID', 'MQTT ID conflict')
        : device.hasError
          ? text('Есть ошибки', 'Errors reported')
          : !device.cells.length
            ? text('Каналы не получены', 'No channels received')
            : text('Ошибок не получено', 'No errors reported');
    const connection = (device) =>
      device.match
        ? `${device.match.portName} · ${text('адрес', 'address')} ${device.match.address ?? '—'}`
        : device.matches.length > 1
          ? text('Несколько устройств в конфигурации', 'Multiple configured devices')
          : installer?.loading
            ? text('Загрузка портов…', 'Loading ports…')
            : text('MQTT-устройство', 'MQTT device');

    return (
      <PageLayout
        title={text('Устройства', 'Devices')}
        hasRights={authStore.hasRights(UserRole.Operator)}
        actions={
          isAdmin ? (
            <a className="devices-portsLink" href="#!/serial-config">
              {text('Все порты и добавление', 'All ports and adding devices')}
              <ArrowRightIcon />
            </a>
          ) : null
        }
      >
        {polling && (
          <ChannelPolling
            key={`${polling.deviceId}/${polling.controlId}`}
            {...polling}
            installer={installer}
            onClose={() => setPolling(null)}
            onSettings={() => {
              setPolling(null);
              onNavigate?.({ tab: 'settings' });
            }}
          />
        )}
        <div className={`devices-workspace ${selected ? 'devices-workspaceSelected' : ''}`}>
          {installer?.isDirty && (
            <div className="devices-draftNotice" role="status">
              {text(
                'В конфигурации есть несохранённые изменения. Черновик сохраняется при переходе между устройствами и вкладками; сохранение в «Настройках» применяет все изменения.',
                'There are unsaved configuration changes. The draft is kept across device and tab navigation; saving in Settings applies all changes.'
              )}
            </div>
          )}
          {!uiStore.isConnected && (
            <Alert variant="warn">
              {text(
                'Нет соединения с контроллером. Показаны ранее полученные данные; управление и история ждут подключения.',
                'Disconnected from the controller. Previously received data is shown; controls and history await connection.'
              )}
            </Alert>
          )}
          {installer?.error && !installer.loaded && (
            <Alert variant="warn">
              <span>
                {text(
                  'Не удалось загрузить конфигурацию портов: ',
                  'Could not load port configuration: '
                )}
                {installer.error}
              </span>
              <Button
                size="small"
                variant="secondary"
                onClick={() => installer.reload()}
                label={text('Повторить', 'Retry')}
              />
            </Alert>
          )}
          <div className="devices-catalogToolbar">
            <Input
              value={search}
              onChange={(value) => setSearch(String(value))}
              placeholder={text('Имя, MQTT ID, канал или порт', 'Name, MQTT ID, channel or port')}
              ariaLabel={text('Поиск устройств', 'Search devices')}
              isFullWidth
            />
            <div
              className="devices-filters"
              role="group"
              aria-label={text('Фильтр устройств', 'Device filter')}
            >
              {[
                ['all', text('Все', 'All')],
                ...(isAdmin ? [['ports', text('На портах', 'On ports')]] : []),
                ['errors', text('С ошибками', 'With errors')],
              ].map(([value, label]) => (
                <a
                  key={value}
                  aria-current={filter === value ? 'true' : undefined}
                  href={deviceHref({ ...routeWithSearch, filter: value })}
                >
                  {label}
                </a>
              ))}
            </div>
            <span className="devices-resultCount" role="status">
              {text('Найдено', 'Found')}: {devices.length}
            </span>
          </div>
          <div className={`devices-layout ${selected ? 'devices-layoutDetail' : ''}`}>
            <section
              className="devices-catalog"
              aria-label={text('Каталог устройств', 'Device catalog')}
            >
              {!selected && (
                <div className="devices-catalogHeading">
                  <span>{text('Устройство / MQTT ID', 'Device / MQTT ID')}</span>
                  <span>{text('Подключение', 'Connection')}</span>
                  <span>{text('Каналы', 'Channels')}</span>
                  <span>{text('Состояние', 'Status')}</span>
                </div>
              )}
              <div className="devices-catalogList">
                {devices.map((device) => (
                  <a
                    className={`devices-catalogItem ${device.id === selected?.id ? 'devices-catalogItemSelected' : ''}`}
                    href={deviceHref({ search, filter, device: device.id })}
                    aria-current={device.id === selected?.id ? 'page' : undefined}
                    key={device.id}
                  >
                    <span className="devices-catalogName">
                      <strong>{device.name}</strong>
                      <code>{device.id}</code>
                    </span>
                    <span className="devices-catalogConnection">{connection(device)}</span>
                    <span className="devices-catalogChannels">
                      {device.cells.length}
                      <span className="devices-mobileChannelLabel">
                        {' '}
                        {text('каналов', 'channels')}
                      </span>
                    </span>
                    <span
                      className={`devices-status ${device.hasError ? 'devices-statusError' : ''}`}
                    >
                      <i />
                      {status(device)}
                    </span>
                    <ArrowRightIcon className="devices-catalogArrow" />
                  </a>
                ))}
                {!devices.length && (
                  <div className="devices-empty" role="status">
                    <strong>
                      {!store.devices.size && !uiStore.isConnected
                        ? text('Ожидаем данные контроллера', 'Waiting for controller data')
                        : text('Устройства не найдены', 'No devices found')}
                    </strong>
                    <p>
                      {text(
                        'Измените поиск или фильтр. Устройства из конфигурации портов появляются и без полученных MQTT-каналов.',
                        'Change the search or filter. Devices configured on ports also appear before MQTT channels are received.'
                      )}
                    </p>
                  </div>
                )}
              </div>
            </section>
            {route.device && !selected && (
              <div className="devices-empty" role="status">
                <strong>
                  {!store.devices.size || installer?.loading
                    ? text('Загружаем устройство…', 'Loading device…')
                    : text('Устройство не найдено', 'Device not found')}
                </strong>
                <p>
                  <code>{route.device}</code>
                </p>
                <a href={backHref}>{text('Вернуться к списку', 'Back to devices')}</a>
              </div>
            )}
            {selected && (
              <section className="devices-detail" aria-labelledby="device-title">
                <header className="devices-detailHeader">
                  <a className="devices-back" href={backHref}>
                    <ArrowLeftIcon />
                    {text('К списку', 'Back to devices')}
                  </a>
                  <div className="devices-detailTitle">
                    <div>
                      <h2 id="device-title">{selected.name}</h2>
                      <code>{selected.id}</code>
                    </div>
                    <span
                      className={`devices-status ${selected.hasError ? 'devices-statusError' : ''}`}
                    >
                      <i />
                      {status(selected)}
                    </span>
                  </div>
                  <dl className="devices-identity">
                    <div>
                      <dt>{text('Подключение', 'Connection')}</dt>
                      <dd>{connection(selected)}</dd>
                    </div>
                    <div>
                      <dt>{text('Тип', 'Type')}</dt>
                      <dd>{selected.match?.typeName || text('MQTT-устройство', 'MQTT device')}</dd>
                    </div>
                    <div>
                      <dt>{text('Каналы', 'Channels')}</dt>
                      <dd>{selected.cells.length}</dd>
                    </div>
                  </dl>
                </header>
                <Tabs
                  className="devices-tabs"
                  orientation="horizontal"
                  items={tabItems}
                  activeTab={`device-${activeTab}`}
                  onTabChange={(id) => onNavigate?.({ tab: String(id).replace('device-', '') })}
                />
                <div className="devices-detailContent">
                  <TabContent tabId="device-channels" activeTab={`device-${activeTab}`}>
                    <div className="devices-channelToolbar">
                      <Input
                        value={channelSearch}
                        onChange={(value) => setChannelSearch(String(value))}
                        placeholder={text(
                          'Найти канал этого устройства',
                          'Find a channel on this device'
                        )}
                        ariaLabel={text('Поиск каналов устройства', 'Search device channels')}
                        isFullWidth
                      />
                    </div>
                    {!!groups.control.length && (
                      <p className="devices-controlHint">
                        {text(
                          'Управление отправляет значения устройству сразу. Настройки опроса сохраняются отдельно во вкладке «Настройки».',
                          'Controls send values to the device immediately. Polling settings are saved separately in Settings.'
                        )}
                      </p>
                    )}
                    {(Object.keys(groups) as ChannelGroup[]).map(
                      (key) =>
                        !!groups[key].length && (
                          <details
                            className="devices-channelGroup"
                            key={key}
                            open={key !== 'detail' || !!channelSearch}
                          >
                            <summary>
                              <h3>{groupLabels[key]}</h3>
                              <span>{groups[key].length}</span>
                            </summary>
                            <div>
                              {groups[key].map((cell) => (
                                <div className="devices-channelRow" key={cell.id}>
                                  <fieldset
                                    className="devices-channelValue"
                                    disabled={!uiStore.isConnected}
                                    onPointerDownCapture={blockDisconnectedActions}
                                    onClickCapture={blockDisconnectedActions}
                                    onKeyDownCapture={blockDisconnectedActions}
                                    onKeyUpCapture={blockDisconnectedActions}
                                  >
                                    <Cell cell={cell} hideHistory />
                                  </fieldset>
                                  {isAdmin && selected.match && (
                                    <Button
                                      variant="unaccented"
                                      size="small"
                                      label={text('Опрос', 'Polling')}
                                      aria-label={text(
                                        `Настройки опроса канала ${cell.name}`,
                                        `Polling settings for ${cell.name}`
                                      )}
                                      onClick={() =>
                                        setPolling({
                                          deviceId: selected.id,
                                          controlId: cell.controlId,
                                          name: cell.name,
                                        })
                                      }
                                    />
                                  )}
                                  <a
                                    className="devices-channelHistory"
                                    title={text(
                                      `История канала ${cell.name}`,
                                      `History for ${cell.name}`
                                    )}
                                    aria-label={text(
                                      `История канала ${cell.name}`,
                                      `History for ${cell.name}`
                                    )}
                                    href={deviceHref({
                                      ...routeWithSearch,
                                      tab: 'history',
                                      channel: cell.id,
                                    })}
                                  >
                                    <StatsIcon />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </details>
                        )
                    )}
                    {!Object.values(groups).some((cells) => cells.length) && (
                      <div className="devices-empty">
                        <strong>
                          {channelSearch
                            ? text('Таких каналов нет', 'No matching channels')
                            : text('Каналы пока не получены', 'No channels received yet')}
                        </strong>
                        <p>
                          {text(
                            'Проверьте настройки и диагностику устройства. Отсутствие каналов не означает, что модуль отключён.',
                            'Check the device settings and diagnostics. Missing channels do not by themselves mean the module is disconnected.'
                          )}
                        </p>
                      </div>
                    )}
                  </TabContent>
                  {isAdmin && (
                    <TabContent tabId="device-settings" activeTab={`device-${activeTab}`}>
                      <fieldset
                        className="devices-settingsFieldset"
                        disabled={!uiStore.isConnected}
                      >
                        <DeviceSettings installer={installer} deviceId={selected.id} />
                      </fieldset>
                    </TabContent>
                  )}
                  <TabContent tabId="device-history" activeTab={`device-${activeTab}`}>
                    <DeviceHistory
                      key={selected.id}
                      deviceId={selected.id}
                      cells={selected.cells}
                      historyProxy={historyProxy}
                      channelId={route.channel}
                      onChannelChange={(channel) => onNavigate?.({ channel }, { replace: true })}
                    />
                  </TabContent>
                  <TabContent tabId="device-diagnostics" activeTab={`device-${activeTab}`}>
                    <DeviceDiagnostics
                      deviceId={selected.id}
                      device={selected}
                      cells={selected.cells}
                      installer={installer}
                      logsProxy={logsProxy}
                    />
                    <details className="devices-maintenance">
                      <summary>
                        {text('Дополнительные действия с MQTT', 'Additional MQTT actions')}
                      </summary>
                      <p>
                        {text(
                          'Удаление очищает сохранённые MQTT-топики этого устройства. Оно не удаляет модуль из конфигурации портов; драйвер может опубликовать данные снова.',
                          'Deletion clears this device’s retained MQTT topics. It does not remove the module from port configuration; its driver may publish the data again.'
                        )}
                      </p>
                      <Button
                        variant="danger"
                        label={text('Удалить MQTT-данные устройства', 'Delete device MQTT data')}
                        disabled={!uiStore.isConnected}
                        onClick={() => setDeletedDeviceId(selected.id)}
                      />
                    </details>
                  </TabContent>
                </div>
              </section>
            )}
          </div>
        </div>
        <Confirm
          isOpened={!!deletedDeviceId}
          heading={text('Удалить MQTT-данные?', 'Delete MQTT data?')}
          variant="danger"
          closeCallback={() => setDeletedDeviceId(null)}
          confirmCallback={() => {
            store.deleteDevice(deletedDeviceId);
            setDeletedDeviceId(null);
            onNavigate?.({ device: '', tab: '', channel: '' });
          }}
        >
          <p>
            {text(
              'Будут очищены сохранённые MQTT-топики устройства',
              'Retained MQTT topics will be cleared for'
            )}{' '}
            <strong>{deletedDeviceId}</strong>.{' '}
            {text(
              'Настройки портов и сам физический модуль сохранятся.',
              'Port settings and the physical module will remain.'
            )}
          </p>
        </Confirm>
      </PageLayout>
    );
  }
);

export default DevicesPage;
