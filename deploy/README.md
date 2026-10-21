# Установка на Wiren Board

Дополнительный интерфейс работает на **HTTP-порту 8080**, используя существующий backend контроллера на порту 80. Штатный пакет и интерфейс на порту 80 сохраняются. Рекомендуется установить готовую статическую сборку: Node.js, npm и Git для этого не нужны.

Основа проекта — `wirenboard/homeui` версии `v2.208.1-wb100`, коммит `0546d10e7ade2894baa5a828549900b708ca52a8`. Установка проверена с backend этой версии; совместимость с другими версиями отдельно не подтверждена.

## Перед установкой

- На компьютере доступен SSH; для переноса сборки без интернета на контроллере нужен также SCP.
- Есть SSH-доступ `root` к контроллеру.
- На контроллере работают штатные nginx и backend на порту 80, доступны `systemctl`, `ss`, `curl`, `tar` и `sha256sum`.
- Порт 8080 свободен, в `/mnt/data` достаточно места для staging и новой копии сборки. Предыдущие релизы автоматически не удаляются.

В командах ниже замените `wirenboard.local` на имя или IP своего контроллера.

## Готовая сборка — рекомендуемый способ

Доступен **[v0.1.0 · экспериментальный prerelease](https://github.com/evstratbg/wb-ui/releases/tag/v0.1.0)**: [wb-ui-static.tar.gz](https://github.com/evstratbg/wb-ui/releases/download/v0.1.0/wb-ui-static.tar.gz) и [SHA256SUMS](https://github.com/evstratbg/wb-ui/releases/download/v0.1.0/SHA256SUMS). Публичные файлы релиза скачиваются без входа в GitHub. Архив содержит UI, установщик, nginx-конфиг, скрипт отключения, лицензии и `BUILD_INFO.txt` с ревизией исходников.

На компьютере откройте SSH-сессию:

```sh
ssh root@wirenboard.local
```

В открытой сессии **на контроллере** выполните:

```sh
set -eu
VERSION=v0.1.0
mkdir -p /mnt/data/wb-ui-full-staging
cd /mnt/data/wb-ui-full-staging

RELEASE_URL="https://github.com/evstratbg/wb-ui/releases/download/$VERSION"
curl --fail --location --retry 3 -o wb-ui-static.tar.gz \
  "$RELEASE_URL/wb-ui-static.tar.gz"
curl --fail --location --retry 3 -o SHA256SUMS \
  "$RELEASE_URL/SHA256SUMS"

sha256sum -c SHA256SUMS
tar -xzf wb-ui-static.tar.gz
sh install-on-device.sh "$PWD"
```

Здесь контроллеру нужен доступ к GitHub по HTTPS. Проверка SHA-256 выполняется до распаковки; при ошибке скачивания или проверки блок завершается и установщик не запускается. Сборка не требует установки зависимостей на контроллере.

## Если контроллер без интернета

Скачайте те же два файла **на компьютере**. Пример использует `shasum`, доступный в macOS; в Linux вместо `shasum -a 256 -c SHA256SUMS` можно выполнить `sha256sum -c SHA256SUMS`.

```sh
set -eu
VERSION=v0.1.0
mkdir -p "wb-ui-$VERSION"
cd "wb-ui-$VERSION"

RELEASE_URL="https://github.com/evstratbg/wb-ui/releases/download/$VERSION"
curl --fail --location --retry 3 -o wb-ui-static.tar.gz \
  "$RELEASE_URL/wb-ui-static.tar.gz"
curl --fail --location --retry 3 -o SHA256SUMS \
  "$RELEASE_URL/SHA256SUMS"
shasum -a 256 -c SHA256SUMS

WB_HOST=wirenboard.local
ssh "root@${WB_HOST}" 'mkdir -p /mnt/data/wb-ui-full-staging'
scp wb-ui-static.tar.gz SHA256SUMS \
  "root@${WB_HOST}:/mnt/data/wb-ui-full-staging/"
ssh "root@${WB_HOST}"
```

После подключения выполните **на контроллере** повторную проверку перед установкой:

```sh
set -eu
cd /mnt/data/wb-ui-full-staging
sha256sum -c SHA256SUMS
tar -xzf wb-ui-static.tar.gz
sh install-on-device.sh "$PWD"
```

## Альтернатива: сборка из исходников

Только для этого способа на компьютере нужны Git, Node.js 22 и npm, а также SSH и SCP. Если используете nvm, версия Node указана в `.nvmrc`. Команды выполняются **на компьютере**:

```sh
git clone https://github.com/evstratbg/wb-ui.git
cd wb-ui
WB_HOST=wirenboard.local

cd frontend
cp .env.concept .env
npm ci
npm test -- --runInBand
npm run build

ssh "root@${WB_HOST}" 'mkdir -p /mnt/data/wb-ui-full-staging'
scp -r dist ../deploy/wb-ui.conf ../deploy/install-on-device.sh ../deploy/remove-on-device.sh \
  "root@${WB_HOST}:/mnt/data/wb-ui-full-staging/"
ssh "root@${WB_HOST}" \
  'sh /mnt/data/wb-ui-full-staging/install-on-device.sh /mnt/data/wb-ui-full-staging'
```

При сборке профиль `.env.concept` копируется в `.env`, потому что существующий webpack-конфиг загружает `.env` с приоритетом над переменными окружения. Если `.env` уже существует, сначала сохраните нужные значения.

## После установки

Для любого способа откройте `http://<controller>:8080/#!/overview`, подставив свой адрес вместо `<controller>`. Корневой маршрут `http://<controller>:8080/#!/` открывает настроенную на контроллере домашнюю панель.

Используйте то же имя хоста, что и для штатного интерфейса: cookies не разделяются по портам, поэтому существующая сессия может использоваться и на 8080. При необходимости войдите через штатную форму нового интерфейса. Переход с имени хоста на IP создаёт другой контекст cookies. Пароли в сборку не включаются.

Готовая сборка использует профиль `.env.concept` с `DISABLE_HTTPS_CHECK=true`. Это отключает автоматический переход фронтенда на HTTPS-порт 443, который увёл бы пользователя с дополнительного интерфейса. Настройки HTTPS самого контроллера при этом не меняются. Приложенный nginx-конфиг обслуживает HTTP на 8080; TLS для этого порта он не настраивает.

Готовые архивы GitHub Releases сохраняются как файлы релиза; промежуточный артефакт `wb-ui-static` в GitHub Actions хранится 14 дней. Сборка по тегу `v*` публикуется после тестов, production build и проверок deploy-скриптов. Автоматической установки на контроллер нет.

## Что меняет установщик

| Путь на контроллере | Назначение |
| --- | --- |
| `/mnt/data/wb-ui-full-staging` | Загруженные файлы для установки и скрипт отключения |
| `/mnt/data/wb-ui/releases/<timestamp>` | Отдельная копия каждой установленной сборки |
| `/mnt/data/wb-ui/current` | Символическая ссылка на активный релиз |
| `/mnt/data/wb-ui/previous-release` | Путь предыдущего релиза, если он был |
| `/mnt/data/wb-ui/nginx.previous.conf` | Предыдущий конфиг дополнительного интерфейса, если он был |
| `/etc/nginx/conf.d/wb-ui.conf` | Дополнительный сервер nginx на 8080 |

Скрипт отказывается заменять чужой `wb-ui.conf` и проверяет занятость порта при первой установке. После копирования сборки он переключает ссылку `current`, устанавливает конфиг, выполняет `nginx -t` и перезагружает nginx. Если проверка или перезагрузка nginx завершается ошибкой, скрипт восстанавливает прежние конфиг и ссылку и пытается перезагрузить восстановленную конфигурацию.

Затем выполняются HTTP-проверки `/` и `/device/info` с повторными попытками. Их ошибка завершает установку с ненулевым кодом, **но не запускает автоматический откат**. В этом случае проверьте вывод команды, `systemctl status nginx` и доступность штатного backend на порту 80.

Для обновления укажите нужную опубликованную версию в `VERSION` и повторите скачивание, проверку и установку; при сборке из исходников повторите сборку и установку. Каждая успешная установка сохраняет новый релиз; данные и настройки контроллера остаются общими для обоих интерфейсов. Изменения, сохранённые через новый интерфейс, применяются к реальному контроллеру.

## Подключение к backend

nginx проксирует `/mqtt`, `/auth/`, `/device/`, `/api/`, `/ui/`, `/fwupdate/`, `/uploads/` и `/diag/` через штатный сервер на `127.0.0.1:80`. Проверки сессии, ролей и MQTT ACL остаются на существующем backend. Новый MQTT listener или отдельное хранилище пользователей не создаются.

Встроенные `/images/` берутся из сборки; отсутствующие изображения запрашиваются у штатного сервера. Загрузка прошивки сохраняет лимит 1000 MiB и потоковую передачу без буферизации прокси. CSP разрешает `unsafe-eval` для штатных выражений SVG-привязок и условий редакторов, а также существующие внешние MQTT-подключения, изображения и Blob workers.

## Возврат к предыдущей сборке

Если уже был установлен предыдущий релиз:

```sh
WB_HOST=wirenboard.local

ssh "root@${WB_HOST}" 'set -eu
cd /mnt/data/wb-ui
test -s previous-release
previous=$(cat previous-release)
test -d "$previous"
nginx -t
ln -s "$previous" current.manual-rollback
mv -Tf current.manual-rollback current
systemctl reload nginx'
```

После отката обновите страницу браузера. Команда переключает только статическую сборку; конфигурация, правила, пользователи и остальные данные контроллера не откатываются.

## Отключение дополнительного интерфейса

```sh
WB_HOST=wirenboard.local

ssh "root@${WB_HOST}" \
  'sh /mnt/data/wb-ui-full-staging/remove-on-device.sh'
```

Скрипт отключает конфиг сервера на 8080 и перезагружает nginx. При ошибке проверки или перезагрузки он восстанавливает конфиг и пытается загрузить его снова. Файлы релизов сохраняются, штатный интерфейс на порту 80 продолжает работать. Для повторного включения запустите установщик.

## Объём проверки

См. [проверку штатных возможностей](CAPABILITIES.md). Проверялись отображение редакторов, навигация и чтение реальных данных. Открытие страницы обновления прошивки, сети или управления оборудованием не означает, что соответствующая операция была выполнена: физические выходы, прошивки, сеть и рабочие настройки при проверке не изменялись.
