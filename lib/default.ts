import type {
  InitOptions,
  HeartbeatOption
} from "../types/socket";

const original = (d: any) => d;

export const defaultHeartbeatOption: Required<HeartbeatOption> = {
  interval: 1000 * 10,
  timeoutInterval: 1000 * 10,
  maxTimeoutTime: 3,
  ping: "ping",
  pong: "pong",
};

export const defaultInitOptions: Required<InitOptions> = {
  writeDelay: 20,
  connectInterval: 1000,
  reConnectInterval: 1000 * 60,
  maxReconnectTime: 3,
  heartbeat: defaultHeartbeatOption,
  transformData: original,
  transformResponse: original,
};

