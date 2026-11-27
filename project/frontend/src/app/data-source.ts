import type { AppEnv } from '@/config/env'

export type DataSourceStatus = { ready: true } | { ready: false; reason: string }

/**
 * Starts mocks only when they were explicitly requested. If they cannot start,
 * the app must not render: its requests would otherwise go somewhere unintended.
 */
export async function prepareDataSource(
  env: AppEnv,
  startMocks: (baseUrl: string) => Promise<void>,
): Promise<DataSourceStatus> {
  if (!env.mocksEnabled) return { ready: true }
  try {
    await startMocks(env.apiBaseUrl)
    return { ready: true }
  } catch (error) {
    return { ready: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
