const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nzwfquivulxkmxrwqalz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin123@iberflag.pt';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function buildHeaders() {
    return {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
    };
}

async function readJson(response) {
    const text = await response.text();
    try {
        return { text, json: JSON.parse(text) };
    } catch {
        return { text, json: null };
    }
}

async function listUsers() {
    let page = 1;
    while (page < 10) {
        const url = `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`;
        const response = await fetch(url, { headers: buildHeaders() });
        const { text, json } = await readJson(response);

        if (!response.ok) {
            throw new Error(`Falha ao listar utilizadores (${response.status}): ${text}`);
        }

        const users = Array.isArray(json?.users) ? json.users : [];
        const match = users.find((user) => String(user?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase());
        if (match) {
            return match;
        }

        if (users.length === 0) {
            return null;
        }

        page += 1;
    }

    return null;
}

async function createUser() {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true
        })
    });

    const { text, json } = await readJson(response);
    if (!response.ok) {
        const errorMsg = json?.msg || json?.message || text || 'Erro desconhecido';
        throw new Error(`Falha ao criar utilizador (${response.status}): ${errorMsg}`);
    }

    return json?.user || json;
}

async function updatePassword(userId) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({
            password: ADMIN_PASSWORD,
            email_confirm: true
        })
    });

    const { text, json } = await readJson(response);
    if (!response.ok) {
        const errorMsg = json?.msg || json?.message || text || 'Erro desconhecido';
        throw new Error(`Falha ao atualizar password (${response.status}): ${errorMsg}`);
    }

    return json?.user || json;
}

async function main() {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY. Sem essa chave nao e possivel criar o utilizador admin.');
    }

    if (ADMIN_PASSWORD.length < 6) {
        throw new Error('A password de teste precisa de ter pelo menos 6 caracteres no Supabase Auth.');
    }

    console.log(`A preparar utilizador admin: ${ADMIN_EMAIL}`);

    const existingUser = await listUsers();
    if (existingUser) {
        await updatePassword(existingUser.id);
        console.log(`Password atualizada para o utilizador existente: ${ADMIN_EMAIL}`);
        return;
    }

    await createUser();
    console.log(`Utilizador criado com sucesso: ${ADMIN_EMAIL}`);
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
