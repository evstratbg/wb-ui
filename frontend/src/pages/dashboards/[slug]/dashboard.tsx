import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import EditIcon from '@/assets/icons/edit.svg';
import FullScreenExitIcon from '@/assets/icons/full-screen-exit.svg';
import FullScreenIcon from '@/assets/icons/full-screen.svg';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Cell } from '@/components/cell';
import { ColumnsWrapper } from '@/components/columns-wrapper';
import { Tooltip } from '@/components/tooltip';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import { uiStore } from '@/stores/ui';
import { useToggleFullscreen } from '@/utils/fullScreen';
import { useParseHash } from '@/utils/url';
import type { DashboardPageProps } from './types';
import './styles.css';

const DashboardPage = observer(({ dashboardsStore, devicesStore }: DashboardPageProps) => {
  const { t, i18n } = useTranslation();
  const text = (ru: string, en: string) => (i18n.language.startsWith('ru') ? ru : en);
  const { cells } = devicesStore;
  const { dashboards, widgets, isLoading } = dashboardsStore;
  const { id: dashboardId, params } = useParseHash();
  const [isFullscreen, toggleFullscreen] = useToggleFullscreen();
  const canEdit =
    authStore.hasRights(UserRole.Operator) &&
    uiStore.workspaceMode === 'installer' && !params.has('hmi');
  const edit = () => {
    location.hash = '!/panel-editor?panel=' + encodeURIComponent(dashboardId);
  };
  const actions = canEdit
    ? [
    {
      title: text('Изменить в черновике панели', 'Edit in panel draft'), action: edit,
      icon: EditIcon,
      isPopupAction: true,
    },
  ] : [];

  const back = () => {
    const source = encodeURIComponent(params.get('sourceDashboardId'));
    const query = new URLSearchParams();
    if (params.has('hmi')) query.set('hmi', 'true');
    if (params.get('hmicolor')) query.set('hmicolor', params.get('hmicolor'));
    location.assign(`/#!/dashboards/svg/view/${source}${query.size ? `?${query}` : ''}`);
  };
  const offline = (event) => {
    if (!uiStore.isConnected) {
      if (event.key !== 'Tab') event.preventDefault();
      event.stopPropagation();
    }
  };
  return (
    <PageLayout
      title={dashboards.get(dashboardId)?.name || ''}
      isHideHeader={params.has('hmi')}
      isLoading={isLoading}
      hasRights
      actions={
        !params.has('fullscreen') && (
          <>
            {params.get('sourceDashboardId') && (
              <Button
                label={t('dashboard.buttons.back-to-dashboard')}
                variant="secondary"
                onClick={back}
              />
            )}
            {canEdit && !isFullscreen && (
              <Button label={text('Редактировать панель', 'Edit panel')} onClick={edit} />
            )}
            <Tooltip
              text={
                isFullscreen
                  ? t('dashboard.buttons.fullscreen-exit')
                  : t('dashboard.buttons.fullscreen')
              }
            >
              <Button
                icon={isFullscreen ? <FullScreenExitIcon /> : <FullScreenIcon />}
                variant="secondary"
                aria-label={
                  isFullscreen
                    ? t('dashboard.buttons.fullscreen-exit')
                    : t('dashboard.buttons.fullscreen')
                }
                onClick={toggleFullscreen}
              />
            </Tooltip>
          </>
        )
      }
    >
      {!uiStore.isConnected && (
        <Alert variant="warn">
          {text(
            'Нет связи. Показания могут быть устаревшими; управление отключено.',
            'Disconnected. Readings may be stale; controls are disabled.'
          )}
        </Alert>
      )}
      {dashboards.get(dashboardId)?.widgets.length ? (
        <div
          className={classNames('dashboard-container', {
            'dashboard-fullScreen': params.has('hmi'),
          })}
        >
          <ColumnsWrapper baseColumnWidth={376}>
            {dashboards.get(dashboardId).widgets.map((widgetId) =>
              widgets.get(widgetId) ? (
                <Card
                  id={widgetId}
                  heading={widgets.get(widgetId).name}
                  key={widgetId}
                  actions={actions}
                  isBodyVisible
                >
                  <fieldset
                    className="dashboard-controlBoundary"
                    disabled={!uiStore.isConnected}
                    onPointerDownCapture={offline}
                    onClickCapture={offline}
                    onKeyDownCapture={offline}
                    onKeyUpCapture={offline}
                  >
                    {widgets.get(widgetId).cells.map((cell, index) => (
                      <Fragment key={cell.id || index}>
                        {cells.has(cell.id) ? (
                          <Cell
                            cell={cells.get(cell.id)}
                            name={cell.name}
                            isCompact={widgets.get(widgetId).compact}
                            extra={cell.extra}
                          />
                        ) : cell.type === 'separator' ? (
                          <div className="dashboard-separator">
                            {cell.name && (
                              <span className="dashboard-separatorTitle">{cell.name}</span>
                            )}
                          </div>
                        ) : (
                          <p>
                            {cell.name || cell.id} · {text('Нет данных', 'No data')}
                          </p>
                        )}
                      </Fragment>
                    ))}
                  </fieldset>
                </Card>
              ) : null
            )}
          </ColumnsWrapper>
        </div>
      ) : (
        <Alert variant="info">{t('dashboard.labels.no-widgets')}</Alert>
      )}
      {params.get('sourceDashboardId') && params.has('hmi') && (
        <Button
          className="dashboard-backButton"
          label={t('dashboard.buttons.back-to-dashboard')}
          variant="secondary"
          onClick={back}
        />
      )}
    </PageLayout>
  );
});
export default DashboardPage;
