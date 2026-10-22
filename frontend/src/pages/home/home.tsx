import { observer } from 'mobx-react-lite';
import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowRightIcon from '@/assets/icons/arrow-right.svg';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Cell } from '@/components/cell';
import { Input } from '@/components/input';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import type { DashboardsStore } from '@/stores/dashboards';
import type { DevicesStore } from '@/stores/devices';
import { uiStore } from '@/stores/ui';
import './styles.css';

type Favorite = { id: string; label?: string };
const storageKey = 'wb-ui-home-favorites';
export const homeControls = (dashboards: DashboardsStore, devices: DevicesStore) => {
  const result = new Map<string, { id: string; label: string; group: string; extra: any }>();
  dashboards.dashboardsList
    .filter((panel) => !panel.options?.isHidden)
    .forEach((panel) => {
      panel.widgets.forEach((id) =>
        dashboards.widgets.get(id)?.cells.forEach((item) => {
          const cell = devices.cells.get(item.id);
          if (cell?.isComplete && !cell.hidden && !result.has(item.id))
            result.set(item.id, {
              id: item.id,
              label: item.name || cell.name,
              group: panel.name,
              extra: item.extra,
            });
        })
      );
    });
  return [...result.values()];
};
const readFavorites = (): Favorite[] | null => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return Array.isArray(value)
      ? value
          .filter((item) => typeof item?.id === 'string')
          .map(({ id, label }) => ({
            id,
            label: typeof label === 'string' ? label : undefined,
          }))
      : null;
  } catch {
    return null;
  }
};

const HomePage = observer(
  ({
    devicesStore,
    dashboardsStore,
  }: {
    devicesStore: DevicesStore;
    dashboardsStore: DashboardsStore;
  }) => {
    const { i18n } = useTranslation();
    const text = (ru: string, en: string) => (i18n.language.startsWith('ru') ? ru : en);
    const [saved, setSaved] = useState(readFavorites);
    const [draft, setDraft] = useState<Favorite[] | null>(null);
    const [search, setSearch] = useState('');
    const [storageError, setStorageError] = useState(false);
    const available = homeControls(dashboardsStore, devicesStore);
    const defaultControls = [...available].sort((a, b) => {
      const rank = (id: string) => {
        const cell = devicesStore.cells.get(id);
        return !cell.readOnly ? 0 : cell.units ? 1 : cell.value ? 2 : 3;
      };
      return rank(a.id) - rank(b.id);
    });
    const favorites: Favorite[] = saved ?? defaultControls.slice(0, 6).map(({ id }) => ({ id }));
    const panels = dashboardsStore.dashboardsList.filter((panel) => !panel.options?.isHidden);
    const blockOffline = (event: SyntheticEvent) => {
      if (!uiStore.isConnected) {
        if (!('key' in event && event.key === 'Tab')) event.preventDefault();
        event.stopPropagation();
      }
    };
    const move = (index: number, delta: number) => {
      const next = [...draft];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      setDraft(next);
    };
    return (
      <PageLayout
        title={text('Мой дом', 'My home')}
        hasRights={authStore.hasRights(UserRole.User)}
        isLoading={dashboardsStore.isLoading}
      >
        <div className="home-workspace">
          <p className="home-intro">
            {text(
              'Управление и показания, которыми вы пользуетесь каждый день.',
              'The controls and readings you use every day.'
            )}
          </p>
          {!uiStore.isConnected && (
            <Alert variant="warn">
              {text(
                'Нет связи с контроллером. Значения могут быть устаревшими; управление временно недоступно.',
                'Disconnected from the controller. Readings may be stale; controls are temporarily unavailable.'
              )}
            </Alert>
          )}
          <section className="home-favorites" aria-labelledby="home-favorites-title">
            <header>
              <div>
                <h2 id="home-favorites-title">{text('Избранное', 'Favorites')}</h2>
                <p>
                  {text(
                    'Настройте подборку и подписи для этого браузера.',
                    'Choose favorites and labels for this browser.'
                  )}
                </p>
              </div>
              <Button
                variant="secondary"
                label={text('Настроить избранное', 'Customize favorites')}
                onClick={() => setDraft(favorites.map((item) => ({ ...item })))}
              />
            </header>
            {draft ? (
              <div className="home-personalize">
                <Input
                  isFullWidth
                  ariaLabel={text('Найти элемент управления', 'Find a control')}
                  placeholder={text('Найти на существующих панелях', 'Search existing panels')}
                  value={search}
                  onChange={(value) => setSearch(String(value))}
                />
                <div className="home-choices">
                  {available
                    .filter((item) =>
                      `${item.label} ${item.group}`
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase())
                    )
                    .map((item) => (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          checked={draft.some((pin) => pin.id === item.id)}
                          onChange={(event) =>
                            setDraft(
                              event.target.checked
                                ? [...draft, { id: item.id }]
                                : draft.filter((pin) => pin.id !== item.id)
                            )
                          }
                        />
                        <span>
                          {item.label}
                          <small>{item.group}</small>
                        </span>
                      </label>
                    ))}
                </div>
                <h3>{text('Порядок и подписи', 'Order and labels')}</h3>
                {draft.map((pin, index) => (
                  <div className="home-editFavorite" key={pin.id}>
                    <Input
                      isFullWidth
                      ariaLabel={text('Подпись избранного', 'Favorite label')}
                      value={
                        pin.label ?? available.find((item) => item.id === pin.id)?.label ?? pin.id
                      }
                      onChange={(label) =>
                        setDraft(
                          draft.map((item) =>
                            item.id === pin.id ? { ...item, label: String(label) } : item
                          )
                        )
                      }
                    />
                    <Button
                      variant="unaccented"
                      label={text('Выше', 'Up')}
                      disabled={!index}
                      onClick={() => move(index, -1)}
                    />
                    <Button
                      variant="unaccented"
                      label={text('Ниже', 'Down')}
                      disabled={index === draft.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <Button
                      variant="unaccented"
                      label={text('Убрать', 'Remove')}
                      onClick={() => setDraft(draft.filter((item) => item.id !== pin.id))}
                    />
                  </div>
                ))}
                {!available.length && (
                  <p>
                    {text(
                      'Пока нет доступных каналов на панелях. Откройте панель ниже или попросите инсталлятора добавить элементы управления.',
                      'No available panel channels yet. Open a panel below or ask your installer to add controls.'
                    )}
                  </p>
                )}
                {storageError && (
                  <Alert variant="warn">
                    {text(
                      'Браузер не разрешил сохранить подборку. Она доступна до обновления страницы.',
                      'The browser could not save favorites. They remain available until reload.'
                    )}
                  </Alert>
                )}
                <div className="home-editActions">
                  <Button
                    label={text('Сохранить подборку', 'Save favorites')}
                    onClick={() => {
                      setSaved(draft);
                      try {
                        localStorage.setItem(storageKey, JSON.stringify(draft));
                        setStorageError(false);
                        setDraft(null);
                      } catch {
                        setStorageError(true);
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    label={text('Отмена', 'Cancel')}
                    onClick={() => setDraft(null)}
                  />
                </div>
              </div>
            ) : (
              <div className="home-controlGrid">
                {favorites.map((pin) => {
                  const item = available.find((control) => control.id === pin.id);
                  const cell = devicesStore.cells.get(pin.id);
                  return (
                    <div className="home-control" key={pin.id}>
                      {item && cell ? (
                        <>
                          <small>{item.group}</small>
                          <fieldset
                            disabled={!uiStore.isConnected}
                            onPointerDownCapture={blockOffline}
                            onClickCapture={blockOffline}
                            onKeyDownCapture={blockOffline}
                            onKeyUpCapture={blockOffline}
                          >
                            <Cell
                              cell={cell}
                              name={pin.label || item.label}
                              extra={item.extra}
                              hideHistory
                            />
                          </fieldset>
                        </>
                      ) : (
                        <>
                          <strong>{pin.label || pin.id}</strong>
                          <p>
                            {text(
                              'Канал недоступен. Откройте панель или обновите подборку.',
                              'Channel unavailable. Open its panel or update favorites.'
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
                {!favorites.length && (
                  <p className="home-empty">
                    {text(
                      'Добавьте свет, климат или нужные показания из ваших панелей кнопкой «Настроить избранное».',
                      'Add lights, climate or useful readings from your panels with Customize favorites.'
                    )}
                  </p>
                )}
              </div>
            )}
            {!draft &&
              favorites.some((pin) => {
                const cell = devicesStore.cells.get(pin.id);
                return cell && !cell.readOnly;
              }) && (
                <p className="home-writeHint">
                  {text(
                    'Изменение переключателя или значения сразу отправляется устройству.',
                    'Changing a switch or value sends it to the device immediately.'
                  )}
                </p>
              )}
          </section>
          <section className="home-panels" aria-labelledby="home-panels-title">
            <h2 id="home-panels-title">{text('Панели дома', 'Home panels')}</h2>
            <div>
              {panels.map((panel) => (
                <a
                  key={panel.id}
                  href={
                    panel.isSvg
                      ? `#!/dashboards/svg/view/${encodeURIComponent(panel.id)}`
                      : `#!/dashboards/${encodeURIComponent(panel.id)}`
                  }
                >
                  <span>
                    <strong>{panel.name}</strong>
                    <small>
                      {panel.isSvg
                        ? text('План и управление', 'Plan and controls')
                        : text('Открыть управление', 'Open controls')}
                    </small>
                  </span>
                  <ArrowRightIcon />
                </a>
              ))}
            </div>
            {!panels.length && (
              <p>
                {text(
                  'Панели ещё не настроены. Инсталлятор может создать их в режиме «Настройка».',
                  'No panels configured yet. Your installer can create them in Installer mode.'
                )}
              </p>
            )}
          </section>
        </div>
      </PageLayout>
    );
  }
);
export default HomePage;
