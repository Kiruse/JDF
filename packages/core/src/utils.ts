const DEBUG = 'DEBUG_JDF' in process.env;

export function debug(...args: any[]) {
  if (DEBUG) console.debug(...args);
}
