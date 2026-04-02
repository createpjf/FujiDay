class FujiDayError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'FujiDayError';
    this.code = code;
    this.details = details;
  }
}

function toErrorResult(error) {
  if (error instanceof FujiDayError) {
    return {
      status: 'error',
      error_code: error.code,
      message: error.message,
      details: error.details
    };
  }

  return {
    status: 'error',
    error_code: 'UNEXPECTED_ERROR',
    message: error?.message || 'Unknown error.',
    details: null
  };
}

module.exports = {
  FujiDayError,
  toErrorResult
};
