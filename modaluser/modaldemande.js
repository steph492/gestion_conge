document.addEventListener("DOMContentLoaded", () => {
    // Créer l’élément modal et l'ajouter au body directement
    const modalHTML = `
      <div class="modal fade" id="modalDemande" tabindex="-1" aria-labelledby="modalDemandeLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl">
          <form id="formDemande" class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modalDemandeLabel">Nouvelle demande de congé</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body row g-3">
              <div class="col-md-6">
                <label class="form-label">Type de congé</label>
                <select class="form-select" name="type_conge" required>
                  <option value="conges">Congés payés</option>
                  <option value="rtt">RTT</option>
                  <option value="maladie">Maladie</option>
                  <option value="permission">Permission</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Motif</label>
                <input type="text" class="form-control" name="motif" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">Date début</label>
                <input type="date" class="form-control" name="date_debut" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">Date fin</label>
                <input type="date" class="form-control" name="date_fin" required>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
              <button type="submit" class="btn btn-primary">Envoyer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = modalHTML.trim();
    document.body.appendChild(tempDiv.firstChild); // Ajouter directement au <body>
  
    // Afficher le modal quand on clique sur un bouton avec l’ID "btnOuvrirModal"
    document.getElementById("btnOuvrirModal").addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("modalDemande"));
      modal.show();
    });
  
    // Gestion de la soumission AJAX
    document.getElementById("formDemande").addEventListener("submit", async function (e) {
      e.preventDefault();
  
      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());
  
      try {
        const response = await fetch('/navigationuser/demande', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
  
        const result = await response.json();
  
        if (response.ok) {
          alert("Demande envoyée avec succès !");
          bootstrap.Modal.getInstance(document.getElementById("modalDemande")).hide();
          this.reset();
          // Optionnel : rafraîchir la liste des demandes
        } else {
          alert(result.message || "Erreur lors de l'envoi");
        }
  
      } catch (err) {
        console.error(err);
        alert("Une erreur est survenue.");
      }
    });
  });
  