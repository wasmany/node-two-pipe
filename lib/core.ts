import events from 'events'
import Heartbeat from './heartbeat'
import { defaultInitOptions } from './default'
import { getHeartbeat, mergeOption } from './shared'

import type {
  InitOptions,
  ConnectOptions
} from '../types/socket'

import net, { type Socket } from 'net'

type SocketType = 'sender' | 'receiver'

type PipeSocketMap = Record<SocketType, Socket | null>

enum PIPE_SOCKET_MAP {
  'opening' = 0,
  'open' = 1,
  'readOnly' = 2,
  'writeOnly' = 3,
  'closed' = -1
}

class PipeSocket extends events {
  #socket: PipeSocketMap = {
    sender: null,
    receiver: null
  }
  #messageQueue: any[] = []
  /** 单轮重连次数 */
  #reconnectNum: number = 0
  /** round reconnect timer */
  #roundConnectTimer: NodeJS.Timeout | null = null
  /** reconnect timer */
  #connectTimer: NodeJS.Timeout | null = null
  /** 当前是第几轮 */
  #connectTime: number = 1
  /** 心跳检测实例 */
  #heartbeatInstance: Heartbeat | null = null
  /** 用户主动断开 */
  #allowReConnect = true
  #sendTime = Date.now()
  #sendLoopTimer: NodeJS.Timeout | null = null
  option: Required<InitOptions> & ConnectOptions
  constructor(option: InitOptions & ConnectOptions) {
    super()
    this.option = mergeOption(
      Object.assign({}, defaultInitOptions),
      option
    )
    this.#setupOnOpen()
    this.#setupReConnectEvent()
    this.#setupReConnectMaxEvent()
    this.#setupHeartbeat()
  }
  get readyState() {
    const { sender, receiver } = this.#socket
    if (!(sender && receiver)) { return PIPE_SOCKET_MAP.closed }
    if (sender.readyState !== receiver.readyState) {
      return PIPE_SOCKET_MAP.closed
    }
    return PIPE_SOCKET_MAP[sender.readyState]
  }
  /** onopen */
  #setupOnOpen() {
    this.on('open', () => {
      this.#reconnectNum = 0
      this.#heartbeatInstance?.start()
    })
  }
  /** setup heartbeat */
  #setupHeartbeat() {
    const option = getHeartbeat(this.option.heartbeat)
    if (option) {
      this.#heartbeatInstance = new Heartbeat({
        ...option,
        checking: () => {
          // this.#socketSend(option.ping, false)
          this.#messageQueue.push(option.ping)
        },
        timeout: () => {
          this.#socket.sender?.destroy()
          this.#socket.receiver?.destroy()
        }
      })
    }
  }
  /** clear will connect timer */
  #clearConnectTimer() {
    if (this.#connectTimer) {
      clearTimeout(this.#connectTimer)
      this.#connectTimer = null
    }
  }
  #clearRoundConnectTimer() {
    if (this.#roundConnectTimer) {
      clearTimeout(this.#roundConnectTimer)
      this.#roundConnectTimer = null
    }
  }
  /** setup reconnect event */
  #setupReConnectEvent() {
    this.on('reconnect', () => {
      this.#connectTimer = setTimeout(() => {
        this.connect()
      }, this.option.connectInterval)
    })
  }
  /** setup reconnect max event */
  #setupReConnectMaxEvent() {
    this.on('connectTimeMax', (time: number) => {
      if (this.option.reConnectInterval > 0) {
        this.#roundConnectTimer = setTimeout(() => {
          this.#reconnectNum = 0
          this.emit('reconnect', {
            type: 'round',
            time,
            description: `第${time}次连接`
          })
        }, Math.max(this.option.reConnectInterval - this.option.connectInterval, 0))
      }
    })
  }
  /** connect */
  connect(connectOption?: ConnectOptions) {
    this.#clearConnectTimer()
    this.#clearRoundConnectTimer()
    if (this.readyState === PIPE_SOCKET_MAP.opening) {
      console.warn('connection is opening')
      return this.readyState
    }
    if (connectOption?.receiver_pipe && connectOption?.sender_pipe) {
      this.#reconnectNum = 0
    }
    Object.assign(this.option, connectOption || {})
    if (this.option?.receiver_pipe && this.option?.sender_pipe) {
      this.#realConnect('sender', this.option.sender_pipe)
      this.#realConnect('receiver', this.option.receiver_pipe)
      this.#allowReConnect = true
    } else {
      console.warn(`option is invalid, got option`, this.option)
    }
  }
  #realConnect(
    type: SocketType, path: string
  ) {
    this.#socket[type]?.destroy()
    this.#socket[type]?.removeAllListeners()
    this.#socket[type] = net.connect(path)
    if (this.#socket[type]) {
      this.#socketSetupOnOpen(type, this.#socket[type]!)
      this.#socketSetupOnMessage(type, this.#socket[type]!)
      this.#socketSetupOnError(type, this.#socket[type]!)
      this.#socketSetupOnClose(type, this.#socket[type]!)
    }
  }
  #socketSetupOnOpen(type: SocketType, socket: Socket) {
    socket?.addListener('ready', () => {
      if (this.readyState === PIPE_SOCKET_MAP.open) {
        this.emit('open')
        this.#startSendLoop()
      }
    })
  }
  #startSendLoop() {
    let now = Date.now()
    if (now >= (this.#sendTime + 20)) {
      const message = this.#messageQueue.shift()
      if (message) {
        this.#socketSend(message)
      }
    }
    this.#stopSendLoop()

    if (this.readyState === PIPE_SOCKET_MAP.open) {
      this.#sendLoopTimer = setTimeout(() => {
        if (this.readyState === PIPE_SOCKET_MAP.open) {
          this.#stopSendLoop()
          this.#startSendLoop()
        }
      }, 20)
    }
  }
  #stopSendLoop() {
    if (this.#sendLoopTimer) {
      clearTimeout(this.#sendLoopTimer)
      this.#sendLoopTimer = null
    }
  }
  #socketSetupOnMessage(type: SocketType, socket: Socket) {
    if (type === 'receiver') {
      socket?.addListener('data', data => {
        this.#heartbeatInstance?.start()
        this.emit('message', { data: data.toString() })
        this.emit('data', this.option.transformResponse(data.toString()))
      })
    }
  }
  #socketSetupOnError(type: SocketType, socket: Socket) {
    socket?.addListener('error', error => {
      this.emit('error', { type, error })
    })
  }
  #socketSetupOnClose(type: SocketType, socket: Socket) {
    socket?.addListener('close', hasError => {
      this.#heartbeatInstance?.stop()
      this.#stopSendLoop()
      this.emit('close', { type, hasError })
      if (!this.option.maxReconnectTime || !this.#allowReConnect) {
        return
      }

      this.#socket.sender?.removeAllListeners()
      this.#socket.receiver?.removeAllListeners()
      this.#socket.sender?.destroy()
      this.#socket.receiver?.destroy()
      if (this.#reconnectNum < this.option.maxReconnectTime) {
        this.#reconnectNum++
        this.emit('reconnect', {
          socketType: type,
          type: 'roundIn',
          time: this.#reconnectNum,
          description: `reconnect : ${this.#reconnectNum} time`
        })
      } else {
        this.emit('connectTimeMax', ++this.#connectTime)
      }
    })
  }
  #socketSend(data: any, emit = true) {
    emit && this.emit('beforeSend', { data, target: this.#socket })
    this.#socket?.sender?.write(data, 'utf-8', this.#sendCallBack(data))
  }
  #sendCallBack(data: any) {
    return (err?: Error) => {
      if (err) {
        this.emit('sendError', err)
      } else {
        this.emit('sendSuccess', { data, target: this.#socket })
      }
      this.#sendTime = Date.now()
    }
  }
  send(input: any) {
    const data = this.option.transformData(input)
    switch (this.readyState) {
      case PIPE_SOCKET_MAP.opening:
        this.#messageQueue.push(data)
        return true
      case PIPE_SOCKET_MAP.open:
        this.#messageQueue.push(data)
        return true
      case PIPE_SOCKET_MAP.readOnly:
      case PIPE_SOCKET_MAP.writeOnly:
        console.log(`sender failed,  pipe socket is ${this.#socket.sender?.readyState}`)
        return false
      case PIPE_SOCKET_MAP.closed:
        console.warn('send failed, pipe socket is already CLOSED')
        return false
    }
  }
  close() {
    this.#reconnectNum = this.option.maxReconnectTime
    this.#heartbeatInstance?.stop()
    this.#allowReConnect = false
    this.#socket.sender?.destroy()
    this.#socket.receiver?.destroy()
  }
  destroy() {
    this.close()
    this.#clearConnectTimer()
    this.#clearRoundConnectTimer()
    Object.assign(this.#socket, { sender: null, receiver: null })
  }
}

export default PipeSocket
