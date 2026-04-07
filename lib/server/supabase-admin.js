const { createClient } = require('@supabase/supabase-js');

let adminClient = null;

function getSupabaseAdmin() {
    if (adminClient) {
        return adminClient;
    }

    const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!url || !serviceRoleKey) {
        const error = new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
        error.code = 'SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED';
        throw error;
    }

    adminClient = createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return adminClient;
}

module.exports = {
    getSupabaseAdmin
};
