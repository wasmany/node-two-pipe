import Core from "./core";
import { defaultInitOptions } from "./default";

import type { InitOptions, ConnectOptions } from "../types/socket";

function create(option: InitOptions & ConnectOptions) {
  const socket = new Core(option);
  function SocketInstance(connectOption: ConnectOptions) {
    socket.connect(connectOption);
    return socket;
  }
  SocketInstance.WebSocket = Core;
  SocketInstance.instance = socket;
  SocketInstance.create = create;
  return SocketInstance;
}

let instance = create(Object.assign({}, defaultInitOptions));

export default instance;
