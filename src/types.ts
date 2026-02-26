export interface Monitor {
  id: number;
  url: string;
  name: string;
  status: 'up' | 'down' | 'pending';
  lastChecked: string;
  uptime: number;
  responseTime: number;
  interval: number;
}

export interface PingLog {
  id: number;
  monitorId: number;
  status: 'up' | 'down';
  responseTime: number;
  timestamp: string;
  errorMessage?: string;
}

export interface Settings {
  telegramBotToken: string;
  telegramChatId: string;
  reportInterval: number;
}

export type ServerEvent = 
  | { type: 'INITIAL_STATE'; monitors: Monitor[]; logs: PingLog[]; settings: Settings }
  | { type: 'MONITOR_UPDATED'; monitor: Monitor }
  | { type: 'NEW_LOG'; log: PingLog }
  | { type: 'SETTINGS_UPDATED'; settings: Settings };
