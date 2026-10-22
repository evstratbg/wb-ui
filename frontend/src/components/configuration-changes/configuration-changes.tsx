import { useTranslation } from 'react-i18next';
import type { ConfigChange } from '@/utils/config-diff';
import './styles.css';
export const ConfigurationChanges = ({ changes }: { changes: ConfigChange[] }) => {
  const { i18n } = useTranslation();
  const ru = i18n.language.startsWith('ru');
  const value = (item: unknown) =>
    item === undefined ? (ru ? 'Не задано' : 'Not set') : JSON.stringify(item);
  return (
    <div className="configuration-changes">
      {changes.length ? (
        <table>
          <thead>
            <tr>
              <th>{ru ? 'Параметр' : 'Parameter'}</th>
              <th>{ru ? 'Было' : 'Before'}</th>
              <th>{ru ? 'Будет' : 'After'}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.path}>
                <th scope="row">
                  <code>{change.path}</code>
                </th>
                <td>{value(change.before)}</td>
                <td>{value(change.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{ru ? 'Сохранённых изменений нет.' : 'No pending changes.'}</p>
      )}
    </div>
  );
};
