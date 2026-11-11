export type VrConfig = {
  backgroundEnabled?: boolean;
  minimalFeed?: boolean;
  isWristDisabled?: boolean;
  overlayNotifications?: boolean;
  appLanguage?: string;
  vrOverlayCpuUsage?: boolean;
  pcUptimeOnFeed?: boolean;
  notificationOpacity?: number;
  hideDevicesFromFeed?: boolean;
  dtHour12?: boolean;
  notificationTheme?: string;
  notificationTimeout?: number;
  notificationPosition?: string;
  photonOverlayMessageTimeout?: number;
};

export type VrNowPlaying = {
  url: string;
  name: string;
  length: number;
  startTime: number;
  elapsed: number;
  percentage: number;
  remainingText: string;
  playing: boolean;
};

export type VrLastLocation = {
  date: number;
  location: string;
  name: string;
  playerList: unknown[];
  friendList: unknown[];
  progressPie: boolean;
  onlineFor: number;
};

export type VrFeedDetails = {
  worldId?: string;
  worldName?: string;
  inviteMessage?: string;
  requestMessage?: string;
  responseMessage?: string;
};

export type VrAvatar = {
  name?: string;
  releaseStatus?: string;
};

export type VrFeedItem = {
  type?: string;
  created_at?: string;
  displayName?: string;
  previousDisplayName?: string;
  senderUsername?: string;
  userId?: string;
  isFriend?: boolean;
  isFavorite?: boolean;
  isTraveling?: boolean;
  isMaster?: boolean;
  isModerator?: boolean;
  inCache?: boolean;
  location?: string;
  instanceId?: string;
  instanceDisplayName?: string;
  worldName?: string;
  groupName?: string;
  tagColour?: string;
  colour?: string | undefined;
  color?: string;
  status?: string;
  previousStatus?: string;
  statusDescription?: string;
  previousStatusDescription?: string;
  trustLevel?: string;
  previousTrustLevel?: string;
  videoName?: string;
  videoUrl?: string;
  notyName?: string;
  message?: string;
  text?: string;
  data?: string;
  name?: string;
  description?: string;
  releaseStatus?: string;
  platform?: string;
  details: VrFeedDetails;
  avatar: VrAvatar;
};

export type VrHudItem = VrFeedItem & {
  time: number;
  combo: number;
};

export type VrHudTimeoutItem = {
  time?: number;
  displayName?: string;
};

export type VrDevice = [string, string, string, string | number, string];

export type VrStatusClass = {
  online?: boolean;
  joinme?: boolean;
  askme?: boolean;
  busy?: boolean;
};

export type VrState = {
  appLanguage: string;
  currentCulture: string;
  currentTime: string;
  cpuUsageEnabled: boolean;
  cpuUsage: string;
  pcUptimeEnabled: boolean;
  pcUptime: string;
  customInfo: string;
  config: VrConfig;
  onlineFriendCount: number;
  nowPlaying: VrNowPlaying;
  lastLocation: VrLastLocation;
  lastLocationTimer: string;
  onlineForTimer: string;
  wristFeed: VrFeedItem[];
  devices: VrDevice[];
  deviceCount: number;
  notificationOpacity: number;
  hudFeed: VrHudItem[];
  hudTimeout: VrHudTimeoutItem[];
  cleanHudFeedLoopStatus: boolean;
  isHmdDisabled: boolean;
  isWristDisabled: boolean;
};

export type VrOverlayHandler = (json: string) => void;
