import { autorun } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { ConfigurationChanges } from '@/components/configuration-changes/configuration-changes';
import { Confirm } from '@/components/confirm';
import { Dropdown } from '@/components/dropdown';
import { Input } from '@/components/input';
import { Tabs } from '@/components/tabs';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import { uiStore } from '@/stores/ui';
import { WidgetEdit } from '../[slug]/components/widget-edit';
import PanelDraftStore from './panel-draft-store';
import './styles.css';

export const PanelBuilder = observer(
  ({ proxy, dashboardsStore, devicesStore, panelId, onDirtyChange, onExit }: any) => {
    const { i18n } = useTranslation();
    const text = (ru: string, en: string) => (i18n.language.startsWith('ru') ? ru : en);
    const [store] = useState(() => new PanelDraftStore(proxy, dashboardsStore, panelId));
    const [tab, setTab] = useState('channels');
    const [editing, setEditing] = useState<string | null>(null);
    const [scope, setScope] = useState<'copy' | 'all'>('copy');
    const [confirm, setConfirm] = useState<'save' | 'discard' | null>(null);
    useEffect(() => {
      if (authStore.hasRights(UserRole.Operator)) store.load();
    }, []);
    useEffect(() => {
      const dispose = autorun(() => onDirtyChange?.(store.isDirty));
      return () => {
        dispose();
        onDirtyChange?.(false);
      };
    }, [store]);
    const locked = store.isSaving;
    const freeze = (event: SyntheticEvent) => {
      if (locked) {
        if (!('key' in event && event.key === 'Tab')) event.preventDefault();
        event.stopPropagation();
      }
    };
    const panel = store.panel;
    const widget =
      editing === 'new'
        ? { id: '', name: '', description: '', compact: false, cells: [] }
        : store.widget(editing);
    const tabs = [
      ['channels', text('Каналы', 'Channels')],
      ['layout', text('Расположение', 'Layout')],
      ['preview', text('Предпросмотр', 'Preview')],
      ['changes', text('Изменения', 'Changes')],
    ].map(([id, label]) => ({ id, label }));
    return (
      <PageLayout
        title={text('Редактор панели', 'Panel builder')}
        hasRights={authStore.hasRights(UserRole.Operator)}
        isLoading={store.loading}
      >
        <div
          className="panel-builder"
          onPointerDownCapture={freeze}
          onClickCapture={freeze}
          onKeyDownCapture={freeze}
          onKeyUpCapture={freeze}
        >
          {store.error && (
            <Alert variant="danger">
              {store.error === 'STALE_CONFIGURATION'
                ? text(
                    'Конфигурация изменена в другом окне. Сохранение отменено; черновик оставлен для копирования. Отмените изменения и откройте панель заново.',
                    'Configuration changed in another window. Save was cancelled; the draft remains available to copy. Discard it and reopen the panel.'
                  )
                : store.error}
            </Alert>
          )}
          {!uiStore.isConnected && (
            <Alert variant="warn">
              {text(
                'Нет связи. Черновик можно редактировать в памяти; для сохранения восстановите соединение.',
                'Disconnected. You can edit the draft in memory; reconnect to save.'
              )}
            </Alert>
          )}
          {panel && !panel.isSvg && (
            <>
              <div className="panel-builder-heading">
                <label>
                  {text('Название панели', 'Panel name')}
                  <Input
                    value={panel.name}
                    onChange={(value) => store.setName(String(value))}
                    isFullWidth
                    isDisabled={locked}
                  />
                </label>
                <p>
                  {text(
                    'Изменения применяются только кнопкой «Сохранить панель». Предпросмотр не управляет оборудованием.',
                    'Changes are applied only with Save panel. Preview does not control hardware.'
                  )}
                </p>
              </div>
              <Tabs
                orientation="horizontal"
                activeTab={tab}
                items={tabs}
                onTabChange={(id) => setTab(String(id))}
              />
              <div className="panel-builder-content">
                {tab === 'channels' && (
                  <>
                    <h2>{text('Состав панели', 'Panel contents')}</h2>
                    <p>
                      {text(
                        'Добавьте существующий виджет или создайте новый из каналов.',
                        'Add an existing widget or create one from channels.'
                      )}
                    </p>
                    <div className="panel-builder-add">
                      <Dropdown
                        value={null}
                        isSearchable
                        isDisabled={locked}
                        placeholder={text('Найти существующий виджет', 'Find an existing widget')}
                        ariaLabel={text('Добавить виджет', 'Add widget')}
                        options={store.config.widgets
                          .filter((widget) => !panel.widgets.includes(widget.id))
                          .map((widget) => ({
                            value: widget.id,
                            label: widget.name,
                          }))}
                        onChange={(option) => option && store.addWidget(String(option.value))}
                      />
                      <Button
                        label={text('Создать виджет из каналов', 'Create widget from channels')}
                        disabled={locked}
                        onClick={() => {
                          setEditing('new');
                          setScope('copy');
                        }}
                      />
                    </div>
                    {panel.widgets.map((id) => (
                      <div className="panel-builder-widget" key={id}>
                        <div>
                          <strong>{store.widget(id)?.name || id}</strong>
                          <small>
                            {text('Каналов:', 'Channels:')} {store.widget(id)?.cells.length || 0}
                            {store.associatedPanels(id).length > 1 &&
                              text(' · общий виджет', ' · shared widget')}
                          </small>
                        </div>
                        <Button
                          variant="secondary"
                          label={text('Изменить каналы', 'Edit channels')}
                          disabled={locked}
                          onClick={() => {
                            setEditing(id);
                            setScope('copy');
                          }}
                        />
                        <Button
                          variant="unaccented"
                          label={text('Убрать с панели', 'Remove from panel')}
                          disabled={locked}
                          onClick={() => store.removeWidget(id)}
                        />
                      </div>
                    ))}
                    {!panel.widgets.length && (
                      <p>
                        {text(
                          'Панель пуста. Добавьте первый виджет выше.',
                          'The panel is empty. Add the first widget above.'
                        )}
                      </p>
                    )}
                  </>
                )}
                {tab === 'layout' && (
                  <>
                    <h2>{text('Порядок виджетов', 'Widget order')}</h2>
                    <p>
                      {text(
                        'Порядок чтения сохраняется и на узком экране.',
                        'Reading order is preserved on narrow screens.'
                      )}
                    </p>
                    {panel.widgets.map((id, index) => (
                      <div className="panel-builder-widget" key={id}>
                        <strong>{store.widget(id)?.name || id}</strong>
                        <Button
                          variant="secondary"
                          label={text('Выше', 'Up')}
                          disabled={locked || !index}
                          onClick={() => store.moveWidget(index, -1)}
                        />
                        <Button
                          variant="secondary"
                          label={text('Ниже', 'Down')}
                          disabled={locked || index === panel.widgets.length - 1}
                          onClick={() => store.moveWidget(index, 1)}
                        />
                      </div>
                    ))}
                  </>
                )}
                {tab === 'preview' && (
                  <>
                    <h2>{panel.name || text('Предпросмотр', 'Preview')}</h2>
                    <p>
                      {text(
                        'Только просмотр: показания живые, отправка команд здесь отсутствует.',
                        'Read-only preview: readings are live, with no command controls.'
                      )}
                    </p>
                    <div className="panel-builder-preview">
                      {panel.widgets.map((id) => (
                        <section key={id}>
                          <h3>{store.widget(id)?.name || id}</h3>
                          {store.widget(id)?.cells.map((item, index) => {
                            const cell = devicesStore.cells.get(item.id);
                            return (
                              <div key={index}>
                                <span>{item.name || cell?.name || item.id}</span>
                                {item.type !== 'separator' && (
                                  <strong>
                                    {cell?.isComplete
                                      ? `${cell.value ?? '—'} ${cell.units || ''}`
                                      : text('Нет данных', 'No data')}
                                  </strong>
                                )}
                                {!!cell?.error?.length && (
                                  <small role="status">
                                    {text('Канал сообщает об ошибке', 'Channel error reported')}
                                  </small>
                                )}
                              </div>
                            );
                          })}
                        </section>
                      ))}
                    </div>
                  </>
                )}
                {tab === 'changes' && (
                  <>
                    <h2>{text('Состав изменений', 'Changes to apply')}</h2>
                    <p>
                      {text(
                        'Записывается конфигурация Web UI целиком. Перед сохранением проверяется, не изменилась ли она с момента загрузки. Это не атомарная блокировка backend.',
                        'The entire Web UI configuration is written. A stale-data check runs before saving; it is not an atomic backend lock.'
                      )}
                    </p>
                    <ConfigurationChanges changes={store.changes} />
                  </>
                )}
              </div>
              <footer className="panel-builder-footer">
                <span role="status">
                  {store.isDirty
                    ? text('Есть несохранённые изменения', 'Unsaved changes')
                    : text('Изменений нет', 'No changes')}
                </span>
                <Button
                  variant="secondary"
                  label={text('Отменить и выйти', 'Discard and exit')}
                  disabled={store.isSaving}
                  onClick={() => (store.isDirty ? setConfirm('discard') : onExit(panelId))}
                />
                <Button
                  label={text('Сохранить панель', 'Save panel')}
                  disabled={locked || !uiStore.isConnected || !store.canSave}
                  isLoading={store.isSaving}
                  onClick={() => setConfirm('save')}
                />
              </footer>
              {editing && widget && (
                <>
                  <WidgetEdit
                    widget={{ ...widget, associatedDashboards: [] } as any}
                    cells={devicesStore.cells}
                    controls={devicesStore.controls}
                    scopeControl={
                      <div className="panel-builder-scope">
                        {editing !== 'new' && store.associatedPanels(editing).length > 1 && (
                          <label>
                            {text(
                              'Общий виджет используется на панелях:',
                              'Shared widget is used on:'
                            )}{' '}
                            {store
                              .associatedPanels(editing)
                              .map((panel) => panel.name)
                              .join(', ')}
                            <select
                              aria-label={text('Область изменения виджета', 'Widget edit scope')}
                              value={scope}
                              disabled={locked}
                              onChange={(event) => setScope(event.target.value as 'copy' | 'all')}
                            >
                              <option value="copy">
                                {text(
                                  'Создать копию для этой панели',
                                  'Create a copy for this panel'
                                )}
                              </option>
                              <option value="all">
                                {text('Изменить на всех панелях', 'Change on every panel')}
                              </option>
                            </select>
                          </label>
                        )}
                      </div>
                    }
                    isOpened
                    onClose={() => setEditing(null)}
                    onSave={(data) => {
                      store.saveWidget(data, scope);
                      setEditing(null);
                    }}
                  />
                </>
              )}
              <Confirm
                isOpened={confirm === 'discard'}
                heading={text('Отменить черновик?', 'Discard draft?')}
                acceptLabel={text('Отменить и выйти', 'Discard and exit')}
                closeCallback={() => setConfirm(null)}
                confirmCallback={() => {
                  store.discard();
                  onDirtyChange?.(false);
                  onExit(panelId);
                }}
              >
                <p>
                  {text(
                    'Несохранённые изменения панели и виджетов будут потеряны. Контроллер не изменится.',
                    'Unsaved panel and widget edits will be lost. The controller remains unchanged.'
                  )}
                </p>
              </Confirm>
              <Confirm
                isOpened={confirm === 'save'}
                heading={text('Сохранить изменения панели?', 'Save panel changes?')}
                acceptLabel={text('Сохранить', 'Save')}
                isDisabled={locked || !uiStore.isConnected || !store.canSave}
                isLoading={store.isSaving}
                closeCallback={() => setConfirm(null)}
                confirmCallback={async () => {
                  setConfirm(null);
                  if (await store.save()) {
                    onDirtyChange?.(false);
                    onExit(store.panelId);
                  }
                }}
              >
                <p>
                  {text(
                    'Проверьте изменения, включая общие виджеты на других панелях.',
                    'Review the changes, including shared widgets on other panels.'
                  )}
                </p>
                {store.error && (
                  <Alert variant="danger">
                    {store.error === 'STALE_CONFIGURATION'
                      ? text(
                          'Конфигурация изменилась в другом окне; запись отменена.',
                          'Configuration changed in another window; save cancelled.'
                        )
                      : store.error}
                  </Alert>
                )}
                <ConfigurationChanges changes={store.changes} />
              </Confirm>
            </>
          )}
        </div>
      </PageLayout>
    );
  }
);
