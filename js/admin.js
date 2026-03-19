// ===== ADMIN PANEL LOGIC =====

let currentTab = 'dashboard';
let currentProductId = null;
let currentContactId = null;

// ===== DOM ELEMENTS =====
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const productModal = document.getElementById('product-modal');
const contactModal = document.getElementById('contact-modal');
const productForm = document.getElementById('product-form');
const addProductBtn = document.getElementById('add-product-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');
const closeContactModalBtns = document.querySelectorAll('.close-contact-modal');
const markRespondedBtn = document.getElementById('mark-responded');
const adminModals = [productModal, contactModal].filter(Boolean);

function updateModalBodyLock() {
    const hasOpenModal = adminModals.some((modal) => !modal.classList.contains('hidden'));
    document.body.style.overflow = hasOpenModal ? 'hidden' : '';
}

function openModal(modal) {
    if (!modal) return;
    closeAllModals();
    modal.classList.remove('hidden');
    updateModalBodyLock();
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    updateModalBodyLock();
}

function closeAllModals() {
    adminModals.forEach((modal) => modal.classList.add('hidden'));
    updateModalBodyLock();
}

// ===== TAB NAVIGATION =====
navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    currentTab = tabName;
    closeAllModals();
    
    // Update active tab
    navTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active', 'bg-blue-50', 'text-blue-600');
        } else {
            tab.classList.remove('active', 'bg-blue-50', 'text-blue-600');
        }
    });
    
    // Show/hide panels
    tabPanels.forEach(panel => {
        if (panel.id === `${tabName}-tab`) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });
    
    // Load data for the tab
    loadTabData(tabName);
}

// ===== LOAD TAB DATA =====
async function loadTabData(tabName) {
    switch(tabName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'produtos':
            await loadProducts();
            break;
        case 'encomendas':
            await loadOrders();
            break;
        case 'clientes':
            await loadClients();
            break;
        case 'contactos':
            await loadContacts();
            break;
    }
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        // Load stats
        const [produtos, encomendas, clientes, contactos] = await Promise.all([
            supabaseClient.from('produtos').select('*', { count: 'exact' }),
            supabaseClient.from('encomendas').select('*', { count: 'exact' }),
            supabaseClient.from('clientes').select('*', { count: 'exact' }),
            supabaseClient.from('contactos').select('*', { count: 'exact' })
        ]);
        
        document.getElementById('stat-produtos').textContent = produtos.count || 0;
        document.getElementById('stat-encomendas').textContent = encomendas.count || 0;
        document.getElementById('stat-clientes').textContent = clientes.count || 0;
        document.getElementById('stat-contactos').textContent = contactos.count || 0;
        
        // Load featured products
        const { data: featured } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('destaque', true)
            .limit(5);
        
        const featuredContainer = document.getElementById('featured-products');
        if (featured && featured.length > 0) {
            featuredContainer.innerHTML = featured.map(p => `
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <img src="${p.imagem}" alt="${p.nome}" class="w-12 h-12 object-cover rounded">
                    <div class="flex-1">
                        <h4 class="font-semibold text-sm">${p.nome}</h4>
                        <p class="text-xs text-gray-600">${p.preco.toFixed(2)}€</p>
                    </div>
                    <span class="badge badge-info">${p.categoria}</span>
                </div>
            `).join('');
        } else {
            featuredContainer.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum produto em destaque</p>';
        }
        
        // Load recent contacts
        const { data: contacts } = await supabaseClient
            .from('contactos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        const contactsContainer = document.getElementById('recent-contacts');
        if (contacts && contacts.length > 0) {
            contactsContainer.innerHTML = contacts.map(c => `
                <div class="p-3 bg-gray-50 rounded-lg">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-semibold text-sm">${c.nome}</h4>
                        <span class="badge ${c.respondido ? 'badge-success' : 'badge-warning'}">${c.respondido ? 'Respondido' : 'Pendente'}</span>
                    </div>
                    <p class="text-xs text-gray-600">${c.assunto}</p>
                    <p class="text-xs text-gray-400 mt-1">${new Date(c.created_at).toLocaleDateString('pt-PT')}</p>
                </div>
            `).join('');
        } else {
            contactsContainer.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum contacto recente</p>';
        }
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showToast('Erro ao carregar dashboard', 'error');
    }
}

// ===== PRODUCTS =====
async function loadProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('products-tbody');
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><img src="${p.imagem}" alt="${p.nome}" class="w-12 h-12 object-cover rounded"></td>
                    <td class="font-semibold">${p.nome}</td>
                    <td><span class="badge badge-info">${p.categoria}</span></td>
                    <td class="font-bold text-blue-600">${p.preco.toFixed(2)}€</td>
                    <td>${p.stock || 0}</td>
                    <td>${p.destaque ? '<span class="badge badge-warning">Sim</span>' : '<span class="badge">Não</span>'}</td>
                    <td>${p.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                    <td>
                        <div class="flex gap-2">
                            <button onclick="editProduct(${p.id})" class="text-blue-600 hover:text-blue-800" title="Editar">
                                <i data-lucide="edit" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteProduct(${p.id})" class="text-red-600 hover:text-red-800" title="Eliminar">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400">Nenhum produto encontrado</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showToast('Erro ao carregar produtos', 'error');
    }
}

// ===== PRODUCT MODAL =====
if (addProductBtn) {
    addProductBtn.addEventListener('click', () => {
        currentProductId = null;
        document.getElementById('modal-title').textContent = 'Adicionar Produto';
        productForm.reset();
        document.getElementById('product-ativo').checked = true;
        openModal(productModal);
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        closeModal(productModal);
    });
}

if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', () => {
        closeModal(productModal);
    });
}

// ===== SVG FILE UPLOAD HANDLER =====
let svgTemplateContent = null;

const svgUpload = document.getElementById('product-svg-upload');
const svgPreview = document.getElementById('svg-preview');
const svgPreviewContent = document.getElementById('svg-preview-content');

if (svgUpload) {
    svgUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
            svgTemplateContent = null;
            svgPreview.classList.add('hidden');
            return;
        }
        
        if (!file.name.endsWith('.svg')) {
            showToast('Por favor selecione um ficheiro SVG', 'error');
            svgUpload.value = '';
            return;
        }
        
        try {
            const text = await file.text();
            svgTemplateContent = text;
            
            // Show preview
            svgPreview.classList.remove('hidden');
            svgPreviewContent.innerHTML = text.substring(0, 200) + '...';
            
            showToast('SVG carregado com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao ler ficheiro SVG:', error);
            showToast('Erro ao ler ficheiro SVG', 'error');
        }
    });
}

// ===== PRODUCT FORM SUBMIT =====
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const productData = {
            nome: document.getElementById('product-nome').value,
            descricao: document.getElementById('product-descricao').value,
            preco: parseFloat(document.getElementById('product-preco').value),
            categoria: document.getElementById('product-categoria').value,
            imagem: document.getElementById('product-imagem').value,
            svg_template: svgTemplateContent || null,
            stock: parseInt(document.getElementById('product-stock').value) || 0,
            destaque: document.getElementById('product-destaque').checked,
            ativo: document.getElementById('product-ativo').checked
        };
        
        try {
            let result;
            
            if (currentProductId) {
                // Update
                result = await supabaseClient
                    .from('produtos')
                    .update(productData)
                    .eq('id', currentProductId);
            } else {
                // Insert
                result = await supabaseClient
                    .from('produtos')
                    .insert([productData]);
            }
            
            if (result.error) throw result.error;
            
            showToast(currentProductId ? 'Produto atualizado com sucesso!' : 'Produto adicionado com sucesso!', 'success');
            closeModal(productModal);
            svgTemplateContent = null;
            svgUpload.value = '';
            svgPreview.classList.add('hidden');
            loadProducts();
            
        } catch (error) {
            console.error('Erro ao guardar produto:', error);
            showToast('Erro ao guardar produto', 'error');
        }
    });
}

// ===== EDIT PRODUCT =====
async function editProduct(id) {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        currentProductId = id;
        document.getElementById('modal-title').textContent = 'Editar Produto';
        document.getElementById('product-nome').value = data.nome;
        document.getElementById('product-descricao').value = data.descricao;
        document.getElementById('product-preco').value = data.preco;
        document.getElementById('product-categoria').value = data.categoria;
        document.getElementById('product-imagem').value = data.imagem;
        document.getElementById('product-stock').value = data.stock || 0;
        document.getElementById('product-destaque').checked = data.destaque;
        document.getElementById('product-ativo').checked = data.ativo;
        
        // Load existing SVG template
        if (data.svg_template) {
            svgTemplateContent = data.svg_template;
            svgPreview.classList.remove('hidden');
            svgPreviewContent.innerHTML = data.svg_template.substring(0, 200) + '...';
        } else {
            svgTemplateContent = null;
            svgPreview.classList.add('hidden');
        }
        
        openModal(productModal);
        
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        showToast('Erro ao carregar produto', 'error');
    }
}

// ===== DELETE PRODUCT =====
async function deleteProduct(id) {
    if (!confirm('Tem a certeza que deseja eliminar este produto?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('produtos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('Produto eliminado com sucesso!', 'success');
        loadProducts();
        
    } catch (error) {
        console.error('Erro ao eliminar produto:', error);
        showToast('Erro ao eliminar produto', 'error');
    }
}

// ===== ORDERS =====
async function loadOrders() {
    try {
        const { data, error } = await supabaseClient
            .from('encomendas')
            .select('*, clientes(*)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('orders-tbody');
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(o => `
                <tr>
                    <td class="font-semibold">${o.numero_encomenda}</td>
                    <td>${o.clientes?.nome || 'N/A'}</td>
                    <td>${new Date(o.created_at).toLocaleDateString('pt-PT')}</td>
                    <td class="font-bold text-blue-600">${o.total.toFixed(2)}€</td>
                    <td><span class="badge badge-${getStatusColor(o.status)}">${o.status}</span></td>
                    <td>
                        <button onclick="viewOrder('${o.id}')" class="text-blue-600 hover:text-blue-800">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Nenhuma encomenda encontrada</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar encomendas:', error);
    }
}

// ===== CLIENTS =====
async function loadClients() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('clients-tbody');
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td class="font-semibold">${c.nome}</td>
                    <td>${c.email}</td>
                    <td>${c.telefone || 'N/A'}</td>
                    <td>${c.empresa || 'N/A'}</td>
                    <td>${new Date(c.created_at).toLocaleDateString('pt-PT')}</td>
                    <td>
                        <button onclick="viewClient('${c.id}')" class="text-blue-600 hover:text-blue-800">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Nenhum cliente encontrado</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

// ===== CONTACTS =====
async function loadContacts() {
    try {
        const { data, error } = await supabaseClient
            .from('contactos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('contacts-tbody');
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td>${new Date(c.created_at).toLocaleDateString('pt-PT')}</td>
                    <td class="font-semibold">${c.nome}</td>
                    <td>${c.email}</td>
                    <td>${c.assunto}</td>
                    <td><span class="badge ${c.respondido ? 'badge-success' : 'badge-warning'}">${c.respondido ? 'Respondido' : 'Pendente'}</span></td>
                    <td>
                        <button onclick="viewContact(${c.id})" class="text-blue-600 hover:text-blue-800">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Nenhum contacto encontrado</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar contactos:', error);
    }
}

// ===== VIEW CONTACT =====
async function viewContact(id) {
    try {
        const { data, error } = await supabaseClient
            .from('contactos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        currentContactId = id;
        
        const detailsContainer = document.getElementById('contact-details');
        detailsContainer.innerHTML = `
            <div>
                <label class="form-label">Nome</label>
                <p class="text-gray-900 font-semibold">${data.nome}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Email</label>
                    <p class="text-gray-900">${data.email}</p>
                </div>
                <div>
                    <label class="form-label">Telefone</label>
                    <p class="text-gray-900">${data.telefone || 'N/A'}</p>
                </div>
            </div>
            <div>
                <label class="form-label">Assunto</label>
                <p class="text-gray-900">${data.assunto}</p>
            </div>
            <div>
                <label class="form-label">Mensagem</label>
                <p class="text-gray-900 bg-gray-50 p-4 rounded-lg">${data.mensagem}</p>
            </div>
            <div>
                <label class="form-label">Data</label>
                <p class="text-gray-900">${new Date(data.created_at).toLocaleString('pt-PT')}</p>
            </div>
            <div>
                <label class="form-label">Status</label>
                <p><span class="badge ${data.respondido ? 'badge-success' : 'badge-warning'}">${data.respondido ? 'Respondido' : 'Pendente'}</span></p>
            </div>
        `;
        
        openModal(contactModal);
        
    } catch (error) {
        console.error('Erro ao carregar contacto:', error);
        showToast('Erro ao carregar contacto', 'error');
    }
}

// ===== MARK CONTACT AS RESPONDED =====
if (markRespondedBtn) {
    markRespondedBtn.addEventListener('click', async () => {
        if (!currentContactId) return;
        
        try {
            const { error } = await supabaseClient
                .from('contactos')
                .update({ respondido: true })
                .eq('id', currentContactId);
            
            if (error) throw error;
            
            showToast('Contacto marcado como respondido!', 'success');
            closeModal(contactModal);
            loadContacts();
            
        } catch (error) {
            console.error('Erro ao atualizar contacto:', error);
            showToast('Erro ao atualizar contacto', 'error');
        }
    });
}

// Close contact modal
closeContactModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(contactModal);
    });
});

adminModals.forEach((modal) => {
    modal.addEventListener('mousedown', (event) => {
        if (event.target === modal) {
            closeModal(modal);
        }
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAllModals();
    }
});

// ===== HELPER FUNCTIONS =====
function getStatusColor(status) {
    const colors = {
        'pendente': 'warning',
        'processando': 'info',
        'concluido': 'success',
        'cancelado': 'danger'
    };
    return colors[status] || 'info';
}

function viewOrder(id) {
    showToast('Funcionalidade de visualização de encomenda em desenvolvimento', 'info');
}

function viewClient(id) {
    showToast('Funcionalidade de visualização de cliente em desenvolvimento', 'info');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    closeAllModals();
    loadDashboard();
});

// Make functions globally available
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewContact = viewContact;
window.viewOrder = viewOrder;
window.viewClient = viewClient;
