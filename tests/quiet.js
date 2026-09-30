// Keep test output readable (the app logs every handled error). TEST_VERBOSE=1 to see them.
if (!process.env.TEST_VERBOSE) {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
}
