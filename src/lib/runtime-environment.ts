export type RuntimeEnvironment = 'development' | 'staging' | 'production';

/** Resolve an explicit APP_ENV first, then map Vercel's preview environment to staging. */
export function resolveRuntimeEnvironment(values: Record<string, string | undefined>): RuntimeEnvironment {
  const explicit = values.APP_ENV?.trim().toLowerCase();
  if (explicit === 'development' || explicit === 'staging' || explicit === 'production') return explicit;
  if (values.VERCEL_ENV === 'production') return 'production';
  if (values.VERCEL_ENV === 'preview') return 'staging';
  return 'development';
}

export const environmentSuffix = (environment: RuntimeEnvironment) => environment.toUpperCase();

export const environmentPrefix = (base: string, environment: RuntimeEnvironment) =>
  environment === 'production' ? base : `${base}_${environment === 'staging' ? 'staging' : 'dev'}`;
