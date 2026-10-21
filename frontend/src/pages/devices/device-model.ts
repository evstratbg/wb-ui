import type { Cell } from "@/stores/devices";

export type DeviceRoute = {
  search?: string;
  filter?: string;
  device?: string;
  tab?: string;
  channel?: string;
};
export type ChannelGroup = "control" | "input" | "value" | "detail";

export function deviceHref(route: DeviceRoute = {}) {
  const params = new URLSearchParams();
  for (const key of ["search", "filter", "device", "tab", "channel"] as const) {
    const value = route[key];
    if (
      value &&
      !(key === "filter" && value === "all") &&
      !(key === "tab" && value === "channels")
    ) {
      params.set(key, value);
    }
  }
  return `#!/devices${params.size ? `?${params}` : ""}`;
}

export function getChannelGroup(cell: Cell): ChannelGroup {
  if (!cell.readOnly) return "control";
  if (cell.displayType === "alarm") return "detail";
  // No channel-group metadata is published by this backend. Keep unlabelled
  // technical counters and identity fields below operational controls.
  if (
    !cell.units &&
    /counter|serial|firmware|bootloader|сч[её]тчик|серийн|прошивк/i.test(
      `${cell.controlId} ${cell.name}`,
    )
  )
    return "detail";
  if (cell.valueType === "boolean" || cell.displayType === "switch")
    return "input";
  if (cell.valueType === "number") return "value";
  return "detail";
}

export function groupChannels(cells: Cell[]) {
  const groups: Record<ChannelGroup, Cell[]> = {
    control: [],
    input: [],
    value: [],
    detail: [],
  };
  cells
    .filter((cell) => !cell.hidden && cell.isComplete)
    .forEach((cell) => groups[getChannelGroup(cell)].push(cell));
  return groups;
}
