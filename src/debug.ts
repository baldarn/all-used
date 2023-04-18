import Debug from 'debug';

const appDebug = (instance) => ({
  debug: Debug(`all-used:debug:${instance}`),
  error: Debug(`all-used:error:${instance}`),
  log: Debug(`all-used:log:${instance}`),
});

export default appDebug;
