import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import CollapseIcon from "@/assets/icons/collapse.svg";
import ExpandIcon from "@/assets/icons/expand.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Cell } from "@/components/cell";
import { ColumnsWrapper } from "@/components/columns-wrapper";
import { Confirm } from "@/components/confirm";
import { Input } from "@/components/input";
import { Tooltip } from "@/components/tooltip";
import { PageLayout } from "@/layouts/page";
import { authStore, UserRole } from "@/stores/auth";
import { type DevicesStore } from "@/stores/devices";
import { useParseHash } from "@/utils/url";
import "./styles.css";

const DevicesPage = observer(({ store }: { store: DevicesStore }) => {
  const { t } = useTranslation();
  const [deletedDeviceId, setDeletedDeviceId] = useState<string | null>(null);
  const { params } = useParseHash();
  const [search, setSearch] = useState(params.get("search") || "");
  useEffect(() => {
    setSearch(params.get("search") || "");
  }, [params]);
  const query = search.trim().toLocaleLowerCase();
  const deviceMatches = (device) =>
    (device.name + " " + device.id).toLocaleLowerCase().includes(query);
  const cellMatches = (cell) =>
    (cell.name + " " + cell.id).toLocaleLowerCase().includes(query);
  const devices = Array.from(store.filteredDevices).filter(
    ([deviceId, device]) =>
      deviceMatches(device) || store.getDeviceCells(deviceId).some(cellMatches),
  );

  if (!localStorage.getItem("foldedDevices")) {
    localStorage.setItem("foldedDevices", JSON.stringify([]));
  }

  const actions = [
    {
      title: t("devices.labels.delete"),
      action: (id: string) => setDeletedDeviceId(id),
      icon: TrashIcon,
      isPopupAction: true,
    },
  ];

  return (
    <PageLayout
      title={t("devices.title")}
      hasRights={authStore.hasRights(UserRole.Operator)}
      actions={
        <Tooltip
          text={
            store.hasOpenedDivices
              ? t("devices.labels.collapse")
              : t("devices.labels.expand")
          }
        >
          <Button
            variant="secondary"
            aria-label={
              store.hasOpenedDivices
                ? t("devices.labels.collapse")
                : t("devices.labels.expand")
            }
            icon={store.hasOpenedDivices ? <CollapseIcon /> : <ExpandIcon />}
            onClick={store.toggleDevices}
          />
        </Tooltip>
      }
    >
      <section className="devices">
        <div className="devices-searchbar">
          <Input
            value={search}
            onChange={(value) => setSearch(String(value))}
            placeholder={t("devices.labels.search")}
            ariaLabel={t("devices.labels.search")}
          />
          <span>{t("devices.labels.found", { count: devices.length })}</span>
          {authStore.hasRights(UserRole.Admin) && (
            <a href="#!/serial-config">{t("navigation.labels.device-setup")}</a>
          )}
        </div>
        {devices.length ? (
          <ColumnsWrapper
            columnClassName="devices-column"
            baseColumnWidth={376}
          >
            {devices.map(([deviceId, device]) => (
              <Card
                heading={device.name}
                id={deviceId}
                actions={actions}
                toggleBody={device.toggleDeviceVisibility}
                isBodyVisible={query ? true : device.isVisible}
                key={device.id}
              >
                {store
                  .getDeviceCells(device.id)
                  .filter((cell) => deviceMatches(device) || cellMatches(cell))
                  .map((cell) => (
                    <Cell cell={cell} key={cell.id} />
                  ))}
              </Card>
            ))}
          </ColumnsWrapper>
        ) : (
          <Alert variant="info">
            {query
              ? t("common.labels.empty-search")
              : t("devices.labels.nothing")}
          </Alert>
        )}
      </section>

      <Confirm
        isOpened={!!deletedDeviceId}
        heading={t("devices.prompt.delete-title")}
        variant="danger"
        closeCallback={() => setDeletedDeviceId(null)}
        confirmCallback={() => {
          store.deleteDevice(deletedDeviceId);
          setDeletedDeviceId(null);
        }}
      >
        <Trans
          i18nKey="devices.prompt.delete-description"
          values={{
            name: store.devices.get(deletedDeviceId)?.name,
          }}
          components={[<b key="device-name" />]}
          shouldUnescape
        />
      </Confirm>
    </PageLayout>
  );
});

export default DevicesPage;
