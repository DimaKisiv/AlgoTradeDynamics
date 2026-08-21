module.exports = {
  emulatorApi: {
    getAccounts: jest.fn(() => Promise.resolve([])),
    getAccount: jest.fn(() => new Promise(() => {})),
    getActivity: jest.fn(() => Promise.resolve([])),
    createOrder: jest.fn(() => Promise.resolve({})),
    cancelOrder: jest.fn(() => Promise.resolve({})),
    runScenario: jest.fn(() => Promise.resolve({})),
    startHistorical: jest.fn(() => Promise.resolve({})),
    stopHistorical: jest.fn(() => Promise.resolve({})),
    resetAccount: jest.fn(() => Promise.resolve({})),
    health: jest.fn(() => Promise.resolve({ status: 'ok' })),
  },
};
