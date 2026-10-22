import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { Chart } from '@/components/chart';
import { DateTimePicker } from '@/components/datetime-picker';
import { Dropdown } from '@/components/dropdown';
import { Table, TableCell, TableRow } from '@/components/table';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import { HistoryStore } from '@/stores/history';
import { decode } from '@/stores/history/history-url';
import { historyCsv } from '@/stores/history/csv';
import { uiStore } from '@/stores/ui';
import { downloadFile } from '@/utils/donwload-file';
import { useParseHash } from '@/utils/url';
import { useStore } from '@/utils/use-store';
import type { HistoryPageProps } from './types';
import './styles.css';

const HistoryPage = observer(
  ({ historyProxy, dashboardsStore, devicesStore, $state }: HistoryPageProps) => {
    const { t, i18n } = useTranslation();
    const text = (ru: string, en: string) => (i18n.language.startsWith('ru') ? ru : en);
    const { id, params } = useParseHash();

    const store = useStore(
      () =>
        new HistoryStore({
          historyProxy,
          dashboardsStore,
          devicesStore,
          $state,
        })
    );
    const [clock, setClock] = useState<number | null>(null);
    useEffect(() => {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 12000);
      const start = Date.now();
      const fallback = setTimeout(() => setClock(0), 12010);
      fetch('/device/info', {
        credentials: 'same-origin',
        signal: abort.signal,
      })
        .then((response) => {
          const date = Date.parse(response.headers.get('date'));
          return response.ok && Number.isFinite(date) ? date + 500 - (start + Date.now()) / 2 : 0;
        })
        .catch(() => 0)
        .then((offset) => {
          if (!abort.signal.aborted) {
            clearTimeout(fallback);
            setClock(offset);
          }
        })
        .finally(() => clearTimeout(timeout));
      return () => {
        abort.abort();
        clearTimeout(timeout);
        clearTimeout(fallback);
      };
    }, []);
    useEffect(() => {
      if (dashboardsStore.isLoading || clock === null) return;
      store.readDatesFromUrl(id);
      const fromUrl = decode(id);
      if (!fromUrl.s) store.setSelectedStartDateFromInput(new Date(Date.now() + clock - 86400000));
      if (!fromUrl.e) store.setSelectedEndDateFromInput(new Date(Date.now() + clock));
      store.buildControls(id);
      return () => store.stopLoadingData();
    }, [id, dashboardsStore.isLoading, clock]);

    const load = () => {
      store.prepareLoad();
      store.loadData(params.has('fullscreen'));
    };
    const choosePeriod = (seconds: number) => {
      store.stopLoadingData();
      const end = new Date(Date.now() + (clock || 0));
      store.setSelectedStartDateFromInput(new Date(end.getTime() - seconds * 1000));
      store.setSelectedEndDateFromInput(end);
      if (store.selectedControls.some(Boolean)) load();
    };
    const selected = store.selectedControls.filter(Boolean);
    const urlRange = decode(id);
    const rangeStart = urlRange.s || store.selectedStartDate;
    const rangeEnd = urlRange.e || store.selectedEndDate;
    const duration =
      rangeStart && rangeEnd ? (rangeEnd.getTime() - rangeStart.getTime()) / 1000 : 0;
    const isRecent = rangeEnd && Math.abs(Date.now() + (clock || 0) - rangeEnd.getTime()) < 90000;
    const options = store.controls
      .map((control) => ({
        value: `${control.deviceId}/${control.controlId}${control.widget ? `/${control.widget.id}` : ''}`,
        label: `${control.name}${control.units ? ` · ${control.units}` : ''}`,
      }))
      .filter((option) => !selected.includes(option.value));
    const label = (id: string) =>
      store.controls.find(
        (item) =>
          `${item.deviceId}/${item.controlId}${item.widget ? `/${item.widget.id}` : ''}` === id
      )?.name || id;
    return (
      <PageLayout
        title={t('history.title')}
        errors={store.errors}
        isLoading={dashboardsStore.isLoading || clock === null}
        hasRights={authStore.hasRights(UserRole.User)}
        actions={
          store.dataPointsMultiple.length ? (
            <Button
              variant="secondary"
              label={text('Скачать CSV', 'Download CSV')}
              disabled={store.loadPending}
              onClick={() =>
                downloadFile(
                  `wb-history-${new Date().toISOString().slice(0, 10)}.csv`,
                  'text/csv',
                  [
                    historyCsv(
                      store.charts.map(
                        (chart) => `${chart.channelName}${chart.units ? ` [${chart.units}]` : ''}`
                      ),
                      store.dataPointsMultiple
                    ),
                  ]
                )
              }
            />
          ) : null
        }
      >
        <div className="history-workspace" ref={store.setChartContainerRef}>
          <p className="history-hint">
            {text(
              'Найдите и добавьте каналы — сравнение загрузится сразу. Разные единицы отображаются на отдельных шкалах.',
              'Search and add channels to load a comparison immediately. Different units have separate scales.'
            )}
          </p>
          <Dropdown
            id="history-add-channel"
            value={null}
            isSearchable
            ariaLabel={text('Добавить канал для сравнения', 'Add a comparison channel')}
            placeholder={text('Найти и добавить канал…', 'Search and add a channel…')}
            options={options}
            isDisabled={!uiStore.isConnected}
            onChange={(option) => {
              if (!option) return;
              store.selectControls([...selected, String(option.value)]);
              load();
            }}
          />
          <div className="history-selection">
            {selected.map((id) => (
              <div key={id}>
                <span>{label(id)}</span>
                <Button
                  size="small"
                  variant="unaccented"
                  aria-label={text(`Убрать ${label(id)}`, `Remove ${label(id)}`)}
                  label={text('Убрать', 'Remove')}
                  onClick={() => {
                    const next = selected.filter((item) => item !== id);
                    store.selectControls(next);
                    if (next.length) load();
                    else $state.go('history', {}, { inherit: false });
                  }}
                />
              </div>
            ))}
          </div>
          <div
            className="history-periods"
            role="group"
            aria-label={text('Быстрый период', 'Quick period')}
          >
            {[
              [3600, '1ч', '1h'],
              [21600, '6ч', '6h'],
              [86400, '24ч', '24h'],
              [604800, '7д', '7d'],
            ].map(([seconds, ru, en]) => (
              <Button
                key={seconds}
                variant={isRecent && duration === Number(seconds) ? 'primary' : 'secondary'}
                aria-pressed={!!isRecent && duration === Number(seconds)}
                label={text(String(ru), String(en))}
                disabled={!uiStore.isConnected}
                onClick={() => choosePeriod(Number(seconds))}
              />
            ))}
          </div>
          {rangeStart && rangeEnd && (
            <p className="history-range" aria-live="polite">
              <strong>{text('Диапазон:', 'Range:')}</strong>{' '}
              {format(rangeStart, 'dd.MM.yyyy HH:mm:ss')} —{' '}
              {format(rangeEnd, 'dd.MM.yyyy HH:mm:ss')} (
              {Intl.DateTimeFormat().resolvedOptions().timeZone})
            </p>
          )}
          <details className="history-customDates">
            <summary>{text('Задать даты', 'Custom dates')}</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                load();
              }}
            >
              <label>
                {t('history.labels.start')}
                <DateTimePicker
                  id="history-start"
                  value={store.selectedStartDate}
                  onChange={store.setSelectedStartDateFromInput}
                />
              </label>
              <label>
                {t('history.labels.end')}
                <DateTimePicker
                  id="history-end"
                  value={store.selectedEndDate}
                  disabledDates={{ before: store.selectedStartDate }}
                  onChange={store.setSelectedEndDateFromInput}
                />
              </label>
              <Button
                type="submit"
                label={text('Применить период', 'Apply dates')}
                disabled={
                  !selected.length ||
                  !uiStore.isConnected ||
                  !store.selectedStartDate ||
                  !store.selectedEndDate ||
                  store.selectedStartDate >= store.selectedEndDate
                }
              />
            </form>
          </details>
          <div className="history-loadActions">
            {store.loadPending ? (
              <>
                <span role="status">{text('Загрузка сравнения…', 'Loading comparison…')}</span>
                <Button
                  variant="secondary"
                  label={text('Отменить загрузку', 'Cancel loading')}
                  onClick={store.stopLoadingData}
                />
              </>
            ) : (
              !!selected.length && (
                <Button
                  variant="unaccented"
                  label={text('Обновить данные', 'Refresh data')}
                  disabled={!uiStore.isConnected}
                  onClick={load}
                />
              )
            )}
          </div>
          {!uiStore.isConnected && (
            <p role="status">
              {text(
                'Нет связи с контроллером. Восстановите соединение для загрузки истории.',
                'Reconnect to the controller to load history.'
              )}
            </p>
          )}
          {!store.loadPending && !!store.chartConfig.length && (
            <Chart
              data={store.chartConfig}
              layout={store.layoutConfig}
              config={{
                displayModeBar: 'hover',
                locale: i18n.language,
                displaylogo: false,
              }}
              onRelayout={store.onRelayout}
            />
          )}
          {!store.loadPending && !store.chartConfig.length && (
            <p className="history-empty">
              {selected.length
                ? text(
                    'За выбранный период данных не получено. Попробуйте другой период или канал.',
                    'No data received for this period. Try another period or channel.'
                  )
                : text(
                    'Добавьте первый канал с помощью поиска выше.',
                    'Use the search above to add the first channel.'
                  )}
            </p>
          )}
          {!!store.dataPointsMultiple.length && (
            <details className="history-dataTable">
              <summary>
                {text(
                  `Таблица данных · ${store.dataPointsMultiple.length} строк`,
                  `Data table · ${store.dataPointsMultiple.length} rows`
                )}
              </summary>
              <p>
                {text(
                  'CSV создаётся из полученных точек, включая агрегацию backend. Скрытая таблица не ограничивает выгрузку.',
                  'CSV uses received points, including backend aggregation. Collapsing the table does not limit the export.'
                )}
              </p>
              <Table id="history-table">
                <TableRow isHeading>
                  <TableCell>{t('history.labels.date')}</TableCell>
                  {store.charts.map((chart, index) => (
                    <TableCell key={index}>
                      {chart.channelName}
                      {chart.units && ` [${chart.units}]`}
                    </TableCell>
                  ))}
                </TableRow>
                {store.dataPointsMultiple.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {format(new Date(row.date), row.showMs ? 'PPpp.SSS' : 'PPpp', {
                        locale: i18n.language.startsWith('ru') ? ru : enUS,
                      })}
                    </TableCell>
                    {row.value.map((value, index) => (
                      <TableCell key={index}>{value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </Table>
            </details>
          )}
        </div>
      </PageLayout>
    );
  }
);
export default HistoryPage;
