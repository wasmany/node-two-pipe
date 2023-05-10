# node-two-pipe

## install

```shell
  npm i node-two-pipe
```

## usage

```javascript
  import PipeSocketClient from 'node-two-pipe'

  function transformData(data) {
    try {
      return JSON.stringify(data)
    } catch (error) {
      return data
    }
  }

  function transformResponse(data) {
    try {
      return JSON.parse(data)
    } catch (error) {
      return data
    }
  }


  const scoketClient = PipeSocketClient.create({
    reConnectInterval: 3e3,
    connectInterval: 2e3,
    heartbeat: {
      ping: transformData({ id: 1, method: 1e5 }),
      interval: 3e3,
      timeoutInterval: 2e3,
      maxTimeoutTime: 2
    },
    transformData,
    transformResponse
  })()
  
  scoketClient.on('reconnect', (e) => {
    /** e.type: round | roundIn */
    console.info('socket reconnect', e)
  })

  scoketClient.on('open', () => {
    console.info(`socket connect success-${scoketClient.option.url}`)
  })

  scoketClient.on('error', e => {
    console.info('socket connect error', e.message)
  })

  scoketClient.on('message', e => {
    console.info('socket receive', e.data)
  })

  scoketClient.on('close', () => {
    console.info('socket connect close')
  })

  scoketClient.on('beforeSend', ({ data }) => {
    console.info('socket send message', data)
  })

  scoketClient.connect(`wsURL`)

```
