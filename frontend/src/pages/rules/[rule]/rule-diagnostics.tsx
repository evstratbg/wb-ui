import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { uiStore } from '@/stores/ui';

export const ruleLogMatches = (payload: string, path: string) => {
  if (!path) return false;
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s\\[(/:])${escaped}(?=$|[\\s\\]):,])`).test(payload);
};

export const RuleDiagnostics = observer(({ rulesStore, logsProxy, onLine }: any) => {
  const { i18n } = useTranslation();
  const text = (ru: string, en: string) => (i18n.language.startsWith('ru') ? ru : en);
  const { rule } = rulesStore;
  const path = rule.initName || rule.name;
  const [all, setAll] = useState(false);
  const [journal, setJournal] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    setJournal([]);
    setLoaded(false);
    setLoading(false);
    setError(false);
    request.current++;
    return () => {
      request.current++;
    };
  }, [path]);
  const live = rulesStore.logs
    .filter((entry) => all || ruleLogMatches(entry.payload, path))
    .slice(-80);
  const line = rule.error?.errorLine || rule.error?.traceback?.[0]?.line;
  const errorSource = rulesStore.errorSource;
  const sourceLines = (errorSource?.content || '').split('\n');
  const sourceMatches = !!errorSource && rule.content === errorSource.content;
  const load = async () => {
    const id = ++request.current;
    setLoading(true);
    setError(false);
    let timeout: ReturnType<typeof setTimeout>;
    try {
      const entries = await Promise.race([
        logsProxy.Load({
          service: 'wb-rules.service',
          limit: 20,
          ...(all ? {} : { pattern: path, regex: false, 'case-sensitive': true }),
        }),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Journal timeout')), 20000);
        }),
      ]);
      if (!Array.isArray(entries)) throw new Error('Unexpected journal response');
      if (id === request.current) {
        setJournal(entries.slice(0, 20));
        setLoaded(true);
      }
    } catch {
      if (id === request.current) setError(true);
    } finally {
      clearTimeout(timeout);
      if (id === request.current) setLoading(false);
    }
  };
  return (
    <aside
      className="rule-diagnostics"
      aria-label={text('Диагностика правила', 'Rule diagnostics')}
    >
      <h2>{text('Диагностика', 'Diagnostics')}</h2>
      {rule.error ? (
        <>
          <Alert variant="danger">{rule.error.message}</Alert>
          <p>
            {errorSource?.origin === 'submitted'
              ? text(
                  'Ошибка относится к отправленному на проверку коду. Успешное сохранение не подтверждено.',
                  'The error refers to submitted code. Successful persistence is not confirmed.'
                )
              : text(
                  'Ошибка относится к коду, загруженному с контроллера.',
                  'The error refers to code loaded from the controller.'
                )}
          </p>
          {line > 0 && (
            <>
              <Button
                variant="secondary"
                label={text(`К строке ${line}`, `Go to line ${line}`)}
                disabled={!sourceMatches}
                onClick={() => onLine(line)}
              />
              {!sourceMatches && (
                <p>
                  {text(
                    'Черновик отличается от кода с ошибкой; номера строк могли измениться.',
                    'The draft differs from the source of the error; line numbers may have changed.'
                  )}
                </p>
              )}
              <pre className="rule-errorContext">
                {sourceLines
                  .slice(Math.max(0, line - 3), line + 2)
                  .map((value, index) => `${Math.max(1, line - 2) + index}  ${value}`)
                  .join('\n')}
              </pre>
            </>
          )}
          {!!rule.error.traceback?.length && (
            <details>
              <summary>{text('Стек ошибки', 'Error traceback')}</summary>
              <ol>
                {rule.error.traceback.map((frame, index) => (
                  <li key={index}>
                    {frame.name} · {frame.line}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      ) : (
        <p>
          {text(
            'Backend не сообщает об ошибке сохранённого правила.',
            'The backend reports no saved-rule error.'
          )}
        </p>
      )}
      <div className="rule-logScope">
        <label>
          {text('Сообщения WB Rules', 'WB Rules messages')}
          <select
            value={all ? 'all' : 'file'}
            onChange={(event) => {
              request.current++;
              setLoading(false);
              setLoaded(false);
              setJournal([]);
              setAll(event.target.value === 'all');
            }}
          >
            <option value="file">
              {text('С упоминанием этого файла', 'Mentioning this file')}
            </option>
            <option value="all">
              {text('Общий журнал, все правила', 'General log, all rules')}
            </option>
          </select>
        </label>
      </div>
      <p>
        {text(
          'Сообщения без имени файла могут относиться к любому правилу. Debug не включается автоматически.',
          'Messages without a file name may belong to any rule. Debug is not enabled automatically.'
        )}
      </p>
      <h3>{text('Живые сообщения', 'Live messages')}</h3>
      {live.length ? (
        <ol className="rule-logEntries" role="log">
          {live.map((entry, index) => (
            <li key={`${entry.time}-${index}`}>
              <small>
                {new Date(entry.time).toLocaleTimeString(i18n.language)} · {entry.level}
              </small>
              <pre>{entry.payload}</pre>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          {text(
            'Подходящих сообщений ещё нет. Выберите общий журнал или загрузите сохранённые записи.',
            'No matching messages yet. Choose the general log or load saved entries.'
          )}
        </p>
      )}
      <Button
        variant="secondary"
        label={text('Загрузить последние 20 записей', 'Load latest 20 entries')}
        disabled={!uiStore.isConnected || !logsProxy || loading || !path}
        isLoading={loading}
        onClick={load}
      />
      {error && (
        <Alert variant="warn">
          {text(
            'Журнал недоступен. Проверьте связь и повторите загрузку.',
            'Journal unavailable. Check the connection and retry.'
          )}
        </Alert>
      )}
      {loaded && (
        <>
          <p>
            {text(`Получено записей: ${journal.length}.`, `Entries received: ${journal.length}.`)}
          </p>
          <ol className="rule-logEntries">
            {journal.map((entry, index) => (
              <li key={entry.cursor || index}>
                <small>{entry.time && new Date(entry.time).toLocaleString(i18n.language)}</small>
                <pre>{entry.msg}</pre>
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
});
