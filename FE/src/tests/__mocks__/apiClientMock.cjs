// Jest mock for src/api/client.js — replaces import.meta.env with a safe stub
module.exports = {
  API_BASE_URL: 'http://localhost:8000/api',
  getToken: jest.fn(() => null),
  setToken: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
  refreshAccessToken: jest.fn(() => Promise.resolve('mock-token')),
  request: jest.fn(() => Promise.resolve({})),
  requestFile: jest.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {
    constructor(message, status, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
};
