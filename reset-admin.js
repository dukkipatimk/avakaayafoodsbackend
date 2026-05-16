// One-off admin password reset.
//   node reset-admin.js [email] <newPassword>
// Resets the password for an existing user (creating the admin if missing).
// The User model's bcrypt hook hashes the password on save.
// Run against the SAME database the live API uses, then delete this file.

require('dotenv').config();
const sequelize = require('./config/db');
const { User } = require('./models');

(async () => {
  const email = process.argv.length > 3 ? process.argv[2] : 'admin@avakaayafoods.com';
  const newPassword = process.argv.length > 3 ? process.argv[3] : process.argv[2];

  if (!newPassword || newPassword.length < 6) {
    console.error('Usage: node reset-admin.js [email] <newPassword>   (password must be at least 6 characters)');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log(`Connected to MySQL DB "${process.env.MYSQL_DB}" on ${process.env.MYSQL_HOST}`);

    let user = await User.findOne({ where: { email } });

    if (user) {
      user.password = newPassword; // triggers beforeUpdate hook -> bcrypt hash
      user.role = 'admin';
      await user.save();
      console.log(`Password reset for existing user: ${email}`);
    } else {
      user = await User.create({ name: 'Admin', email, password: newPassword, role: 'admin' });
      console.log(`Admin user created: ${email}`);
    }

    console.log(`Login with:  ${email}  /  ${newPassword}`);
    process.exit(0);
  } catch (err) {
    console.error('Reset failed:', err.message);
    process.exit(1);
  }
})();
