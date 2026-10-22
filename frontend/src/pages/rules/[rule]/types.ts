import { type DevicesStore } from '@/stores/devices';
import { type RulesStore } from '@/stores/rules';

export interface RulePageProps {
  logsProxy?: any;
  onDirtyChange?: (dirty: boolean) => void;
  rulesStore: RulesStore;
  devicesStore: DevicesStore;
}
