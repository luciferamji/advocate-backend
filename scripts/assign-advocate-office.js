/**
 * Assign an advocate to a handling office (one office per advocate).
 * The same can be done in the app: Advocates -> Edit -> Office.
 *
 * Usage:
 *   node scripts/assign-advocate-office.js --list
 *   node scripts/assign-advocate-office.js --email advocate@example.com --office Delhi
 *
 * Office names are matched case-insensitively ("Bangalore" == "Bengaluru").
 */
const { Admin, HandlingOffice, sequelize } = require('../models');
const { officeKey } = require('../utils/offices');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const offices = await HandlingOffice.findAll({ order: [['name', 'ASC']] });

  if (process.argv.includes('--list')) {
    const advocates = await Admin.findAll({
      where: { role: 'advocate' },
      include: [{ model: HandlingOffice, as: 'handlingOffice', attributes: ['name'] }],
      order: [['name', 'ASC']]
    });
    console.log('Offices:', offices.map(o => `${o.name}${o.status === 'active' ? '' : ' (inactive)'}`).join(', '));
    advocates.forEach(a => console.log(`${a.handlingOffice ? a.handlingOffice.name.padEnd(12) : '(no office) '} ${a.status.padEnd(8)} ${a.name} <${a.email}>`));
    return;
  }

  const email = arg('email');
  const officeName = arg('office');
  if (!email || !officeName) {
    throw new Error('Usage: --email <advocate email> --office <office name>   (or --list)');
  }

  const office = offices.find(o => o.status === 'active' && officeKey(o.name) === officeKey(officeName));
  if (!office) throw new Error(`No active office named "${officeName}"`);

  const advocate = await Admin.findOne({ where: { email: email.trim().toLowerCase(), role: 'advocate' } })
    || await Admin.findOne({ where: { email: email.trim(), role: 'advocate' } });
  if (!advocate) throw new Error(`No advocate with email ${email}`);

  await advocate.update({ handlingOfficeId: office.id });
  console.log(`✓ ${advocate.name} <${advocate.email}> -> ${office.name}`);
}

main()
  .then(() => sequelize.close())
  .then(() => process.exit(0))
  .catch((err) => { console.error('✗', err.message); process.exit(1); });
