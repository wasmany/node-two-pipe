import {
  defaultInitOptions,
  defaultHeartbeatOption,
} from "./default";
import type { InitOptions, HeartbeatOption, ConnectOptions } from "../types/socket";

export const getHeartbeat = (
  option: HeartbeatOption | boolean
): HeartbeatOption | false => {
  if (option) {
    return option === true ? defaultHeartbeatOption : option;
  }
  return false;
};

/** 合并 init option */
export const mergeOption = (
  source: InitOptions & ConnectOptions,
  receive: InitOptions & ConnectOptions
): Required<InitOptions> & ConnectOptions => {
  const heartbeat = getHeartbeat(receive.heartbeat ?? true);
  return Object.assign({}, defaultInitOptions, source, {
    ...receive,
    heartbeat,
  });
};
