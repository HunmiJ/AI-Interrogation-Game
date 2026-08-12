let live = false

export function markLlmLive() {
  live = true
}

export function markLlmOffline() {
  live = false
}

export function isLlmLive() {
  return live
}
