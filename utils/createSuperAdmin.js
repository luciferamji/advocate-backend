const bcrypt = require('bcryptjs');
const { Admin } = require('../models');

const createSuperAdmin = async () => {
  try {
    // Check if super admin exists
    const superAdmin = await Admin.findOne({
      where: { role: 'super-admin' }
    });

    if (!superAdmin) {
      // Create super admin if doesn't exist
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      await Admin.create({
        name: 'Super Admin',
        email: 'abhijeet.chakraborty01@gmail.com',
        password: hashedPassword,
        role: 'super-admin'
      });
      await Admin.create({
        name: 'Super Admin',
        email: 'akshatjaitly@gmail.com',
        password: hashedPassword,
        role: 'super-admin'
      });

      console.log('Super admin created successfully');

    }
  } catch (error) {
    console.error('Error creating super admin:', error);
  }
};

module.exports = createSuperAdmin;