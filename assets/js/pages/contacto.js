// ===== CONTACT FORM LOGIC =====

const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner mx-auto"></div>';
        
        // Get form data
        const formData = new FormData(contactForm);
        const data = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            telefone: formData.get('telefone') || null,
            assunto: formData.get('assunto'),
            mensagem: formData.get('mensagem')
        };
        
        try {
            // Insert into Supabase
            const { error } = await supabaseClient
                .from('contactos')
                .insert([data]);
            
            if (error) throw error;
            
            // Success
            showToast('Mensagem enviada com sucesso! Entraremos em contacto brevemente.', 'success');
            contactForm.reset();
            
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            showToast('Erro ao enviar mensagem. Por favor, tente novamente ou contacte-nos por telefone.', 'error');
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    });
}
