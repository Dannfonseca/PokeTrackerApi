// TODOLISTPOKEMON/js/app.js
/**
 * Orquestrador principal da aplicação frontend.
 * Responsável por inicializar a aplicação, configurar os event listeners globais
 * para elementos da UI (menu, botões, modais, etc.) e gerenciar a troca entre
 * as visualizações (home, clãs).
 * Inclui funcionalidade de alternância de tema (dark/light) e modal de gerenciamento de treinadores.
 */
import { dom } from './domElements.js';
import { getState, setCurrentClan, clearSelectedPokemons } from './state.js';
import { updateClanStyles, toggleSidebar, closeSidebar, checkScreenSize, displayError } from './ui.js';
import { loadClanView, handleTogglePokemonSelection, handleSelectEntireBag, handleConfirmSelection, handleDeletePokemon } from './clanView.js';
import { loadHomeView, renderActivePokemons, handleOpenReturnModal } from './homeView.js';
import { openHistoryModal, closeHistoryModal, filterAndRenderHistory, handleDeleteHistoryGroup, handleDeleteAllHistory, clearHistoryCache } from './history.js';
// Importa TODAS as funções de modal necessárias
import {
    openAddPokemonModal, closeAddPokemonModal, handleAddPokemonFormSubmit,
    openPartialReturnModal, closePartialReturnModal, handleTogglePartialReturn, handleConfirmPartialReturn,
    openAddTrainerModal, closeAddTrainerModal, handleAddTrainerFormSubmit, // Funções do modal de FORMULÁRIO
    openManageTrainersModal, closeManageTrainersModal, handleDeleteTrainer // Funções do modal de GERENCIAMENTO
} from './modals.js';

// --- Ícones SVG para o botão de tema ---
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;


// --- Lógica de Troca de Tema ---
function applyTheme(theme) {
    // Certifica que dom.body existe
    if (!dom.body) {
        console.error("Elemento body não encontrado no DOM para aplicar tema.");
        return;
    }

    if (theme === 'dark') {
        dom.body.classList.add('dark-mode');
        if (dom.themeToggleButton) dom.themeToggleButton.innerHTML = sunIcon; // Mostra sol no modo escuro
        localStorage.setItem('theme', 'dark');
        console.log("Tema aplicado: dark");
    } else {
        dom.body.classList.remove('dark-mode');
        if (dom.themeToggleButton) dom.themeToggleButton.innerHTML = moonIcon; // Mostra lua no modo claro
        localStorage.setItem('theme', 'light');
        console.log("Tema aplicado: light");
    }
}

function toggleTheme() {
    if (!dom.body) return; // Segurança extra
    if (dom.body.classList.contains('dark-mode')) {
        applyTheme('light');
    } else {
        applyTheme('dark');
    }
}

// Inicializa o tema ao carregar a página
function initializeTheme() {
    // Verifica preferência do usuário no sistema OU preferência salva
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
        applyTheme(savedTheme); // Aplica tema salvo
    } else if (prefersDark) {
        applyTheme('dark'); // Aplica tema do sistema se não houver salvo
    } else {
        applyTheme('light'); // Padrão é claro
    }
    console.log(`Tema inicializado: ${localStorage.getItem('theme')}`);
}
// --- Fim Lógica de Troca de Tema ---


// Controla a troca de visualização (Home vs Clã)
// Esta versão NÃO limpa a seleção ao trocar de view
export function switchView(viewName) {
    console.log(`Mudando para view: ${viewName}`);

    const isClanView = viewName !== 'home';

    // A seleção NÃO é limpa aqui para persistir entre views

    // Atualiza o clã atual no estado global
    setCurrentClan(viewName);

    // Alterna a visibilidade das seções principais
    try {
        if (dom.homeSection) dom.homeSection.classList.toggle('hidden', isClanView);
        if (dom.clanSection) dom.clanSection.classList.toggle('hidden', !isClanView);
    } catch (e) {
        console.error("Erro ao alternar visibilidade das seções:", e);
        displayError("Erro ao carregar a interface. Verifique o console.");
        return;
    }

    // Atualiza estilos (cores do clã na sidebar, etc.)
    updateClanStyles(viewName);

    // Carrega os dados específicos da view
    if (isClanView) {
        // Carrega a view do clã
        loadClanView(viewName).catch(error => {
             console.error(`Erro ao carregar view do clã ${viewName}:`, error);
             // Volta para home em caso de erro grave ao carregar clã
             switchView('home');
        });
    } else {
        // Carrega a view da Home (incluindo Pokémons ativos)
        loadHomeView().catch(error => {
             console.error("Erro ao carregar view da home:", error);
        });
    }

    // Fecha a sidebar se estiver em modo mobile
    if (window.innerWidth < 768) {
        closeSidebar();
    }

    // Rola a página para o topo ao trocar de view
    window.scrollTo(0, 0);
}


function setupEventListeners() {
    console.log("Configurando event listeners...");

    // --- Header ---
    if (dom.menuToggle) dom.menuToggle.addEventListener('click', toggleSidebar);
    if (dom.logo) dom.logo.addEventListener('click', () => switchView('home'));
    if (dom.historyButton) dom.historyButton.addEventListener('click', openHistoryModal);
    // Listener para o botão "Treinadores" -> Abre modal de gerenciamento
    if (dom.manageTrainersButton) {
        dom.manageTrainersButton.addEventListener('click', openManageTrainersModal);
    } else {
         console.error("Botão 'manageTrainersButton' não encontrado no DOM.");
    }
    // Listener para botão de tema
    if (dom.themeToggleButton) {
        dom.themeToggleButton.addEventListener('click', toggleTheme);
    } else {
        console.error("Botão 'themeToggleButton' não encontrado no DOM.");
    }


    // --- Sidebar ---
    if (dom.closeMenu) dom.closeMenu.addEventListener('click', closeSidebar);
    if (dom.menuOverlay) dom.menuOverlay.addEventListener('click', closeSidebar);
    if (dom.clanButtons) {
        dom.clanButtons.forEach(button => {
            if (button) {
                button.addEventListener('click', () => switchView(button.dataset.clan));
            }
        });
    } else { console.error("Elementos DOM 'clanButtons' não encontrados!"); }

    // --- Home View ---
    if (dom.exploreButton) {
        dom.exploreButton.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                toggleSidebar();
            } else {
                const firstClanButton = document.querySelector('.sidebar-nav .clan-button:not([data-clan="home"])');
                const firstClan = firstClanButton ? firstClanButton.dataset.clan : 'malefic';
                switchView(firstClan);
            }
        });
    }
    if (dom.viewActiveButton) {
        dom.viewActiveButton.addEventListener('click', () => {
            if(dom.activePokemonsList) {
                 dom.activePokemonsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                console.error("Elemento 'activePokemonsList' não encontrado para scroll.");
            }
        });
    }
    if (dom.clanCards) {
        dom.clanCards.forEach(card => {
           if(card) card.addEventListener('click', () => switchView(card.dataset.clan));
        });
    }
    if(dom.activePokemonsList) {
        dom.activePokemonsList.addEventListener('click', (event) => {
            const returnButton = event.target.closest('.return-button[data-action="open-return-modal"]');
            if (returnButton) handleOpenReturnModal(returnButton);
        });
    } else { console.error("Container 'activePokemonsList' não encontrado."); }

    // --- Clan View ---
    if(dom.backToHome) dom.backToHome.addEventListener('click', () => switchView('home'));
    if(dom.selectEntireBagButton) dom.selectEntireBagButton.addEventListener('click', handleSelectEntireBag);
    if(dom.confirmSelectionButton) dom.confirmSelectionButton.addEventListener('click', handleConfirmSelection);
     if(dom.pokemonSelectionContainer) {
        dom.pokemonSelectionContainer.addEventListener('click', (event) => {
            const selectButton = event.target.closest('.select-button[data-action="toggle-select"]');
            const deleteButton = event.target.closest('.delete-button[data-action="delete-pokemon"]');
            if (selectButton) handleTogglePokemonSelection(selectButton);
            else if (deleteButton) handleDeletePokemon(deleteButton);
        });
     } else { console.error("Container 'pokemonSelectionContainer' não encontrado."); }

    // --- Botão Flutuante Adicionar Pokémon ---
    if(dom.addPokemonButton) dom.addPokemonButton.addEventListener('click', openAddPokemonModal);

    // --- Modal Adicionar Pokémon ---
    if(dom.addPokemonModal) {
        const closeBtn = dom.addPokemonModal.querySelector('.close-button');
        const overlay = dom.addPokemonModal.querySelector('.modal-overlay');
        const cancelBtn = dom.addPokemonModal.querySelector('.secondary-button[type="button"]');
        if(closeBtn) closeBtn.addEventListener('click', closeAddPokemonModal);
        if(overlay) overlay.addEventListener('click', closeAddPokemonModal);
        if(cancelBtn) cancelBtn.addEventListener('click', closeAddPokemonModal);
    } else { console.error("Modal 'addPokemonModal' não encontrado."); }
    if(dom.addPokemonForm) dom.addPokemonForm.addEventListener('submit', handleAddPokemonFormSubmit);

     // --- Modal Adicionar Treinador (Formulário) ---
    if(dom.addTrainerModal) {
        const closeBtn = dom.addTrainerModal.querySelector('.close-button');
        const overlay = dom.addTrainerModal.querySelector('.modal-overlay');
        const cancelBtn = dom.addTrainerModal.querySelector('.secondary-button[type="button"]');
        if(closeBtn) closeBtn.addEventListener('click', closeAddTrainerModal);
        if(overlay) overlay.addEventListener('click', closeAddTrainerModal);
        if(cancelBtn) cancelBtn.addEventListener('click', closeAddTrainerModal);
    } else { console.error("Modal 'addTrainerModal' não encontrado."); }
    if(dom.addTrainerForm) dom.addTrainerForm.addEventListener('submit', handleAddTrainerFormSubmit);

    // --- Listeners para Modal Gerenciar Treinadores ---
    if(dom.manageTrainersModal) {
        const closeBtnHeader = dom.manageTrainersModal.querySelector('.modal-header .close-button');
        const closeBtnFooter = dom.manageTrainersModal.querySelector('.modal-footer .close-manage-trainers');
        const overlay = dom.manageTrainersModal.querySelector('.modal-overlay');

        // Botão (+) para abrir o modal de ADICIONAR
        if(dom.openAddTrainerModalButton) {
            dom.openAddTrainerModalButton.addEventListener('click', openAddTrainerModal); // Chama a função que abre o FORMULÁRIO
        } else { console.error("Botão 'openAddTrainerModalButton' não encontrado."); }

        // Fechar o modal de gerenciamento
        if(closeBtnHeader) closeBtnHeader.addEventListener('click', closeManageTrainersModal);
        if(closeBtnFooter) closeBtnFooter.addEventListener('click', closeManageTrainersModal);
        if(overlay) overlay.addEventListener('click', closeManageTrainersModal);

        // Delegação de evento para os botões de deletar na lista
        if(dom.trainerListContainer) {
            dom.trainerListContainer.addEventListener('click', (event) => {
                const deleteButton = event.target.closest('.delete-button.small-delete-button');
                if (deleteButton) {
                    handleDeleteTrainer(deleteButton);
                }
            });
        } else {
            console.error("Container 'trainerListContainer' não encontrado para event delegation.");
        }
    } else {
        console.error("Modal 'manageTrainersModal' não encontrado.");
    }

    // --- Modal Devolução Parcial ---
    if(dom.partialReturnModal) {
        const closeBtn = dom.partialReturnModal.querySelector('.close-button');
        const overlay = dom.partialReturnModal.querySelector('.modal-overlay');
        const cancelBtn = dom.partialReturnModal.querySelector('.secondary-button');
        if(closeBtn) closeBtn.addEventListener('click', closePartialReturnModal);
        if(overlay) overlay.addEventListener('click', closePartialReturnModal);
        if(cancelBtn) cancelBtn.addEventListener('click', closePartialReturnModal);
    } else { console.error("Modal 'partialReturnModal' não encontrado."); }
    if(dom.confirmPartialReturnButton) dom.confirmPartialReturnButton.addEventListener('click', handleConfirmPartialReturn);
    if(dom.partialReturnListContainer) {
        dom.partialReturnListContainer.addEventListener('change', (event) => {
            const checkbox = event.target.closest('input[type="checkbox"][data-action="toggle-partial-return"]');
            if (checkbox) handleTogglePartialReturn(checkbox);
        });
    } else { console.error("Container 'partialReturnListContainer' não encontrado."); }

    // --- Modal Histórico ---
    if(dom.historyModal) {
        const closeButton = dom.historyModal.querySelector('.close-button');
        const overlay = dom.historyModal.querySelector('.modal-overlay');
        const footerCloseButton = dom.historyModal.querySelector('.modal-footer .secondary-button');
        if (closeButton) closeButton.addEventListener('click', closeHistoryModal);
        if (overlay) overlay.addEventListener('click', closeHistoryModal);
        if (footerCloseButton) footerCloseButton.addEventListener('click', closeHistoryModal);
    } else { console.error("Modal 'historyModal' não encontrado."); }
    if(dom.historySearchInput) dom.historySearchInput.addEventListener('input', filterAndRenderHistory);
    if(dom.historyFilterSelect) dom.historyFilterSelect.addEventListener('change', filterAndRenderHistory);
    if(dom.deleteAllHistoryButton) dom.deleteAllHistoryButton.addEventListener('click', handleDeleteAllHistory);
    if(dom.historyListContainer) {
         dom.historyListContainer.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.delete-button[data-action="delete-history-group"]');
            if (deleteButton) handleDeleteHistoryGroup(deleteButton);
         });
    } else { console.error("Container 'historyListContainer' não encontrado."); }

    // --- Outros Listeners Globais ---
    window.addEventListener('resize', checkScreenSize);

    console.log("Event listeners configurados.");
}


// Inicialização
function initializeApp() {
    console.log("Inicializando aplicação...");
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInitialization);
    } else {
        runInitialization();
    }
}

function runInitialization() {
    console.log("DOM carregado, executando inicialização...");
    initializeTheme(); // <<< Inicializa o tema ANTES de configurar listeners
    setupEventListeners(); // Configura todos os listeners
    checkScreenSize(); // Verifica tamanho inicial da tela
    switchView('home'); // Carrega a view inicial (Home)
    console.log("Aplicação inicializada.");
}

initializeApp(); // Ponto de entrada