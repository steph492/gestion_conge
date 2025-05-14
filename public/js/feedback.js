// Modal universel pour les messages
const feedbackModalHTML = `
<div class="modal fade" id="feedbackModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header" id="feedbackModalHeader">
                <div class="modal-icon" id="feedbackModalIcon">
                    <!-- L'icône sera insérée ici -->
                </div>
                <h5 class="modal-title" id="feedbackModalTitle">Message</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="feedbackModalBody">
                <!-- Le message sera inséré ici -->
            </div>
            <div class="modal-footer" id="feedbackModalFooter">
                <!-- Les boutons seront insérés ici -->
            </div>
        </div>
    </div>
</div>`;

// Ajouter le modal au body
document.body.insertAdjacentHTML('beforeend', feedbackModalHTML);

// Fonction pour afficher un message dans le modal
function showFeedbackModal(options) {
    const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    const modalHeader = document.getElementById('feedbackModalHeader');
    const modalIcon = document.getElementById('feedbackModalIcon');
    const modalTitle = document.getElementById('feedbackModalTitle');
    const modalBody = document.getElementById('feedbackModalBody');
    const modalFooter = document.getElementById('feedbackModalFooter');

    // Réinitialiser le contenu
    modalHeader.className = 'modal-header';
    modalIcon.innerHTML = '';
    modalTitle.textContent = options.title || 'Message';
    modalBody.innerHTML = options.message || '';
    modalFooter.innerHTML = '';

    // Ajouter l'icône appropriée
    if (options.type) {
        let iconClass = '';
        let headerClass = '';

        switch(options.type) {
            case 'success':
                iconClass = 'fas fa-check-circle text-success';
                headerClass = 'bg-success bg-opacity-10';
                break;
            case 'error':
                iconClass = 'fas fa-exclamation-triangle text-danger';
                headerClass = 'bg-danger bg-opacity-10';
                break;
            case 'warning':
                iconClass = 'fas fa-exclamation-circle text-warning';
                headerClass = 'bg-warning bg-opacity-10';
                break;
            case 'info':
                iconClass = 'fas fa-info-circle text-info';
                headerClass = 'bg-info bg-opacity-10';
                break;
        }

        // Remplacer l'espace par un tiret pour la classe CSS
        modalHeader.className = 'modal-header ' + headerClass.replace(/\s+/g, '-');
        modalIcon.innerHTML = `<i class="${iconClass} me-2"></i>`;
    }

    // Ajouter les boutons
    if (options.buttons) {
        options.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn ${button.class || 'btn-secondary'}`;
            btn.textContent = button.text;
            if (button.dismiss) {
                btn.setAttribute('data-bs-dismiss', 'modal');
            }
            if (button.onClick) {
                btn.addEventListener('click', button.onClick);
            }
            modalFooter.appendChild(btn);
        });
    } else {
        // Bouton OK par défaut
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-primary';
        btn.textContent = 'OK';
        btn.setAttribute('data-bs-dismiss', 'modal');
        modalFooter.appendChild(btn);
    }

    modal.show();

    // Retourner le modal pour pouvoir le fermer programmatiquement si nécessaire
    return modal;
}

// Fonction pour afficher une confirmation
function showConfirmationModal(options) {
    return showFeedbackModal({
        type: 'warning',
        title: options.title || 'Confirmation',
        message: options.message || 'Êtes-vous sûr de vouloir effectuer cette action ?',
        buttons: [
            {
                text: 'Annuler',
                class: 'btn-secondary',
                dismiss: true
            },
            {
                text: options.confirmText || 'Confirmer',
                class: 'btn-danger',
                onClick: () => {
                    if (options.onConfirm) {
                        options.onConfirm();
                    }
                    bootstrap.Modal.getInstance(document.getElementById('feedbackModal')).hide();
                }
            }
        ]
    });
}
