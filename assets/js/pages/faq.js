// ===== FAQ PAGE LOGIC =====

const accordionHeaders = document.querySelectorAll('.accordion-header');
const faqSearch = document.getElementById('faq-search');
const categoryButtons = document.querySelectorAll('.filter-btn');
const faqContainer = document.getElementById('faq-container');

let currentCategory = 'all';

// ===== ACCORDION FUNCTIONALITY =====
accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
        const item = header.parentElement;
        const content = item.querySelector('.accordion-content');
        const icon = header.querySelector('i');
        
        // Close all other items
        accordionHeaders.forEach(otherHeader => {
            if (otherHeader !== header) {
                const otherItem = otherHeader.parentElement;
                const otherContent = otherItem.querySelector('.accordion-content');
                const otherIcon = otherHeader.querySelector('i');

                otherContent?.classList.remove('open');
                if (otherIcon) {
                    otherIcon.style.transform = 'rotate(0deg)';
                }
            }
        });
        
        // Toggle current item
        content?.classList.toggle('open');
        if (icon && content) {
            icon.style.transform = content.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });
});

// ===== CATEGORY FILTER =====
categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active button
        categoryButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        currentCategory = button.dataset.category;
        filterFAQs();
    });
});

// ===== SEARCH FUNCTIONALITY =====
if (faqSearch) {
    faqSearch.addEventListener('input', (e) => {
        filterFAQs(e.target.value.toLowerCase());
    });
}

// ===== FILTER FAQS =====
function filterFAQs(searchTerm = '') {
    const items = document.querySelectorAll('.accordion-item');
    let visibleCount = 0;
    
    items.forEach(item => {
        const category = item.dataset.category;
        const text = item.textContent.toLowerCase();
        
        const categoryMatch = currentCategory === 'all' || category === currentCategory;
        const searchMatch = searchTerm === '' || text.includes(searchTerm);
        
        if (categoryMatch && searchMatch) {
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Show message if no results
    if (visibleCount === 0 && !document.getElementById('no-results')) {
        const noResults = document.createElement('div');
        noResults.id = 'no-results';
        noResults.className = 'text-center py-12 text-gray-500';
        noResults.innerHTML = `
            <i data-lucide="search-x" class="w-16 h-16 mx-auto mb-4 text-gray-300"></i>
            <p class="text-lg font-semibold">Nenhuma pergunta encontrada</p>
            <p class="text-sm">Tente ajustar a sua pesquisa ou categoria</p>
        `;
        faqContainer.appendChild(noResults);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } else if (visibleCount > 0) {
        const noResults = document.getElementById('no-results');
        if (noResults) {
            noResults.remove();
        }
    }
}

// ===== CHECK URL HASH =====
window.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetItem = document.getElementById(targetId);
        
        if (targetItem && targetItem.classList.contains('accordion-item')) {
            setTimeout(() => {
                targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const header = targetItem.querySelector('.accordion-header');
                if (header) {
                    header.click();
                }
            }, 300);
        }
    }
});
