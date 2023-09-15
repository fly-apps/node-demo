let ws = null
let interval = null
const counter = document.getElementById('counter')

function openws() {
  if (ws) return

  const url = window.location.protocol.replace('http', 'ws') +
    '//' + window.location.host + '/websocket'

  ws = new WebSocket(url)

  ws.onopen = () => {
    if (interval) {
      console.log('reconnected')
      clearInterval(interval)
      interval = null
    }
  }

  ws.onerror = error => {
    console.error(error)
    if (!interval) interval = setInterval(openws, 500)
  }

  ws.onclose = () => {
    console.log('disconnected')
    ws = null
    if (!interval) interval = setInterval(openws, 500)
  }

  ws.onmessage = event => {
    counter.textContent = event.data
  }
};

document.addEventListener('DOMContentLoaded', openws)
