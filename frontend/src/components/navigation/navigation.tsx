import classNames from "classnames";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "react-responsive";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";
import ConsoleIcon from "@/assets/icons/console.svg";
import LogoutIcon from "@/assets/icons/logout.svg";
import MenuIcon from "@/assets/icons/menu.svg";
import SitemapIcon from "@/assets/icons/sitemap.svg";
import {
  APP_NAME,
  HIDE_COMPACT_MENU,
  LOGO,
  LOGO_COMPACT,
} from "@/common/constants";
import { MenuItem } from "@/components/navigation/components/menu-item";
import { UserRole, authStore } from "@/stores/auth";
import { uiStore } from "@/stores/ui";
import { useParseHash } from "@/utils/url";
import { type NavigationProps } from "./types";
import "./styles.css";
import "./concept-shell.css";

export const Navigation = observer(
  ({ dashboardsStore, toggleConsole }: NavigationProps) => {
    const { t, i18n } = useTranslation();
    const { id, page, params } = useParseHash();
    const isMobile = useMediaQuery({ maxWidth: 768 });
    const {
      isAuthenticated,
      isAutologin,
      areUsersConfigured,
      hasRights,
      logout,
    } = authStore;
    const [isMenuCompact, setIsMenuCompact] = useState(
      localStorage.getItem("isMenuCompact") === "true",
    );
    const [openedSubmenus, setOpenedSubmenus] = useState<string[]>([]);
    const [isMenuFocused, setIsMenuFocused] = useState(true);
    const [isMobileMenuOpened, setIsMobileMenuOpened] = useState(false);
    const [activePopup, setActivePopup] = useState<string | null>(null);
    const [deviceInfo, setDeviceInfo] = useState<{
      sn?: string;
      release_name?: string;
    }>({});
    const [query, setQuery] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const { menuItems, isConsoleVisible, toggleConsoleVisibility } = uiStore;
    const ru = i18n.language?.startsWith("ru");

    useEffect(() => {
      uiStore.buildMenu(
        dashboardsStore.dashboardsList,
        dashboardsStore.isShowWidgetsPage,
        params,
      );
    }, [
      dashboardsStore.dashboardsList,
      dashboardsStore.isShowWidgetsPage,
      params,
      i18n.language,
      isAuthenticated,
    ]);

    useEffect(() => {
      const controller = new AbortController();
      fetch("/device/info", { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : {}))
        .then(setDeviceInfo)
        .catch(() => {});
      return () => controller.abort();
    }, []);

    useEffect(() => {
      const listener = (event: KeyboardEvent) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key === "k" &&
          !isMobile
        ) {
          event.preventDefault();
          searchRef.current?.focus();
        }
        if (event.key === "Escape") setIsMobileMenuOpened(false);
      };
      window.addEventListener("keydown", listener);
      return () => window.removeEventListener("keydown", listener);
    }, [isMobile]);

    useEffect(() => {
      const parent = menuItems.find((item) =>
        item.children?.some(
          (child) =>
            child.url === page || (id && child.url === `${page}/${id}`),
        ),
      );
      if (parent?.id)
        setOpenedSubmenus((prev) => Array.from(new Set([...prev, parent.id])));
      setIsMobileMenuOpened(false);
    }, [menuItems, page, id]);

    useEffect(() => {
      setIsMobileMenuOpened(false);
      setIsMenuCompact(
        isMobile ? false : localStorage.getItem("isMenuCompact") === "true",
      );
    }, [isMobile]);

    const toggleNavigation = () => {
      const next = !isMenuCompact;
      setIsMenuCompact(next);
      localStorage.setItem("isMenuCompact", String(next));
    };
    const handleDebugClick = () => {
      toggleConsole();
      toggleConsoleVisibility();
      setIsMobileMenuOpened(false);
    };
    const candidates = menuItems.flatMap((item) => [
      item,
      ...(item.children || []),
    ]);
    const currentPath = [page, id].filter(Boolean).join("/");
    const current = candidates
      .filter(
        (item) =>
          item.url &&
          (currentPath === item.url || currentPath.startsWith(item.url + "/")),
      )
      .sort((a, b) => b.url.length - a.url.length)[0];
    const currentTitle = current
      ? t(current.label)
      : t("navigation.labels.overview");
    const serial =
      deviceInfo.sn ||
      location.hostname.replace(/^wirenboard-/i, "").toUpperCase();

    if (
      !isAuthenticated ||
      params.has("hmi") ||
      location.hash.startsWith("#!/login")
    )
      return null;

    return (
      <>
        <nav
          className={classNames("navigation", {
            "navigation-compact": isMenuCompact,
          })}
          aria-label={ru ? "Основная навигация" : "Main navigation"}
        >
          <div className="navigation-header">
            <button
              className="navigation-mobileButton"
              aria-label={t("navigation.buttons.open-mobile")}
              aria-expanded={isMobileMenuOpened}
              onClick={() => setIsMobileMenuOpened(!isMobileMenuOpened)}
            >
              <MenuIcon />
            </button>
            <div
              className={
                isMenuCompact
                  ? "navigation-logoWrapperCompact"
                  : "navigation-logoWrapper"
              }
            >
              <a
                href="#!/overview"
                aria-label={t("navigation.labels.home")}
                className="navigation-logoLink"
                draggable={false}
              >
                <img
                  src={LOGO_COMPACT}
                  className={classNames("navigation-logoCompact", {
                    "navigation-logoHidden": !isMenuCompact,
                  })}
                  alt={APP_NAME}
                />
                <img
                  src={LOGO}
                  className={classNames("navigation-logo", {
                    "navigation-logoHidden": isMenuCompact,
                  })}
                  alt={APP_NAME}
                />
              </a>
            </div>
            <span
              className={classNames("shell-mobile-status", {
                "is-connected": uiStore.isConnected,
              })}
            >
              <i />
              {t(
                uiStore.isConnected
                  ? "navigation.connection.active"
                  : "navigation.connection.inactive",
              )}
            </span>
          </div>
          <div
            className="shell-controller"
            title={dashboardsStore.description || serial}
          >
            <span className="shell-controller-icon">
              <SitemapIcon />
            </span>
            {!isMenuCompact && (
              <div>
                <strong>
                  {dashboardsStore.description ||
                    (ru ? "Мой контроллер" : "My controller")}
                </strong>
                <span>{serial}</span>
              </div>
            )}
            <i
              className={classNames("shell-status-dot", {
                "is-connected": uiStore.isConnected,
              })}
            />
          </div>
          {!HIDE_COMPACT_MENU && (
            <button
              className={classNames("navigation-toggle", {
                "navigation-toggleIconRotated": !isMenuCompact,
              })}
              aria-label={t(
                isMenuCompact
                  ? "navigation.buttons.compact-off"
                  : "navigation.buttons.compact-on",
              )}
              onClick={toggleNavigation}
            >
              <ChevronRightIcon className="navigation-toggleIcon" />
            </button>
          )}
          <div
            className={classNames("navigation-container", {
              "navigation-containerMobile": isMobileMenuOpened,
            })}
          >
            <ul className="navigation-list">
              {menuItems.map((item, i) => (
                <MenuItem
                  item={item}
                  isMenuCompact={isMenuCompact}
                  openedSubmenus={openedSubmenus}
                  setOpenedSubmenus={setOpenedSubmenus}
                  id={id}
                  page={page}
                  setActivePopup={setActivePopup}
                  activePopup={activePopup}
                  closeMobileMenu={() => setIsMobileMenuOpened(false)}
                  key={item.id || item.url || i}
                  isMenuFocused={isMenuFocused}
                  setIsMenuFocused={setIsMenuFocused}
                />
              ))}
            </ul>
            {!params.has("fullscreen") && (
              <div className="navigation-actions shell-actions">
                {!isMenuCompact && (
                  <div className="shell-version">
                    <span>Wiren Board · UI concept</span>
                    <small>{deviceInfo.release_name || "2.208.1"}</small>
                  </div>
                )}
                {hasRights(UserRole.Admin) && (
                  <button
                    className="menuItem-link"
                    aria-label={t("navigation.buttons.debug")}
                    aria-expanded={isConsoleVisible}
                    onClick={handleDebugClick}
                  >
                    <ConsoleIcon className="menuItem-icon" />
                    {!isMenuCompact && t("navigation.buttons.debug")}
                  </button>
                )}
                {areUsersConfigured && (
                  <button
                    className="menuItem-link navigation-logout"
                    aria-label={t(
                      isAutologin
                        ? "navigation.buttons.switch-user"
                        : "navigation.buttons.logout",
                    )}
                    onClick={() => {
                      setIsMobileMenuOpened(false);
                      logout();
                    }}
                  >
                    <LogoutIcon className="menuItem-icon" />
                    {!isMenuCompact &&
                      t(
                        isAutologin
                          ? "navigation.buttons.switch-user"
                          : "navigation.buttons.logout",
                      )}
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
        <div
          className={classNames("shell-topbar", {
            "shell-topbar-compact": isMenuCompact,
          })}
        >
          <div className="shell-breadcrumb">
            <a href="#!/overview">{ru ? "Контроллер" : "Controller"}</a>
            <ChevronRightIcon />
            <span>{currentTitle}</span>
          </div>
          {hasRights(UserRole.Operator) && (
            <form
              className="shell-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                location.hash = "!/devices?search=" + encodeURIComponent(query);
              }}
            >
              <span aria-hidden="true" className="glyphicon glyphicon-search" />
              <input
                ref={searchRef}
                aria-label={
                  ru
                    ? "Поиск устройств и каналов"
                    : "Search devices and channels"
                }
                placeholder={
                  ru ? "Найти устройство или канал" : "Find a device or channel"
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </form>
          )}
          <div
            className={classNames("shell-connection", {
              "is-connected": uiStore.isConnected,
            })}
          >
            <i />
            {t(
              uiStore.isConnected
                ? "navigation.connection.active"
                : "navigation.connection.inactive",
            )}
          </div>
        </div>
        {isMobileMenuOpened && (
          <button
            className="navigation-overlay"
            aria-label={ru ? "Закрыть меню" : "Close menu"}
            onClick={() => setIsMobileMenuOpened(false)}
          />
        )}
      </>
    );
  },
);
