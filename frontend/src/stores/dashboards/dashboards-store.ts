import { makeAutoObservable, runInAction } from 'mobx';
import { uiConfigPath } from '@/common/paths';
import type { DashboardBase, UIConfigResponse, WidgetBase } from '@/stores/dashboards';
import { generateNextId } from '@/utils/id';
import i18n from '~/i18n/react/config';
import { Dashboard } from './dashboard';
import { Widget } from './widget';

export default class DashboardsStore {
  public dashboards: Map<string, Dashboard> = new Map();
  public widgets: Map<string, Widget> = new Map();
  public isLoading = true;
  public description = '';
  public defaultDashboardId: string;
  public isShowWidgetsPage: boolean = false;
  public saveError: string = null;
  #configEditorProxy: any;

  constructor(configEditorProxy: any) {
    this.#configEditorProxy = configEditorProxy;

    makeAutoObservable(this, {}, { autoBind: true });
  }

  loadData() {
    this.isLoading = true;
    return this.#configEditorProxy.Load({ path: uiConfigPath })
      .then(({ content }: UIConfigResponse) => {
        this.applyConfig(content);
        return content;
      });
  }

  applyConfig(content: UIConfigResponse['content']) {
            this.dashboards = new Map(
      content.dashboards.map((dashboard) => [dashboard.id, new Dashboard(dashboard, this)])
    );
    this.widgets = new Map(content.widgets.map((widget) => [widget.id, new Widget(widget, this)]));
          this.defaultDashboardId = content.defaultDashboardId;
    this.description = content.description || '';
          this.isShowWidgetsPage = !!content.isShowWidgetsPage;
          this.isLoading = false;
  }

  async addDashboard(data: Dashboard) {
    this.dashboards.set(data.id, new Dashboard(data, this));

    this._saveData();
  }

  async updateDashboard(id: string, data: Dashboard) {
    if (id === data.id) {
      this.dashboards.set(id, new Dashboard(data, this));
    } else {
      this.dashboards.set(data.id, new Dashboard(data, this));
      this.dashboards.delete(id);
    }

    this._saveData();
  }

  async updateDashboards(data: Dashboard[]) {
    this.dashboards = new Map(data.map((dashboard) => [dashboard.id, new Dashboard(dashboard, this)]));
    this._saveData();
  }

  async deleteDashboard(id: string) {
    this.dashboards.delete(id);
    this._saveData();
  }

  addWidgetToDashboard(dashboardId: string, widgetId: string) {
    runInAction(() => {
      const dashboard = this.dashboards.get(dashboardId);
      dashboard.widgets.push(widgetId);
      this.dashboards.set(dashboardId, new Dashboard(dashboard, this));
      this._saveData();
    });
  }

  removeWidgetFromDashboard(dashboardId: string, widgetId: string, withSave = true) {
    runInAction(() => {
      const dashboard = this.dashboards.get(dashboardId);
      dashboard.widgets = dashboard.widgets.filter((widget) => widget !== widgetId);
      this.dashboards.set(dashboardId, new Dashboard(dashboard, this));
      if (withSave) {
        this._saveData();
      }
    });
  }

  copyWidget(widgetId: string) {
    return runInAction(() => {
      const id = generateNextId(Array.from(this.widgets.keys()), 'widget');
      const copiedWidget = this.widgets.get(widgetId);
      this.widgets.set(id, new Widget({ ...copiedWidget, id, name: `${copiedWidget.name}_copy` }, this)
      );
      this._saveData();
      return id;
    });
  }

  updateWidget(widget: WidgetBase) {
    this.widgets.set(widget.id, new Widget(widget, this));
    this._saveData();
  }

  deleteWidget(widgetId: string) {
    runInAction(() => {
      this.dashboards.forEach((dashboard) => {
        if (dashboard.hasWidget(widgetId)) {
          this.removeWidgetFromDashboard(dashboard.id, widgetId, false);
        }
      });
      this.widgets.delete(widgetId);
      this._saveData();
    });
  }

  setLoading(value: boolean) {
    runInAction(() => {
      this.isLoading = value;
    });
  }

  setDefaultDashboardId(id: string) {
    runInAction(() => {
      this.defaultDashboardId = id;
      this._saveData();
    });
  }

  setIsShowWidgetsPage(isShow: boolean) {
    runInAction(() => {
      this.isShowWidgetsPage = isShow;
      this._saveData();
    });
  }

  setDescription(description: string) {
    runInAction(() => {
      this.description = description;
      this._saveData();
    });
  }

  get dashboardsList() {
    return Array.from(this.dashboards.values());
  }

  async _saveData() {
    const content = {
      defaultDashboardId: this.defaultDashboardId,
      dashboards: Array.from(this.dashboards.values()),
      widgets: Array.from(this.widgets.values()),
      description: this.description,
      isShowWidgetsPage: this.isShowWidgetsPage,
    };

    await this.#configEditorProxy
      .Save({ path: uiConfigPath, content })
      .then(() => {
        runInAction(() => {
          this.saveError = null;
        });
      })
      .catch((err: any) => {
        runInAction(() => {
          if (err.name === 'QuotaExceededError') {
            this.saveError = i18n.t('dashboards.errors.overflow');
          } else {
            this.saveError = i18n.t('dashboards.errors.save', { err });
          }
        });
      });
  }
}
