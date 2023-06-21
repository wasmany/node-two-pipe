/** 初始化参数 */
export interface InitOptions {
  /** 单轮最大重连次数 */
  maxReconnectTime?: number;
  /** 单轮重连间隔 */
  connectInterval?: number;
  /** 重连间隔 */
  reConnectInterval?: number;
  /** 心跳检测 */
  heartbeat?: boolean | HeartbeatOption;
  /** write delay */
  writeDelay?: number
  /** sendTransform */
  transformData: Function;
  /** responseTransform */
  transformResponse: Function;
}

/** connectOption */
export interface ConnectOptions {
  receiver_pipe?: string,
  sender_pipe?: string,
}

export interface HeartbeatOption {
  /** 心跳间隔 */
  interval?: number;
  /** 心跳响应超时 */
  timeoutInterval?: number;
  /** 最大超时次数 */
  maxTimeoutTime?: number;
  /** ping */
  ping?: any;
  /** pong */
  pong?: any;
}