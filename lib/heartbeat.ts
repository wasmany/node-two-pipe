import type { HeartbeatOption } from "../types/socket";

interface HeartbeatInstance extends HeartbeatOption {
  checking: (instance: Heartbeat) => void;
  timeout: (instance: Heartbeat) => void;
}

const loop = () => { };

export default class Heartbeat {
  option: HeartbeatInstance;
  /** 超时次数 */
  timeOutTime: number = 0;
  /** ping Timer */
  pingTimer:  NodeJS.Timeout | null = null;
  /** pong Timer */
  pongTimer:  NodeJS.Timeout | null = null;
  constructor(option: HeartbeatInstance) {
    this.option = option;
  }
  start() {
    this.stop();
    const {
      interval,
      timeoutInterval,
      maxTimeoutTime = 0,
      checking = loop,
      timeout = loop,
    } = this.option;

    this.pingTimer = setTimeout(() => {
      /** start check */
      checking(this);
      this.pongTimer = setTimeout(() => {
        /** 超时 */
        this.timeOutTime++;
        console.warn(
          `${this.timeOutTime} time timeout ! maxTimeOutTime : ${maxTimeoutTime}`
        );
        if (this.timeOutTime >= maxTimeoutTime) {
          timeout(this);
        } else {
          this.start();
        }
      }, timeoutInterval);
    }, interval);
  }
  stop() {
    this.timeOutTime = 0;
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
}
