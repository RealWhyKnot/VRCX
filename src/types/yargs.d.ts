declare module "yargs" {
  type CommandModule<Args> = {
    command: string;
    aliases: string[];
    desc: string;
    handler: (argv: Args) => void;
  };

  type Argv<Args = object> = {
    command<Next = Args>(module: CommandModule<Next>): Argv<Args>;
    demandCommand(min: number): Argv<Args>;
    example(examples: [string, string][]): Argv<Args>;
    help(enabled: boolean): Argv<Args>;
    version(enabled: boolean): Argv<Args>;
    wrap(columns: number | null): Argv<Args>;
    terminalWidth(): number;
    fail(handler: () => unknown): Argv<Args>;
    showHelp(): Argv<Args>;
    parse(): unknown;
  };

  export default function yargs<Args = object>(processArgs: readonly string[]): Argv<Args>;
}

declare module "yargs/helpers" {
  export function hideBin(argv: readonly string[]): string[];
}
