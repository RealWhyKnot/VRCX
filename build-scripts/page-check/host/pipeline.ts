import { instanceOf, name, type Dataset, type Friend, type JsonObject } from "./fixtures.ts";
import type { Random } from "./random.ts";

type Listener = (event: Event) => void;
type PipelineEvent = { type: string; content: JsonObject };

const PIPELINE_HOST = "pipeline.vrchat.cloud";
const OPEN = 1;
const CLOSED = 3;
const TICK_MS = 100;

class FakePipelineSocket extends EventTarget {
  static readonly sockets = new Set<FakePipelineSocket>();
  readonly url: string;
  readyState = 0;
  binaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  onopen: Listener | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: Listener | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  constructor(url: string) {
    super();
    this.url = url;
    FakePipelineSocket.sockets.add(this);
    queueMicrotask(() => {
      this.readyState = OPEN;
      const event = new Event("open");
      this.onopen?.(event);
      this.dispatchEvent(event);
    });
  }

  send(): void {
    return undefined;
  }

  close(code = 1000, reason = ""): void {
    if (this.readyState === CLOSED) {
      return;
    }
    this.readyState = CLOSED;
    FakePipelineSocket.sockets.delete(this);
    const event = new CloseEvent("close", { code, reason, wasClean: true });
    this.onclose?.(event);
    this.dispatchEvent(event);
  }

  deliver(message: PipelineEvent): void {
    if (this.readyState !== OPEN) {
      return;
    }
    const event = new MessageEvent("message", { data: JSON.stringify({ type: message.type, content: JSON.stringify(message.content) }) });
    this.onmessage?.(event);
    this.dispatchEvent(event);
  }
}

function installPipelineSocket(): void {
  const RealWebSocket = window.WebSocket;
  const PipelineAwareSocket = new Proxy(RealWebSocket, {
    construct(target, args: unknown[]): object {
      const [url] = args;
      if (typeof url === "string" && url.includes(PIPELINE_HOST)) {
        return new FakePipelineSocket(url);
      }
      const created: unknown = Reflect.construct(target, args);
      if (typeof created !== "object" || created === null) {
        throw new TypeError("WebSocket construction failed");
      }
      return created;
    },
  });
  Object.assign(window, { WebSocket: PipelineAwareSocket });
}

function createEventSource(data: Dataset, random: Random) {
  const friends = data.friends;
  const ownerId = data.currentUser.id;
  const randomFriend = (): Friend => random.pick(friends);
  const userWith = (friend: Friend, changes: JsonObject): JsonObject => {
    Object.assign(friend, changes);
    return { ...friend };
  };
  const location = (friend: Friend): string => instanceOf(random, random.pick(data.worlds).id, friend.id);
  const builders: [number, () => PipelineEvent][] = [
    [
      40,
      () => {
        const friend = randomFriend();
        const next = location(friend);
        return {
          type: "friend-location",
          content: {
            userId: friend.id,
            location: next,
            worldId: next.split(":")[0] ?? "",
            travelingToLocation: "",
            user: userWith(friend, { location: next, state: "online" }),
          },
        };
      },
    ],
    [
      15,
      () => {
        const friend = randomFriend();
        const next = location(friend);
        return {
          type: "friend-online",
          content: {
            userId: friend.id,
            location: next,
            worldId: next.split(":")[0] ?? "",
            travelingToLocation: "",
            platform: "standalonewindows",
            canRequestInvite: true,
            user: userWith(friend, { location: next, state: "online", status: "active" }),
          },
        };
      },
    ],
    [
      15,
      () => {
        const friend = randomFriend();
        userWith(friend, { location: "offline", state: "offline", status: "offline" });
        return { type: "friend-offline", content: { userId: friend.id, platform: "standalonewindows" } };
      },
    ],
    [
      8,
      () => {
        const friend = randomFriend();
        return {
          type: "friend-update",
          content: { userId: friend.id, user: userWith(friend, { statusDescription: random.word(random.int(3, 24)) }) },
        };
      },
    ],
    [
      5,
      () => {
        const friend = randomFriend();
        return {
          type: "friend-active",
          content: { userId: friend.id, platform: "web", user: userWith(friend, { location: "offline", state: "active" }) },
        };
      },
    ],
    [
      5,
      () => {
        const friend = randomFriend();
        return {
          type: "notification",
          content: {
            id: `not_${random.word(8)}-0000-4000-8000-${random.word(12)}`,
            type: random.pick(["invite", "requestInvite", "friendRequest"]),
            senderUserId: friend.id,
            senderUsername: friend.displayName,
            receiverUserId: ownerId,
            message: random.word(16),
            details: {},
            seen: false,
            created_at: new Date().toISOString(),
          },
        };
      },
    ],
    [
      1,
      () => {
        const friend = randomFriend();
        return { type: "friend-update", content: { userId: friend.id, user: userWith(friend, { displayName: name(random) }) } };
      },
    ],
  ];
  const total = builders.reduce((sum, [weight]) => sum + weight, 0);
  return (): PipelineEvent => {
    let roll = random.int(1, total);
    for (const [weight, build] of builders) {
      roll -= weight;
      if (roll <= 0) {
        return build();
      }
    }
    return builders[0]?.[1]() ?? { type: "noop", content: {} };
  };
}

function gameLogLine(data: Dataset, random: Random): string {
  const friend = random.pick(data.friends);
  const type = random.pick(["player-joined", "player-left"]);
  return JSON.stringify(["output_log.txt", new Date().toISOString(), type, friend.displayName, friend.id]);
}

function startEventPump(data: Dataset, random: Random, onEvent: () => void) {
  const nextEvent = createEventSource(data, random);
  let rate = 0;
  let owed = 0;
  const bridge = (): unknown => Reflect.get(window, "$bridge");
  setInterval(() => {
    if (rate <= 0 || FakePipelineSocket.sockets.size === 0) {
      return;
    }
    owed += (rate * TICK_MS) / 1000;
    while (owed >= 1) {
      owed -= 1;
      const event = nextEvent();
      for (const socket of FakePipelineSocket.sockets) {
        socket.deliver(event);
      }
      const target = bridge();
      const addGameLogEvent: unknown = typeof target === "object" && target !== null ? Reflect.get(target, "addGameLogEvent") : undefined;
      if (typeof addGameLogEvent === "function" && random.chance(0.3)) {
        const result: unknown = Reflect.apply(addGameLogEvent, target, [gameLogLine(data, random)]);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            console.error("page-check game log event failed", error);
          });
        }
      }
      onEvent();
    }
  }, TICK_MS);
  return {
    setRate(next: number): void {
      rate = Math.max(0, next);
      owed = 0;
    },
    sockets(): number {
      return FakePipelineSocket.sockets.size;
    },
  };
}

export { installPipelineSocket, startEventPump };
