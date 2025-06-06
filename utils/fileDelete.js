const fs = require('fs-extra');
const path = require('path');
const UPLOADS_DIR = path.join(process.env.UPLOAD_DIR || 'uploads');
/**
 * Deletes a file from the given file path.
 * @param {string} filePath - Absolute or relative path to the file.
 * @returns {Promise<void>}
 */
exports.deleteFile = async (filePath) => {
  try {
    const resolvedPath = path.join(__dirname, '..', filePath);
    const exists = await fs.pathExists(resolvedPath);

    if (exists) {
      await fs.remove(resolvedPath);
      console.log(`Deleted file: ${resolvedPath}`);
    } else {
      console.warn(`File not found: ${resolvedPath}`);
    }
  } catch (err) {
    console.error(`Failed to delete file: ${filePath}`, err);
  }
};

