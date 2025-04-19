// TODOLISTPOKEMON/js/domElements.js
/**
 * Centraliza e exporta referências para elementos do DOM frequentemente
 * utilizados pela aplicação.
 */
export const dom = {

    // Body
    body: document.body, // Adicionado para facilitar toggle de classe

    // Header
    menuToggle: document.getElementById('menuToggle'),
    logo: document.querySelector('.logo'),
    manageTrainersButton: document.getElementById('manageTrainersButton'),
    historyButton: document.getElementById('historyButton'),
    themeToggleButton: document.getElementById('themeToggleButton'), // <<< NOVO

    // Sidebar
    sidebar: document.getElementById('sidebar'),
    closeMenu: document.getElementById('closeMenu'),
    menuOverlay: document.getElementById('menuOverlay'),
    clanButtons: document.querySelectorAll('.clan-button'),

    // Seções Principais
    homeSection: document.getElementById('home-section'),
    clanSection: document.getElementById('clan-section'),

    // Home View
    exploreButton: document.getElementById('exploreButton'),
    viewActiveButton: document.getElementById('viewActiveButton'),
    clanCards: document.querySelectorAll('.clan-card'),
    activePokemonsList: document.getElementById('activePokemonsList'),

    // Clan View
    clanHeader: document.querySelector('.clan-header'),
    clanTitle: document.getElementById('clan-title'),
    clanElementsTag: document.getElementById('clan-elements'),
    backToHome: document.getElementById('backToHome'),
    selectEntireBagButton: document.getElementById('selectEntireBag'),
    pokemonSelectionContainer: document.getElementById('pokemon-selection'),
    emptyClanMessage: document.getElementById('empty-clan'),
    trainerPasswordInput: document.getElementById('trainerPassword'),
    confirmSelectionButton: document.getElementById('confirmSelection'),

    // Modais Gerais e Botão Flutuante
    errorModal: document.getElementById('errorModal'),
    addPokemonButton: document.getElementById('addPokemonButton'),
    loadingSpinner: document.getElementById('loadingSpinner'),

    // Modal Adicionar Pokémon (Form)
    addPokemonModal: document.getElementById('addPokemonModal'),
    addPokemonForm: document.getElementById('addPokemonForm'),
    newPokemonNameInput: document.getElementById('newPokemonName'),
    newPokemonItemInput: document.getElementById('newPokemonItem'),
    clanSelectInput: document.getElementById('clanSelect'),

    // Modal Adicionar Treinador (Form)
    addTrainerModal: document.getElementById('addTrainerModal'),
    addTrainerForm: document.getElementById('addTrainerForm'),
    newTrainerNameInput: document.getElementById('newTrainerName'),
    newTrainerEmailInput: document.getElementById('newTrainerEmail'),
    newTrainerPasswordInput: document.getElementById('newTrainerPassword'),
    adminPasswordForTrainerInput: document.getElementById('adminPasswordForTrainer'),
    confirmAddTrainerButton: document.getElementById('confirmAddTrainer'),

    // Modal Devolução Parcial
    partialReturnModal: document.getElementById('partialReturnModal'),
    partialReturnListContainer: document.getElementById('partialReturnList'),
    confirmPartialReturnButton: document.getElementById('confirmPartialReturn'),

    // Modal Histórico
    historyModal: document.getElementById('historyModal'),
    historyListContainer: document.getElementById('historyList'),
    historySearchInput: document.getElementById('historySearch'),
    historyFilterSelect: document.getElementById('historyFilter'),
    deleteAllHistoryButton: document.getElementById('delete-all-history-button'),

    // Modal Gerenciar Treinadores
    manageTrainersModal: document.getElementById('manageTrainersModal'),
    trainerListContainer: document.getElementById('trainerListContainer'),
    openAddTrainerModalButton: document.getElementById('openAddTrainerModalButton'),
};