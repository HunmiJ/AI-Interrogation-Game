export class ProviderConfigurationError extends Error {
  constructor(public readonly code: 'MISSING_API_KEY' | 'UNSUPPORTED_PROVIDER', message: string) {
    super(message)
  }
}

export class ProviderRequestError extends Error {
  constructor(
    public readonly code: 'RATE_LIMITED' | 'AUTH_ERROR' | 'TIMEOUT' | 'UNAVAILABLE' | 'INVALID_RESPONSE',
    message: string,
    public readonly retryable: boolean,
    public readonly details: {
      httpStatus?: number
      providerCode?: string
      providerMessage?: string
      timeout?: boolean
      responseParsingError?: boolean
      responseStatus?: string
      outputItemTypes?: string[]
      contentTypes?: string[]
      incompleteDetails?: string
    } = {},
  ) {
    super(message)
  }
}
