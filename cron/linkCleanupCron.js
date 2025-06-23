const cron = require('node-cron');
const { Op } = require('sequelize');
const { UploadLink } = require('../models');

const cronFunction = async () => {
    try {
        const now = new Date();

        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);

        const deletedCount = await UploadLink.destroy({
            where: {
                [Op.or]: [
                    { used: true },
                    {
                        expiresAt: {
                            [Op.lt]: yesterdayStart
                        }
                    }
                ]
            }
        });

        console.log(`[${new Date().toISOString()}] Deleted ${deletedCount} upload links (used OR expired exactly 1 day ago).`);
    } catch (error) {
        console.error('Upload link cleanup failed:', error);
    }
}

cron.schedule('0 23 * * *', cronFunction, {
  timezone: 'Asia/Kolkata'
});