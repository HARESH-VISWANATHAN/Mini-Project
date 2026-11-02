// Supabase Configuration
const DEFAULT_SUPABASE_URL = 'https://zcqwpucdxjguvoeypkzp.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_6yoiEtNvInFgBR_dBmpzFw_-z2C8We4';

function getSupabaseCredentials() {
    let url = window.localStorage.getItem('SUPABASE_URL');
    let key = window.localStorage.getItem('SUPABASE_ANON_KEY');

    if (!url || url.includes('YOUR_PROJECT_ID')) {
        url = DEFAULT_SUPABASE_URL;
    }
    if (!key || key.includes('YOUR_SUPABASE_ANON_KEY')) {
        key = DEFAULT_SUPABASE_KEY;
    }
    return { url, key };
}

const SUPABASE_CONFIG = getSupabaseCredentials();

function isSupabaseConfigured() {
    const { url, key } = getSupabaseCredentials();
    return !!(url && key && !url.includes('YOUR_PROJECT_ID') && !key.includes('YOUR_SUPABASE_ANON_KEY'));
}

function getSupabaseClient() {
    if (!window.supabase) {
        console.error("Supabase JS library is not loaded.");
        return null;
    }
    const { url, key } = getSupabaseCredentials();

    if (!isSupabaseConfigured()) {
        return null;
    }

    try {
        return window.supabase.createClient(url, key);
    } catch (err) {
        console.error("Error creating Supabase client:", err);
        return null;
    }
}
