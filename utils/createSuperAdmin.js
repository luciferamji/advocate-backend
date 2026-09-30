const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Admin } = require('../models');

const SEED_ADMINS = [
  { name: 'AbhiJeet Chakraborty', email: 'abhijeet.chakraborty01@gmail.com' },
  { name: 'Akshat Jaitly', email: 'akshatjaitly@gmail.com' }
];

// Seeds the initial super-admins ONLY when no super-admin exists yet.
// Existing accounts and passwords are never touched.
// Password: SUPER_ADMIN_PASSWORD from the environment, or a random one per
// account that is printed once to the server log (change it after first login).
const createSuperAdmin = async () => {
  try {
    const superAdmin = await Admin.findOne({ where: { role: 'super-admin' } });
    if (superAdmin) return;

    const envPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (envPassword && envPassword.length < 12) {
      console.error('SUPER_ADMIN_PASSWORD must be at least 12 characters; super admin not created.');
      return;
    }

    for (const seed of SEED_ADMINS) {
      const existing = await Admin.findOne({ where: { email: seed.email } });
      if (existing) continue;

      const password = envPassword || crypto.randomBytes(18).toString('base64url');
      const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

      await Admin.create({
        name: seed.name,
        email: seed.email,
        password: hashedPassword,
        role: 'super-admin'
      });

      if (envPassword) {
        console.log(`Super admin created: ${seed.email} (password from SUPER_ADMIN_PASSWORD)`);
      } else {
        console.log(`Super admin created: ${seed.email} — one-time generated password: ${password} (shown only once; change it after first login)`);
      }
    }
  } catch (error) {
    console.error('Error creating super admin:', error);
  }
};

module.exports = createSuperAdmin;
