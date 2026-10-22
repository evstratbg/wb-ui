import { makeAutoObservable, runInAction } from 'mobx';
import { generateNextId } from '@/utils/id';
import type { Rule, RuleError, RuleFetchData, RuleListItem, RuleLog, RuleSaveData } from './types';

export default class RulesStore {
  public rule?: Rule = {
    name: '',
    enabled: true,
    initName: '',
  };
  public rules: RuleListItem[] = [];
  public savedContent = '';
  public savedName = '';
  public errorSource: { content: string; origin: 'loaded' | 'submitted' } | null = null;
  private loadId = 0;
  public isRuleDebugEnabled = false;
  public logs: RuleLog[] = [];

  #mqttClient: any;
  #editorProxy: any;
  #whenMqttReady: () => Promise<void>;

  // eslint-disable-next-line typescript/naming-convention
  constructor(mqttClient, whenMqttReady: () => Promise<void>, EditorProxy: any) {
    this.#mqttClient = mqttClient;
    this.#editorProxy = EditorProxy;
    this.#whenMqttReady = whenMqttReady;

    makeAutoObservable(this);
  }

  get isDirty() {
    return (
      !!this.rule &&
      (this.rule.name !== this.savedName || (this.rule.content || '') !== this.savedContent)
    );
  }

  async load(path: string): Promise<Rule> {
    const loadId = ++this.loadId;
    return this.#whenMqttReady()
      .then(() => this.#editorProxy.Load({ path }))
      .then((res: RuleFetchData) => {
        runInAction(() => {
          if (loadId !== this.loadId) return;
          this.savedContent = res.content || '';
          this.savedName = path;
          this.rule = {
            initName: path,
            name: path,
            enabled: res.enabled,
            content: res.content,
          };
          this.errorSource = res.error ? { content: res.content || '', origin: 'loaded' } : null;
          if (res.error) {
            this.setError(res.error);
          }
        });

        return this.rule;
      });
  }

  setRule(value: string) {
    this.rule.content = value;
    if (this.rule.error) {
      this.rule.error.errorLine = null;
    }
  }

  setRuleName(value: string) {
    this.rule.name = value;
  }

  resetRule() {
    this.loadId++;
    this.errorSource = null;
    this.savedContent = '';
    this.savedName = '';
    this.rule = {
      name: '',
      initName: '',
      content: '',
      enabled: true,
      error: null,
    };
  }

  async save(rule: Rule): Promise<string> {
    let path = rule.initName;
    if (!path) {
      path = this.getValidRuleName(rule.name);
    }

    const submitted = rule.content || '';
    return this.#editorProxy.Save({ path, content: submitted })
      .then(async (res: RuleSaveData) => {
        runInAction(() => {
          if (res.error) {
            this.errorSource = { content: submitted, origin: 'submitted' };
            this.setError({
              message: res.error,
              traceback: res.traceback,
            });
          } else {
            rule.error = null;
            this.errorSource = null;
            this.savedContent = submitted;
            this.savedName = rule.initName || res.path;
          }
        });
        return res.path;
      });
  }

  async rename(oldName: string, newName: string): Promise<string> {
    return this.#editorProxy.Rename({ path: oldName, new_path: this.getValidRuleName(newName) })
      .then(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return this.getValidRuleName(newName);
      });
  }

  async checkIsNameUnique(name: string): Promise<boolean> {
    const path = this.getValidRuleName(name);
    const list = await this.getList();
    if (list.some((rule) => rule.virtualPath === path)) {
      throw new Error('file-exists');
    }

    return true;
  }

  getValidRuleName(path: string): string {
    return path.endsWith('.js') ? path : `${path}.js`;
  }

  async changeState(path: string, state: boolean): Promise<void> {
    await this.#editorProxy.ChangeState({ path, state });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.getList();
  }

  async getList(): Promise<RuleListItem[]> {
    return this.#whenMqttReady()
      .then(() => this.#editorProxy.List())
      .then((rules: RuleListItem[]) => {
        return runInAction(() => {
          this.rules = rules;
          return this.rules;
        });
      });
  }

  async copyRule(path: string) {
    const copiedRule = await this.load(path);
    copiedRule.name = generateNextId(
      this.rules.map((rule) => rule.virtualPath.replace(/\.js$/, '')),
      copiedRule.name.replace(/\.js$/, '')
    );
    const copiedRuleName = await this.save({
      ...copiedRule,
      initName: this.getValidRuleName(copiedRule.name),
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.changeState(copiedRuleName, false);
  }

  async deleteRule(path: string) {
    return this.#editorProxy.Remove({ path }).then((res: boolean) => {
      if (res) {
        runInAction(() => {
          this.rules = this.rules.filter((rule) => rule.virtualPath !== path);
        });
      }
    });
  }

  setError(error: RuleError) {
    this.rule.error = {
      message: error?.message || '',
      traceback: error?.traceback || [],
    };

    this.rule.error.errorLine = error?.traceback?.length ? error?.traceback[0].line : null;
  }

  subscribeRuleDebugging() {
    this.#mqttClient.addStickySubscription(
      '/devices/wbrules/controls/Rule debugging',
      ({ payload }) => {
        runInAction(() => {
          this.isRuleDebugEnabled = payload === '1';
        });
      }
    );
  }

  toggleRuleDebugging() {
    runInAction(() => {
      const value = !this.isRuleDebugEnabled;
      this.#mqttClient.send(
        '/devices/wbrules/controls/Rule debugging/on',
        String(Number(value)),
        false,
        1
      );
      this.isRuleDebugEnabled = value;
    });
  }

  subscribeRulesLogs() {
    const MAX_MESSAGES = 500;
    this.#mqttClient.addStickySubscription('/wbrules/log/+', ({ topic, payload }) => {
      runInAction(() => {
        if (this.logs.length === MAX_MESSAGES) {
          this.logs.shift();
        }
        this.logs.push({
          level: topic.replace(/^.*\//, ''),
          payload: payload.trim(),
          time: new Date().getTime(),
        });
      });
    });
  }

  unSubscribeRulesLogs() {
    this.#mqttClient.unsubscribe('/wbrules/log/+');
  }

  clearLogs() {
    this.logs = [];
  }
}
