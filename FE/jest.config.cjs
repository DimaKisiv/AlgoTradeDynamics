/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['./src/tests/__setup__/jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.module\\.css$': 'identity-obj-proxy',
    '\\.css$': '<rootDir>/src/tests/__mocks__/styleMock.cjs',
    '\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/src/tests/__mocks__/fileMock.cjs',
    '^.*/api/client(\\.js)?$': '<rootDir>/src/tests/__mocks__/apiClientMock.cjs',
    '^.*/api/emulator(\\.js)?$': '<rootDir>/src/tests/__mocks__/apiEmulatorMock.cjs',
  },
  testMatch: ['**/src/tests/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/styles/**',
    '!src/assets/**',
  ],
  coverageDirectory: 'coverage',
};
module.exports = config;
