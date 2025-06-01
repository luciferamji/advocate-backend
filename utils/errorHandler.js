class ErrorResponse extends Error {
  constructor(message, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

module.exports = ErrorResponse;