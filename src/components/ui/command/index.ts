import type { Ref } from "vue";
import { createContext } from "reka-ui";

export type CommandFilterState = {
  search: string;
  filtered: {
    count: number;
    items: Map<string, number>;
    groups: Set<string>;
  };
};

export type CommandContext = {
  allItems: Ref<Map<string, string>>;
  allGroups: Ref<Map<string, Set<string>>>;
  filterState: CommandFilterState;
};

export const [useCommand, provideCommandContext] = createContext<CommandContext>("Command");

export const [useCommandGroup, provideCommandGroupContext] = createContext<{ id: string } | null>("CommandGroup");
