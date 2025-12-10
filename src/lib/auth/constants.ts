// OAuth configuration for PostHog authentication

export const OAUTH_CONFIG = {
  US: {
    clientId: 'ivRKHzUZxF6Dtm1dnr9nQUZElrHuuHkUuqk8SwQj',
    baseUrl: 'https://us.posthog.com',
  },
  EU: {
    clientId: 'ivRKHzUZxF6Dtm1dnr9nQUZElrHuuHkUuqk8SwQj', // Same client for now, update if needed
    baseUrl: 'https://eu.posthog.com',
  },
} as const;

export type OAuthRegion = keyof typeof OAUTH_CONFIG;

// Scopes required for LLM gateway access
export const OAUTH_SCOPES = ['user:read', 'project:read', 'task:write', 'introspection'];

// Cookie names
export const AUTH_COOKIE_NAME = 'posthog_auth';
export const OAUTH_STATE_COOKIE_NAME = 'oauth_state';
