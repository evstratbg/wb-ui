import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import { makeAutoObservable, runInAction } from 'mobx';
import { uiConfigPath } from '@/common/paths';
import { generateNextId } from '@/utils/id';
import { configDiff } from '@/utils/config-diff';

export default class PanelDraftStore {
  public config: any = null;
  public baseline: any = null;
  public panelId: string;
  public loading = true;
  public isSaving = false;
  public error = '';
  private readonly proxy: any;
  private readonly live: any;
  constructor(proxy: any, live: any, panelId?: string) {
    this.proxy = proxy;
    this.live = live;
    this.panelId = panelId || '';
    makeAutoObservable(this, {}, { autoBind: true });
  }
  async load() {
    this.loading = true;
    this.error = '';
    try {
      const response = await this.proxy.Load({ path: uiConfigPath });
      runInAction(() => {
        this.baseline = cloneDeep(response.content);
        this.config = cloneDeep(response.content);
        if (!this.panelId) {
          this.panelId = generateNextId(
            this.config.dashboards.map((item) => item.id),
            'dashboard'
          );
          this.config.dashboards.push({
            id: this.panelId,
            name: '',
            widgets: [],
            isSvg: false,
            options: {},
          });
        }
        if (!this.panel || this.panel.isSvg)
          throw new Error('Panel unavailable or uses the SVG editor');
      });
    } catch (error) {
      runInAction(() => {
        this.error = String(error.message || error);
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }
  get panel() {
    return this.config?.dashboards.find((item) => item.id === this.panelId);
  }
  get isDirty() {
    return !!this.config && !isEqual(this.baseline, this.config);
  }
  get changes() {
    return this.config ? configDiff(this.baseline, this.config) : [];
  }
  get canSave() {
    return (
      !this.loading &&
      !this.isSaving &&
      this.isDirty &&
      !this.panel?.isSvg &&
      !!this.panel?.name.trim() &&
      this.panel.widgets.every((id) => this.config.widgets.some((widget) => widget.id === id))
    );
  }
  widget(id: string) {
    return this.config?.widgets.find((item) => item.id === id);
  }
  associatedPanels(id: string) {
    return this.config?.dashboards.filter((panel) => panel.widgets?.includes(id)) || [];
  }
  setName(value: string) {
    if (!this.isSaving) this.panel.name = value;
  }
  addWidget(id: string) {
    if (!this.isSaving && this.widget(id) && !this.panel.widgets.includes(id))
      this.panel.widgets.push(id);
  }
  removeWidget(id: string) {
    if (this.isSaving) return;
    this.panel.widgets = this.panel.widgets.filter((item) => item !== id);
    if (!this.baseline.widgets.some((item) => item.id === id) && !this.associatedPanels(id).length)
      this.config.widgets = this.config.widgets.filter((item) => item.id !== id);
  }
  moveWidget(index: number, delta: number) {
    if (this.isSaving || index + delta < 0 || index + delta >= this.panel.widgets.length) return;
    const ids = [...this.panel.widgets];
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    this.panel.widgets = ids;
  }
  saveWidget(data: any, scope: 'copy' | 'all' = 'copy') {
    if (this.isSaving) return;
    const existing = this.widget(data.id);
    if (!existing || (scope === 'copy' && this.associatedPanels(data.id).length > 1)) {
      const id = generateNextId(
        this.config.widgets.map((widget) => widget.id),
        'widget'
      );
      this.config.widgets.push({ ...cloneDeep(data), id });
      if (existing)
        this.panel.widgets = this.panel.widgets.map((item) => (item === data.id ? id : item));
      else this.addWidget(id);
      return id;
    }
    Object.assign(existing, cloneDeep(data));
    return data.id;
  }
  discard() {
    if (!this.isSaving) this.config = cloneDeep(this.baseline);
  }
  async save() {
    if (!this.canSave) return false;
    this.isSaving = true;
    this.error = '';
    try {
      const current = await this.proxy.Load({ path: uiConfigPath });
      if (!isEqual(current.content, this.baseline)) throw new Error('STALE_CONFIGURATION');
      const snapshot = cloneDeep(this.config);
      await this.proxy.Save({ path: uiConfigPath, content: snapshot });
      runInAction(() => {
        this.baseline = snapshot;
        this.live.applyConfig(snapshot);
      });
      return true;
    } catch (error) {
      runInAction(() => {
        this.error = String(error.message || error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  }
}
