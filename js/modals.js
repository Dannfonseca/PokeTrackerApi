// TODOLISTPOKEMON/js/modals.js
/**
 * Gerencia a lógica específica para os modais da aplicação:
 * - Adicionar Pokémon: Abre/fecha, carrega clãs, trata submit do form.
 * - Adicionar Treinador (Formulário): Abre/fecha, trata submit do form.
 * - Gerenciar Treinadores (Lista): Abre/fecha, busca/lista treinadores, trata exclusão.
 * - Devolução Parcial: Abre/fecha, lista pokémons, trata seleção, senha e confirmação.
 */
import { dom } from './domElements.js';
import { clanData } from './config.js';
// Importa TODAS as funções de API necessárias
import {
    addPokemonAPI, fetchActiveHistory, returnPokemonAPI, fetchAllHistory,
    addTrainerAPI, fetchTrainersAPI, deleteTrainerAPI // Novas APIs de Treinador
} from './api.js';
import { displayError, displaySuccess, showSpinner, hideSpinner } from './ui.js';
import { getState, setActiveHistoryGroupIndex, setPartialReturnSelection, togglePartialReturnSelection, clearPartialReturnSelection } from './state.js';
import { renderActivePokemons } from './homeView.js';
import { loadClanView } from './clanView.js';

// --- Constante local para senha Admin ---
// Usada APENAS para o prompt no frontend antes de chamar a API de delete.
// A validação REAL acontece no backend.
const LOCAL_ADMIN_PASSWORD_FOR_CHECK = 'raito123';


// --- Modal Adicionar Pokémon ---
export function openAddPokemonModal() {
    loadClansInModalSelect();
    if (dom.addPokemonModal) dom.addPokemonModal.style.display = 'flex';
    if(dom.addPokemonForm) dom.addPokemonForm.reset();
    if(dom.newPokemonNameInput) dom.newPokemonNameInput.focus();
}
export function closeAddPokemonModal() {
    if(dom.addPokemonModal) dom.addPokemonModal.style.display = 'none';
    if(dom.addPokemonForm) dom.addPokemonForm.reset();
}
function loadClansInModalSelect() {
    if (!dom.clanSelectInput) return;
    dom.clanSelectInput.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; defaultOption.textContent = 'Selecione um Clã...';
    defaultOption.disabled = true; defaultOption.selected = true;
    dom.clanSelectInput.appendChild(defaultOption);
    // Adiciona clãs do config.js ao select
    Object.keys(clanData).sort().forEach(clanKey => { // Ordena alfabeticamente
        const option = document.createElement('option');
        option.value = clanKey;
        // Capitaliza o nome do clã para exibição
        option.textContent = clanKey.charAt(0).toUpperCase() + clanKey.slice(1);
        dom.clanSelectInput.appendChild(option);
    });
}
export async function handleAddPokemonFormSubmit(event) {
    event.preventDefault();
    if(!dom.addPokemonForm || !dom.newPokemonNameInput || !dom.clanSelectInput) {
        console.error("Elementos do form de adicionar pokemon não encontrados.");
        return;
    }
    const name = dom.newPokemonNameInput.value.trim();
    // Garante que pegue o valor mesmo que o input não exista (caso seja removido no futuro)
    const item = dom.newPokemonItemInput ? dom.newPokemonItemInput.value.trim() : '';
    const clan = dom.clanSelectInput.value;

    if (!name || !clan) {
        displayError('Nome do Pokémon e Clã são obrigatórios.');
        return;
    }
    const submitButton = dom.addPokemonForm.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;
    try {
        const result = await addPokemonAPI(clan, name, item);
        displaySuccess(result.message || `Pokémon "${name}" adicionado ao clã ${clan} com sucesso!`);
        closeAddPokemonModal();
        if (getState().currentClan === clan) {
            loadClanView(clan); // Recarrega a view se o clã adicionado for o atual
        }
    } catch (error) {
        console.error("Erro ao adicionar Pokémon:", error);
        // displayError já chamado na API
    } finally {
        if(submitButton) submitButton.disabled = false;
    }
}

// --- Modal Adicionar Treinador (Formulário) ---
export function openAddTrainerModal() { // Chamada pelo botão (+) no modal de gerenciamento
    if (dom.addTrainerModal) {
        dom.addTrainerModal.style.display = 'flex';
         if(dom.addTrainerForm) dom.addTrainerForm.reset();
        if(dom.newTrainerNameInput) dom.newTrainerNameInput.focus();
        // Fecha o modal de gerenciamento ao abrir o de adicionar
        closeManageTrainersModal();
    }
}
export function closeAddTrainerModal() {
     if (dom.addTrainerModal) {
        dom.addTrainerModal.style.display = 'none';
         if(dom.addTrainerForm) dom.addTrainerForm.reset();
    }
}
export async function handleAddTrainerFormSubmit(event) {
    event.preventDefault();
     if (!dom.addTrainerForm || !dom.newTrainerNameInput || !dom.newTrainerEmailInput || !dom.newTrainerPasswordInput || !dom.adminPasswordForTrainerInput) {
         console.error("Elementos do formulário de adicionar treinador não encontrados."); return;
     }
    const name = dom.newTrainerNameInput.value.trim();
    const email = dom.newTrainerEmailInput.value.trim();
    const password = dom.newTrainerPasswordInput.value.trim();
    const adminPassword = dom.adminPasswordForTrainerInput.value.trim(); // Senha admin digitada no modal
    if (!name || !email || !password || !adminPassword) { displayError("Todos os campos são obrigatórios."); return; }

    const submitButton = dom.addTrainerForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        // Envia a senha admin digitada para validação no backend
        const result = await addTrainerAPI(name, email, password, adminPassword);
        displaySuccess(result.message || `Treinador ${name} adicionado com sucesso!`);
        closeAddTrainerModal();
        // Reabre o modal de gerenciamento para ver o novo treinador adicionado
        openManageTrainersModal(); // Reabre lista após adicionar
    } catch (error) {
        console.error("Erro ao adicionar treinador:", error);
        if (error.message && error.message.toLowerCase().includes('administrador incorreta')) {
            displayError('Senha de administrador inválida.'); if(dom.adminPasswordForTrainerInput) dom.adminPasswordForTrainerInput.focus();
        } else if (error.message && error.message.toLowerCase().includes('email já cadastrado')) {
             displayError('Este email já está em uso.'); if(dom.newTrainerEmailInput) dom.newTrainerEmailInput.focus();
        }
        // Não precisa de displayError genérico pois api.js já trata
    } finally { if (submitButton) submitButton.disabled = false; }
}


// --- Modal Gerenciar Treinadores (Lista) ---

export async function openManageTrainersModal() {
    if (!dom.manageTrainersModal || !dom.trainerListContainer) {
        console.error("Modal de Gerenciamento de Treinadores ou container da lista não encontrado."); return;
    }
    dom.trainerListContainer.innerHTML = ''; // Limpa lista antiga
    dom.manageTrainersModal.style.display = 'flex'; // Mostra o modal
    showSpinner();
    try {
        const trainers = await fetchTrainersAPI(); // Busca treinadores da API
        hideSpinner();
        if (trainers && trainers.length > 0) {
            populateTrainerList(trainers); // Popula a lista
        } else {
            console.log("Nenhum treinador encontrado.");
            dom.trainerListContainer.innerHTML = ''; // Garante que a mensagem :empty do CSS apareça
        }
    } catch (error) {
        hideSpinner();
        // displayError já chamado em fetchTrainersAPI
        dom.trainerListContainer.innerHTML = `<p class="error-message" style="margin: 0;">Erro ao carregar treinadores.</p>`;
    }
}

export function closeManageTrainersModal() {
    if (dom.manageTrainersModal) dom.manageTrainersModal.style.display = 'none';
    if (dom.trainerListContainer) dom.trainerListContainer.innerHTML = ''; // Limpa a lista ao fechar
}

function populateTrainerList(trainers) {
    if (!dom.trainerListContainer) return;
    dom.trainerListContainer.innerHTML = ''; // Limpa

    trainers.forEach(trainer => {
        const item = document.createElement('div');
        item.className = 'trainer-list-item';
        item.dataset.trainerId = trainer.id;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'trainer-info';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'trainer-name'; nameSpan.textContent = trainer.name;
        const emailSpan = document.createElement('span');
        emailSpan.className = 'trainer-email'; emailSpan.textContent = trainer.email;
        infoDiv.appendChild(nameSpan); infoDiv.appendChild(emailSpan);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button small-delete-button';
        deleteButton.dataset.trainerId = trainer.id;
        deleteButton.dataset.trainerName = trainer.name;
        deleteButton.setAttribute('aria-label', `Deletar Treinador ${trainer.name}`);
        deleteButton.title = `Deletar ${trainer.name}`;
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

        item.appendChild(infoDiv);
        item.appendChild(deleteButton);
        dom.trainerListContainer.appendChild(item);
    });
}

export async function handleDeleteTrainer(button) {
    const trainerId = button.dataset.trainerId;
    const trainerName = button.dataset.trainerName || `ID ${trainerId}`;
    if (!trainerId) { displayError("ID do treinador não encontrado."); return; }

    // 1. Pedir senha ADMIN (validação local apenas para confirmação antes de enviar)
    const password = prompt(`[ADMIN] Digite a senha para deletar PERMANENTEMENTE o treinador "${trainerName}" e todo o seu histórico associado:`);
    if (password === null) return; // Cancelou

    // Validação local (INSEGURA, idealmente o backend valida, mas fazemos aqui para dar feedback rápido)
    // Isso evita chamar a API desnecessariamente se a senha estiver obviamente errada no frontend.
    if (password !== LOCAL_ADMIN_PASSWORD_FOR_CHECK) {
        displayError('Senha de administrador incorreta!');
        return;
    }

    // 2. Confirmação final
    if (!confirm(`Tem CERTEZA que deseja deletar o treinador "${trainerName}"?\n\nATENÇÃO: Todo o histórico de empréstimos deste treinador será PERMANENTEMENTE DELETADO.\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    // 3. Chamar a API de deleção, enviando a senha admin para validação REAL no backend
    showSpinner();
    try {
        await deleteTrainerAPI(trainerId, password); // Passa a senha para a API
        hideSpinner();
        displaySuccess(`Treinador "${trainerName}" deletado com sucesso!`);
        const listItem = button.closest('.trainer-list-item');
        if (listItem) listItem.remove();
        else openManageTrainersModal(); // Recarrega se não achar o item
        if (dom.trainerListContainer && dom.trainerListContainer.children.length === 0) {
             console.log("Lista de treinadores ficou vazia.");
             // O CSS :empty deve exibir a mensagem
        }
    } catch (error) {
        hideSpinner();
        console.error(`Erro ao deletar treinador ${trainerId}:`, error);
        // displayError já chamado na API (incluindo erro de senha errada do backend)
    }
}


// --- Modal Devolução Parcial (com validação de senha) ---
export async function openPartialReturnModal(groupIndex) {
    setActiveHistoryGroupIndex(groupIndex);
    clearPartialReturnSelection();
    const passwordInput = document.getElementById('partialReturnPassword');
    if (passwordInput) passwordInput.value = ''; // Limpa senha

    if(!dom.partialReturnListContainer || !dom.partialReturnModal) return;

    showSpinner();
    try {
        const activeGroups = await fetchActiveHistory();
        hideSpinner();
        const group = activeGroups[groupIndex];
        if (!group || !group.pokemons || !Array.isArray(group.pokemons)) {
            displayError("Grupo de empréstimo não encontrado ou inválido.");
            closePartialReturnModal(); return;
        }
        dom.partialReturnListContainer.innerHTML = '';
        group.pokemons.forEach(pokemon => {
            const pokemonName = pokemon.name;
            if(!pokemonName) return;
            const item = document.createElement('div');
            item.className = 'partial-return-item'; item.dataset.pokemonName = pokemonName;
            const nameDiv = document.createElement('div');
            nameDiv.className = 'pokemon-name'; nameDiv.textContent = pokemonName;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox'; checkbox.className = 'partial-return-checkbox';
            checkbox.dataset.action = 'toggle-partial-return'; checkbox.dataset.pokemonName = pokemonName;
            item.appendChild(nameDiv); item.appendChild(checkbox);
            dom.partialReturnListContainer.appendChild(item);
        });
        dom.partialReturnModal.style.display = 'flex';
        if (passwordInput) passwordInput.focus(); // Foca senha
    } catch (error) {
        hideSpinner(); console.error("Erro ao abrir modal de devolução parcial:", error);
        closePartialReturnModal();
    }
}
export function closePartialReturnModal() {
    if(dom.partialReturnModal) dom.partialReturnModal.style.display = 'none';
    if(dom.partialReturnListContainer) dom.partialReturnListContainer.innerHTML = '';
    setActiveHistoryGroupIndex(null);
    clearPartialReturnSelection();
    const passwordInput = document.getElementById('partialReturnPassword');
    if (passwordInput) passwordInput.value = ''; // Limpa senha
}
export function handleTogglePartialReturn(checkbox) {
    const pokemonName = checkbox.dataset.pokemonName;
    const itemDiv = checkbox.closest('.partial-return-item');
    if (pokemonName && itemDiv) {
        togglePartialReturnSelection(pokemonName);
        itemDiv.classList.toggle('selected', checkbox.checked);
    }
}
export async function handleConfirmPartialReturn() {
    const selection = getState().partialReturnSelection;
    const pokemonsToReturnNames = Object.keys(selection).filter(name => selection[name]);
    const passwordInput = document.getElementById('partialReturnPassword');
    const trainerPassword = passwordInput ? passwordInput.value : '';

    if (pokemonsToReturnNames.length === 0) { displayError('Selecione pelo menos um Pokémon para devolver.'); return; }
    if (!trainerPassword) { displayError('Por favor, digite sua senha de treinador para confirmar a devolução.'); if(passwordInput) passwordInput.focus(); return; }

    const groupIndex = getState().activeHistoryGroupIndex;
    if (groupIndex === null) { displayError("Erro interno: Grupo de histórico não identificado."); return; }

    const confirmButton = dom.confirmPartialReturnButton;
    if (confirmButton) confirmButton.disabled = true;

    try {
        const fullHistory = await fetchAllHistory();
        const activeGroups = await fetchActiveHistory();
        const targetGroup = activeGroups[groupIndex];

        if (!targetGroup || !targetGroup.trainer_name || !targetGroup.date) {
             displayError("Erro ao revalidar grupo de histórico ativo."); closePartialReturnModal(); return;
        }

        const historyEntryIdsToReturn = fullHistory
            .filter(entry => !entry.returned && entry.trainer_name === targetGroup.trainer_name && entry.date === targetGroup.date && pokemonsToReturnNames.includes(entry.pokemon_name))
            .map(entry => entry.id);

        if (historyEntryIdsToReturn.length === 0) {
             displayError('Não foi possível encontrar os registros correspondentes. A lista pode estar desatualizada.'); closePartialReturnModal(); renderActivePokemons(); return;
        }

        console.log(`[Partial Return] IDs a devolver: ${historyEntryIdsToReturn.join(', ')}`);

        const returnPromises = historyEntryIdsToReturn.map(entryId =>
            returnPokemonAPI(entryId, trainerPassword) // Passa a senha
                .then(result => ({ status: 'fulfilled', id: entryId, result }))
                .catch(error => ({ status: 'rejected', id: entryId, reason: error }))
        );
        const results = await Promise.allSettled(returnPromises);

        const failedReturns = results.filter(r => r.status === 'rejected');
        if (failedReturns.length > 0) {
            const firstErrorReason = failedReturns[0].reason?.message || 'Erro desconhecido';
            console.error(`[Partial Return] Falha ao devolver ${failedReturns.length}. Razão: ${firstErrorReason}`);
             if (firstErrorReason.toLowerCase().includes('senha do treinador inválida')) {
                displayError('Senha do treinador inválida. Nenhum Pokémon foi devolvido.');
                if(passwordInput) passwordInput.focus();
             } else { displayError(`Falha ao devolver: ${firstErrorReason}`); }
             // Não fecha o modal se a senha/outro erro ocorreu
        } else {
            displaySuccess('Pokémon(s) selecionado(s) devolvido(s) com sucesso!');
            closePartialReturnModal(); // Fecha SÓ se TUDO deu certo
        }

        renderActivePokemons(); // Atualiza sempre
        const currentViewClan = getState().currentClan;
        if (currentViewClan !== 'home') loadClanView(currentViewClan); // Atualiza sempre

    } catch (error) {
        console.error("Erro geral ao confirmar devolução parcial:", error);
        displayError(error.message || "Ocorreu um erro inesperado.");
    } finally {
         if (confirmButton) confirmButton.disabled = false;
    }
}