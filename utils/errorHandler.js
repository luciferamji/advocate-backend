class ErrorResponse extends Error {
  constructor(message, code = 'INTERNAL_ERROR', details = null, statusCode = undefined) {
    super(message);
    this.code = code;
    this.details = details;
    if (statusCode) this.statusCode = statusCode;
  }
}

module.exports = ErrorResponse;
