import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { ConfigurationChanges } from '@/components/configuration-changes/configuration-changes';
import { uiStore } from '@/stores/ui';
import './channel-polling.css';

export const ChannelPolling = observer(
  ({ installer, deviceId, controlId, name, onClose, onSettings }: any) => {
    const { i18n } = useTranslation();
    const text = (ru: string, en: string) => (i18n.language.startsWith('ru') ? ru : en);
    const [loading, setLoading] = useState(true);
    const [reviewed, setReviewed] = useState(false);
    const [loadError, setLoadError] = useState(false);
    useEffect(() => {
      let active = true;
      Promise.resolve(installer.openDevice(deviceId))
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [installer, deviceId, controlId]);
    const channel = installer.getPollingChannel(deviceId, controlId);
    const match = installer.getDeviceMatch(deviceId);
    const locked =
      !uiStore.isConnected ||
      installer.isSaving ||
      !match?.enabled ||
      !channel?.isEnabledByCondition ||
      !channel?.isSupportedByFirmware;
    const labels = {
      'do not read': text('Не опрашивать', 'Do not read'),
      'in queue order': text('В порядке очереди', 'In queue order'),
      '200 ms': '200 ms',
      '100 ms': '100 ms',
      'custom period': text('Задать период', 'Custom period'),
      'using Fast Modbus': text('По Быстрому Modbus', 'Using Fast Modbus'),
    };
    return (
      <Dialog
        isOpened
        heading={text(`Опрос: ${name}`, `Polling: ${name}`)}
        width={640}
        onClose={installer.isSaving ? undefined : onClose}
      >
        <div className="channel-polling">
          <p>
            <code>
              {deviceId}/{controlId}
            </code>
          </p>
          <p>
            {match?.portName} · {text('адрес', 'address')} {match?.address}
          </p>
          {loadError && (
            <Alert variant="warn">
              {text(
                'Не удалось получить шаблон. Откройте все настройки устройства и повторите загрузку.',
                'Could not load the template. Open all device settings and retry.'
              )}
            </Alert>
          )}
          {loading ? (
            <p role="status">{text('Загрузка шаблона…', 'Loading template…')}</p>
          ) : !channel ? (
            <Alert variant="info">
              {text(
                'В шаблоне нет однозначного соответствия этому MQTT-каналу. Откройте все настройки устройства; соответствие по переведённому имени не угадывается.',
                'The template has no unique match for this MQTT channel. Open all device settings; translated names are not used to guess a match.'
              )}
            </Alert>
          ) : (
            <>
              {locked && !installer.isSaving && (
                <Alert variant="warn">
                  {text(
                    'Редактирование недоступно: проверьте связь, включение устройства, условия шаблона и поддержку прошивкой.',
                    'Editing unavailable: check connection, enabled state, template conditions and firmware support.'
                  )}
                </Alert>
              )}
              <fieldset disabled={locked}>
                <label>
                  {text('Режим опроса', 'Polling mode')}
                  <select
                    value={String(channel.mode.value)}
                    onChange={(event) => {
                      channel.mode.setValue(event.target.value);
                      setReviewed(false);
                    }}
                  >
                    {channel.mode.enumOptions.map((option) => (
                      <option key={option.value} value={String(option.value)}>
                        {labels[String(option.value)] || option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {channel.hasCustomPeriod && (
                  <label>
                    {text('Период, мс', 'Period, ms')}
                    <input
                      type="number"
                      value={channel.period.editString}
                      min={channel.period.schema.minimum}
                      max={channel.period.schema.maximum}
                      step="1"
                      onChange={(event) => {
                        channel.period.setEditString(event.target.value);
                        setReviewed(false);
                      }}
                    />
                  </label>
                )}
                {channel.hasErrors && (
                  <p role="alert">
                    {text(
                      'Проверьте режим и целочисленный период в пределах допустимого диапазона.',
                      'Check the mode and enter an integer period within the allowed range.'
                    )}
                  </p>
                )}
              </fieldset>
              <p>
                {text(
                  'Изменения остаются в общем черновике. Сохранение применяется ко всей конфигурации wb-mqtt-serial.',
                  'Changes remain in the shared draft. Saving applies the entire wb-mqtt-serial configuration.'
                )}
              </p>
              {reviewed && <ConfigurationChanges changes={installer.pendingChanges} />}
              {installer.error && <Alert variant="danger">{installer.error}</Alert>}
              {installer.saved && !installer.isDirty && (
                <Alert variant="success">
                  {text('Конфигурация сохранена.', 'Configuration saved.')}
                </Alert>
              )}
              <Button
                label={
                  reviewed
                    ? text('Сохранить всю конфигурацию', 'Save entire configuration')
                    : text('Проверить изменения', 'Review changes')
                }
                disabled={locked || !installer.allowSave}
                isLoading={installer.isSaving}
                onClick={async () => {
                  if (!reviewed) setReviewed(true);
                  else await installer.save();
                }}
              />
            </>
          )}
          <div className="channel-polling-footer">
            <Button
              variant="secondary"
              label={text('Все настройки устройства', 'All device settings')}
              disabled={installer.isSaving}
              onClick={onSettings}
            />
            <Button
              variant="unaccented"
              label={text('Закрыть', 'Close')}
              disabled={installer.isSaving}
              onClick={onClose}
            />
          </div>
        </div>
      </Dialog>
    );
  }
);
