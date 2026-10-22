import { observer } from 'mobx-react-lite';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useMediaQuery } from 'react-responsive';
import { ReactSortable } from 'react-sortablejs';
import useResizeObserver from 'use-resize-observer';
import EditIcon from '@/assets/icons/edit.svg';
import FileSvgIcon from '@/assets/icons/file-svg.svg';
import FileTextIcon from '@/assets/icons/file-text.svg';
import MoveIcon from '@/assets/icons/move.svg';
import TrashIcon from '@/assets/icons/trash.svg';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Confirm } from '@/components/confirm';
import { Dropdown } from '@/components/dropdown';
import { Switch } from '@/components/switch';
import { Table, TableCell, TableRow } from '@/components/table';
import { Tooltip } from '@/components/tooltip';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import { uiStore } from '@/stores/ui';
import type { DashboardListPageProps } from './types';
import './styles.css';

const DashboardList = observer(({ dashboardsStore }: DashboardListPageProps) => {
  const { t } = useTranslation();
  const { ref, width } = useResizeObserver();
  const isDesktop = useMediaQuery({ minWidth: 874 });
  const {
    dashboards,
    isLoading, updateDashboards } = dashboardsStore;
  const hasEditRights = authStore.hasRights(UserRole.Operator) && uiStore.workspaceMode === 'installer';
  const [deletedDashboardId, setDeletedDashboardId] = useState(null);
  const dashboardsList = useMemo(() => Array.from(dashboards.values()), [dashboards.values()]);

  return (
    <>
      <PageLayout
        title={t('dashboards.title')}
        isLoading={isLoading}
        actions={
          hasEditRights && (
            <Dropdown
              value={null}
              options={[
                { label: t('dashboards.labels.text-dashboard'), value: 'dashboard',
                },
                { label: 'Svg', value: 'svg' },
              ]}
              placeholder={t('dashboards.buttons.add')}
              isButton
              onChange={(option) => {
                if (option?.value === 'svg') {
                  location.assign('/#!/dashboards/svg/add');
                } else if (option?.value === 'dashboard') {
                  location.hash = '!/panel-editor';
                }
              }}
            />
          )
        }
        hasRights
      >
        {dashboardsList.length ? (
          <Table>
            <TableRow isHeading>
              {hasEditRights && dashboardsList.length > 1 && width >= 480 && (
                <TableCell width={24} />
              )}
              <TableCell>{t('dashboards.labels.name')}</TableCell>
              {hasEditRights && <TableCell width={40} />}
              {hasEditRights && <TableCell width={40} />}
              {dashboardsList.some((dashboard) => dashboard.isSvg) && (
                <TableCell width={30} align="center">{t('dashboards.labels.type')}</TableCell>
              )}
              {hasEditRights && <TableCell width={70}>{t('dashboards.labels.in-menu')}</TableCell>}
            </TableRow>

            <ReactSortable
              tag="tbody"
              list={dashboardsList}
              setList={(value, changed) => {
                if (
                  hasEditRights &&
                  changed &&
                  value.map((item) => item.id).join('\0') !==
                    dashboardsList.map((item) => item.id).join('\0')
                ) {
                  const clearValue = value.map((dashboard: any) => {
                    // eslint-disable-next-line no-unused-vars
                    const { chosen, selected, ...value } = dashboard;
                    return value;
                  });
                  updateDashboards(clearValue);
                }
              }}
              handle=".dashboardList-sortHandle"
              animation={150}
            >
              {dashboardsList.map((dashboard) => (
                <TableRow
                  role="row"
                  aria-roledescription="sortable row"
                  aria-label={t('dashboards.buttons.open', { name: dashboard.name,
                  })}
                  url={dashboard.isSvg
                    ? `/#!/dashboards/svg/view/${dashboard.id}`
                      : `/#!/dashboards/${dashboard.id}`
                  }
                  key={dashboard.id}
                >
                  {hasEditRights && dashboardsList.length > 1 && width >= 480 && (
                    <TableCell width={24} isDraggable>
                      <MoveIcon className="dashboardList-sortHandle" />
                    </TableCell>
                  )}

                  <TableCell ellipsis>{dashboard.name}</TableCell>

                  {hasEditRights && (
                    <TableCell width={30} align="center" preventClick>
                      <Tooltip text={t('dashboards.buttons.edit')} placement="top">
                        <Button
                          size="small"
                          icon={<EditIcon />}

                          aria-label={t('dashboards.buttons.edit-dashboard', {
                            name: dashboard.name,
                          })}
                          onClick={() => {
                            if (dashboard.isSvg) {
                              location.assign(`/#!/dashboards/svg/edit/${dashboard.id}`);
                            } else {
                              location.hash =
                                '!/panel-editor?panel=' + encodeURIComponent(dashboard.id);
                            }
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                  )}

                  {hasEditRights && (
                    <TableCell width={30} align="center" preventClick>
                      <Tooltip text={t('dashboards.buttons.delete')} placement="top">
                        <Button
                          size="small"
                          variant="danger"
                          icon={<TrashIcon />}
                          aria-label={t('dashboards.buttons.delete-dashboard', {
                            name: dashboard.name,
                          })}
                          aria-haspopup="dialog"
                          onClick={() => setDeletedDashboardId(dashboard.id)}
                        />
                      </Tooltip>
                    </TableCell>
                  )}

                  {dashboardsList.some((dashboard) => dashboard.isSvg) && (
                    <TableCell align="center" preventClick>
                      {dashboard.isSvg ? (
                        <Tooltip text={t('dashboards.labels.svg-flag')} placement="top">
                          <FileSvgIcon
                            tabIndex={0}
                            aria-label={t('dashboards.labels.svg-flag')}
                            aria-hidden={false}
                            className="dashboardList-icon"
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip text={t('dashboards.labels.text-flag')} placement="top">
                          <FileTextIcon
                            tabIndex={0}
                            aria-label={t('dashboards.labels.text-flag')}
                            aria-hidden={false}
                            className="dashboardList-icon"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                  )}

                  {hasEditRights && (
                    <TableCell align="right" preventClick>
                      <Tooltip
                        text={t(
                          dashboard.options?.isHidden
                            ? 'dashboards.buttons.hidden'
                            : 'dashboards.buttons.visible'
                        )}
                        placement="left"
                      >
                        <Switch
                          id={`visibility-${dashboard.id}`}
                          ariaLabel={t('dashboards.buttons.visible-flag', {
                            name: dashboard.name,
                          })}
                          value={dashboard.options?.isHidden ? !dashboard.options?.isHidden : true}
                          onChange={() => dashboard.toggleVisibility()}
                        />
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </ReactSortable>
          </Table>
        ) : (
          <Alert variant="info">{t('dashboards.labels.empty-list')}</Alert>
        )}
      </PageLayout>

      <div ref={ref}></div>

      {!!deletedDashboardId && (
        <Confirm
          isOpened={!!deletedDashboardId}
          heading={t('dashboards.prompt.delete-title')}
          variant="danger"
          acceptLabel={t('dashboards.buttons.delete')}
          closeCallback={() => setDeletedDashboardId(null)}
          confirmCallback={async () => {
            await dashboards.get(deletedDashboardId).delete();
            setDeletedDashboardId(null);
          }}
        >
          <Trans
            i18nKey="dashboards.prompt.delete-description"
            values={{
              name: dashboards.get(deletedDashboardId)?.name,
            }}
            components={[<b key="dashboard-name" />]}
            shouldUnescape
          />
        </Confirm>
      )}
    </>
  );
});

export default DashboardList;
