const path = require('path');
const fs = require('fs-extra');

/**
 * Moves a file from /uploads/temp to /uploads based on its final path
 * @param {string} finalPath - The final URL path (e.g., /uploads/filename.jpg)
 */
exports.moveFileFromTemp = async (finalPath) => {
  try {
    const fileName = path.basename(finalPath);
    const sourcePath = path.join(__dirname, '..', process.env.UPLOAD_DIR, 'temp', fileName);
    const destinationPath = path.join(__dirname, '..', process.env.UPLOAD_DIR, fileName);

    await fs.ensureDir(path.dirname(destinationPath));
    await fs.move(sourcePath, destinationPath, { overwrite: true });

    return { success: true, path: destinationPath };
  } catch (error) {
    console.log('Error moving file:', error);
    return { success: false, error: error.message };
  }
};
