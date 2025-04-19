// TODOLISTPOKEMON/js/state.js
/**
 * Gerencia o estado mutável da aplicação frontend.
 * Mantém informações como o clã atualmente visualizado, os Pokémons
 * selecionados para empréstimo, informações para devolução parcial, etc.
 * Exporta funções para acessar (getState) e modificar (setters) o estado.
 *
 * Estado Gerenciado:
 * - currentClan: String ('home' ou nome do clã ativo).
 * - selectedPokemons: Objeto { pokemonId: true } para Pokémons selecionados na Clan View.
 * - activeHistoryGroupIndex: Number | null - Índice do grupo ativo selecionado para devolução.
 * - partialReturnSelection: Objeto { pokemonName: true } para Pokémons selecionados no modal de devolução parcial.
 * - isDeletingPokemon: Boolean - Flag para controle de concorrência na deleção.
 */


let currentState = {
    currentClan: 'home',
    selectedPokemons: {},
    activeHistoryGroupIndex: null,
    partialReturnSelection: {},
    isDeletingPokemon: false,
};


export function getState() {
    return currentState;
}

export function setCurrentClan(clan) {
    currentState.currentClan = clan;
    console.log('Clã atual:', currentState.currentClan);
}

export function setSelectedPokemons(selection) {
    currentState.selectedPokemons = selection;
    console.log('Pokémons selecionados:', currentState.selectedPokemons);
}

export function addSelectedPokemon(pokemonId) {
    currentState.selectedPokemons[pokemonId] = true;
    console.log('Pokémons selecionados:', currentState.selectedPokemons);
}

export function removeSelectedPokemon(pokemonId) {
    delete currentState.selectedPokemons[pokemonId];
    console.log('Pokémons selecionados:', currentState.selectedPokemons);
}

export function clearSelectedPokemons() {
    currentState.selectedPokemons = {};
    console.log('Seleção limpa.');
}

export function setActiveHistoryGroupIndex(index) {
    currentState.activeHistoryGroupIndex = index;
}

export function setPartialReturnSelection(selection) {
    currentState.partialReturnSelection = selection;
}

export function togglePartialReturnSelection(pokemonName) {
    if (currentState.partialReturnSelection[pokemonName]) {
        delete currentState.partialReturnSelection[pokemonName];
    } else {
        currentState.partialReturnSelection[pokemonName] = true;
    }
    console.log('Seleção devolução parcial:', currentState.partialReturnSelection);
}

export function clearPartialReturnSelection() {
    currentState.partialReturnSelection = {};
}

export function setIsDeletingPokemon(isDeleting) {
    currentState.isDeletingPokemon = isDeleting;
}