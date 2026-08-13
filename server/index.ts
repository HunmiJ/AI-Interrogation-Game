import 'dotenv/config'
import { createApp } from './app'
import { getProviderStatus } from './providers/providerConfig'

const port = Number(process.env.PORT) || 8787
const app = createApp()

app.listen(port, '0.0.0.0', () => {
  const status = getProviderStatus()
  console.log(`[server] http://localhost:${port} · ${status.provider}/${status.model} ${status.configured ? 'configured' : 'not configured'}`)
})
