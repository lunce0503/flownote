import { deviceOwner, isDeviceOnly } from './deviceMode.ts';

// Device DB names are retained for existing OFF-mode data. Cloud cache names
// must also include the owner; the old unscoped DB is recovery-only.
export const canvasDatabaseName = (owner = deviceOwner(), device = isDeviceOnly()): string => (
  device ? `flownote-canvas-device:${owner}` : `flownote-canvas-cloud:${owner || 'anonymous'}`
);
