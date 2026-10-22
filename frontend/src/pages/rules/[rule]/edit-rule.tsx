import { autorun } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { CodeEditor } from '@/components/code-editor';
import { Tag } from '@/components/tag';
import { PageLayout } from '@/layouts/page';
import { authStore, UserRole } from '@/stores/auth';
import { getExtensions } from '@/stores/rules/autocomplete';
import { useAsyncAction } from '@/utils/async-action';
import { getPathname } from '@/utils/url';
import type { RulePageProps } from './types';
import { uiStore } from '@/stores/ui';
import { RuleDiagnostics } from './rule-diagnostics';
import './styles.css';

const EditRulePage = observer(({ rulesStore, devicesStore, logsProxy, onDirtyChange }: RulePageProps) => {
  const { t, i18n } = useTranslation();
  const { rule } = rulesStore;
  const [isLoading, setIsLoading] = useState(true);
  const [pageLoadError, setPageLoadError] = useState(null);
  const [saveError, setSaveError] = useState('');
    const pathName = getPathname();
    const [focus, setFocus] = useState<{ line?: number; request: number }>({
      request: 0,
    });
    useEffect(() => {
      const dispose = autorun(() => onDirtyChange?.(rulesStore.isDirty));
      return () => {
        dispose();
        onDirtyChange?.(false);
      };
    }, [rulesStore]);
  const [isEditingTitle, setIsEditingTitle] = useState(pathName === 'new');

  const errors = useMemo(() => {
    if (pageLoadError) {
      return [{
            variant: 'danger',
            text: i18n.language.startsWith('ru')
              ? 'Не удалось загрузить правило. Проверьте соединение и откройте его повторно.'
              : 'Could not load the rule. Check the connection and reopen it.',
          },
        ];
      } else if (saveError) {
        return [{ variant: 'danger', text: saveError }];
    } else if (rule.error) {
      return [{ variant: 'danger', text: rule.error.message }];
    } else {
      return [];
    }
  }, [pageLoadError, rule.error, saveError]);

  useEffect(() => {
      if (!authStore.hasRights(UserRole.Admin)) {
        setIsLoading(false);
        return;
      }
      if (pathName === 'new') {
      rulesStore.resetRule();
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    rulesStore.load(pathName)
      .then(() => {
        setIsLoading(false);
      })
      .catch(() => {
          setPageLoadError(true);
          setIsLoading(false);
        });
  }, []);

  const [save, isSaving] = useAsyncAction(async () => {
      if (
        !authStore.hasRights(UserRole.Admin) ||
        !uiStore.isConnected ||
        isLoading ||
        pageLoadError
      )
        return;
      setSaveError('');
      try {
    const initRuleName = rule.initName;
    if (rule.initName !== rule.name) {
      await rulesStore.checkIsNameUnique(rule.name);
    }
    const savedRuleName = await rulesStore.save(rule);

    if (rule.error) return;

        if (pathName === 'new') {
          onDirtyChange?.(false);
          return location.replace(`/#!/rules/edit/${savedRuleName}`);
        } else if (initRuleName !== rule.name) {
          const path = await rulesStore.rename(initRuleName, rule.name);
          onDirtyChange?.(false);
          return location.replace(`/#!/rules/edit/${path}`);
        }
        setIsEditingTitle(false);
      } catch (error) {
        setSaveError(String(error.message || error));
        onDirtyChange?.(rulesStore.isDirty);
      }
    });

    return (
      <PageLayout
        title={pageLoadError ? pathName : rule.name}
        hasRights={authStore.hasRights(UserRole.Admin)}
        isLoading={isLoading}
        isEditingTitle={isEditingTitle && !pageLoadError}
        editingTitlePlaceholder={t('rules.labels.title-placeholder')}
        errors={errors}
        titleArea={!rule.enabled && <Tag variant="gray">{t('rules.labels.inactive')}</Tag>}
        actions={
          <Button
            label={t('rules.buttons.save')}
            disabled={
              !!pageLoadError ||
              !rule.name ||
              !rulesStore.isDirty ||
              !uiStore.isConnected ||
              isSaving
            }
            isLoading={isSaving}
            onClick={save}
          />
        }
        stickyHeader
        onTitleChange={(title) => {
          if (!isSaving && uiStore.isConnected) rulesStore.setRuleName(title);
        }}
        onTitleEditEnable={() => {
          if (!isSaving && uiStore.isConnected) setIsEditingTitle(!isEditingTitle);
        }}
      >
        {!pageLoadError && (
          <div className="editRule-workspace">
            <div className="editRule-container">
              <CodeEditor
                text={rule.content}
                errorLines={
              rulesStore.errorSource?.content === rule.content && rule.error?.errorLine ? [rule.error.errorLine] : null
                }
                isReadOnly={isSaving || !uiStore.isConnected}
                focusLine={focus.line}
                focusRequest={focus.request}
                autoFocus={pathName !== 'new'}
                extensions={getExtensions(devicesStore)}
                onChange={(value) => rulesStore.setRule(value)}
                onSave={() => {
                  if (!isSaving && uiStore.isConnected) save();
                }}
              />
            </div>
            <RuleDiagnostics
              rulesStore={rulesStore}
              logsProxy={logsProxy}
              onLine={(line) => setFocus({ line, request: focus.request + 1 })}
            />
          </div>
        )}
      </PageLayout>
    );
  }
);

export default EditRulePage;
