import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { type Option } from '@/components/dropdown';
import { BooleanField, FormButtonGroup, FormFieldGroup, OptionsField, StringField,
} from '@/components/form';
import { authStore, UserRole } from '@/stores/auth';
import { uiStore } from '@/stores/ui';
import { type CommonSettingsProps } from '../types';

const CommonSettings = observer(({ onChangeLanguage, dashboardsStore }: CommonSettingsProps) => {
  const { t } = useTranslation();
  const simple = uiStore.workspaceMode === 'home' || !authStore.hasRights(UserRole.Operator);
  const [showSystemDevices, setShowSystemDevices] = useState((localStorage['show-system-devices'] || 'no') === 'yes');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [defaultDashboardId, setDefaultDashboardId] = useState('');
  const [description, setDescription] = useState('');
  const [isShowWidgetsPage, setIsShowWidgetsPage] = useState(false);
  const options = dashboardsStore.dashboardsList
    .filter((dashboard) => !dashboard.options.isHidden)
    .map((dashboard) => ({ label: dashboard.name, value: dashboard.id }));

  useEffect(() => {
    setDescription(dashboardsStore.description ?? '');
    setDefaultDashboardId(dashboardsStore.defaultDashboardId ?? '');
    setIsShowWidgetsPage(dashboardsStore.isShowWidgetsPage ?? false);
  }, [dashboardsStore.description, dashboardsStore.defaultDashboardId, dashboardsStore.isShowWidgetsPage,
  ]);

  const languageOptions: Option<string>[] = [
    { label: 'English', value: 'en' },
    { label: 'Русский', value: 'ru' },
  ];

  const applyHandler = () => {
    if (!simple) localStorage.setItem('show-system-devices', showSystemDevices ? 'yes' : 'no');
    localStorage.setItem('language', language);
    onChangeLanguage(language);
    if (simple) return;
    dashboardsStore.setDefaultDashboardId(defaultDashboardId);
    dashboardsStore.setDescription(description);
    dashboardsStore.setIsShowWidgetsPage(isShowWidgetsPage);
  };

  return (
    <FormFieldGroup heading={t('web-ui-settings.labels.common-settings')}>
      <OptionsField
        title={t('web-ui-settings.labels.language')}
        value={language}
        options={languageOptions}
        onChange={setLanguage}
      />

      {!simple && authStore.hasRights(UserRole.Operator) && (
        <StringField
          title={t('web-ui-settings.labels.name')}
          description={t('web-ui-settings.labels.name-description')}
          value={description}
          onChange={(val: string) => setDescription(val)}
        />
      )}

      {!simple && (
        <>
          <OptionsField
        title={t('web-ui-settings.labels.default-dashboard')}
        value={defaultDashboardId}
        options={options}
        isDisabled={dashboardsStore.isLoading}
        onChange={setDefaultDashboardId}
      />

      <BooleanField
        title={t('web-ui-settings.labels.show-widgets-page')}
        value={isShowWidgetsPage}
        onChange={setIsShowWidgetsPage}
      />

      <BooleanField
        title={t('web-ui-settings.labels.show-system-devices')}
        value={showSystemDevices}
        onChange={setShowSystemDevices}
      />
        </>
      )}
      <FormButtonGroup>
        <Button
          label={t('common.buttons.apply')}
          onClick={applyHandler}
        />
      </FormButtonGroup>
    </FormFieldGroup>
  );
});

export default CommonSettings;
