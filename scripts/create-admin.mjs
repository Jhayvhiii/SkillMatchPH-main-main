// scripts/create-admin.mjs
// Script to provision the administrator account for SkillMatchPH
// via Supabase Admin API (requires SUPABASE_SERVICE_ROLE_KEY) or SQL.

import fs from 'node:fs';
import path from 'node:path';

const ADMIN_DETAILS = {
  firstName: 'skill',
  lastName: 'match',
  username: 'skillmatchph',
  email: 'skillmatchph76@gmail.com',
  password: '12345678',
  role: 'admin',
  status: 'approved',
};

// Load env files (.env.local or .env)
const envFiles = ['.env.local', '.env'];
const envVars = {};
for (const file of envFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envVars[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log('====================================================');
console.log('SkillMatchPH - Admin Account Provisioning');
console.log('====================================================');
console.log('Target account:');
console.log(`  Name      : ${ADMIN_DETAILS.firstName} ${ADMIN_DETAILS.lastName}`);
console.log(`  Username  : ${ADMIN_DETAILS.username}`);
console.log(`  Email     : ${ADMIN_DETAILS.email}`);
console.log(`  Password  : ${ADMIN_DETAILS.password}`);
console.log(`  Role      : ${ADMIN_DETAILS.role}`);
console.log(`  Status    : ${ADMIN_DETAILS.status}`);
console.log('====================================================\n');

async function run() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('ℹ️  No SUPABASE_SERVICE_ROLE_KEY detected in .env or .env.local.');
    console.log('To add this admin account immediately:');
    console.log('  1. Open your Supabase Dashboard: https://supabase.com/dashboard');
    console.log('  2. Go to SQL Editor');
    console.log('  3. Open and run the generated SQL script:');
    console.log('     supabase/add_admin_account.sql\n');
    console.log('Once executed, the account will be created and ready for sign-in!');
    return;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log(`Connecting to Supabase at: ${supabaseUrl}...`);

    // Check if user already exists
    const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    let targetUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === ADMIN_DETAILS.email.toLowerCase()
    );

    if (targetUser) {
      console.log(`User ${ADMIN_DETAILS.email} already exists (ID: ${targetUser.id}). Updating password and metadata...`);
      const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
        password: ADMIN_DETAILS.password,
        email_confirm: true,
        user_metadata: {
          first_name: ADMIN_DETAILS.firstName,
          last_name: ADMIN_DETAILS.lastName,
          username: ADMIN_DETAILS.username,
        },
      });
      if (updateError) throw updateError;
      targetUser = updated.user;
    } else {
      console.log(`Creating new user ${ADMIN_DETAILS.email}...`);
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_DETAILS.email,
        password: ADMIN_DETAILS.password,
        email_confirm: true,
        user_metadata: {
          first_name: ADMIN_DETAILS.firstName,
          last_name: ADMIN_DETAILS.lastName,
          username: ADMIN_DETAILS.username,
        },
      });
      if (createError) throw createError;
      targetUser = created.user;
    }

    console.log(`Upserting profile for user ${targetUser.id} in public.profiles...`);
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: targetUser.id,
        first_name: ADMIN_DETAILS.firstName,
        last_name: ADMIN_DETAILS.lastName,
        student_no: `ADMIN-${targetUser.id}`,
        grade_level: 11,
        shs_track: 'Academic',
        shs_strand: 'STEM',
        username: ADMIN_DETAILS.username,
        role: ADMIN_DETAILS.role,
        status: ADMIN_DETAILS.status,
      }, { onConflict: 'id' });

    if (profileError) {
      console.warn(`Profile upsert returned error: ${profileError.message}`);
      console.log('You may need to run supabase/add_admin_account.sql in the Supabase SQL editor to bypass triggers.');
    } else {
      console.log('✅ Administrator account successfully created and activated!');
      console.log(`You can now sign in with username "${ADMIN_DETAILS.username}" and password "${ADMIN_DETAILS.password}".`);
    }
  } catch (err) {
    console.error('Error during provisioning:', err.message || err);
    console.log('\nPlease run the SQL script in your Supabase SQL Editor:');
    console.log('  supabase/add_admin_account.sql');
  }
}

run();

