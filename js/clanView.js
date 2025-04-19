// TODOLISTPOKEMON/js/clanView.js
/**
 * Gerencia a lógica e a renderização da visualização de um clã específico.
 * Responsável por buscar os Pokémons do clã via API, exibi-los, permitir
 * a seleção individual ou total, lidar com a confirmação do empréstimo
 * (enviando a SENHA do treinador para a API de histórico) e permitir a exclusão
 * de Pokémons (com senha de admin).
 *
 * Funções Principais:
 * - loadClanView: Carrega e renderiza a view do clã (título, lista de Pokémons).
 * - renderPokemonList: Cria os elementos HTML para cada Pokémon na lista.
 * - handleTogglePokemonSelection: Adiciona/remove um Pokémon da seleção atual.
 * - handleSelectEntireBag: Seleciona/deseleciona todos os Pokémons disponíveis.
 * - updateSelectEntireBagButton: Atualiza o texto/estado do botão "Adicionar Tudo".
 * - handleConfirmSelection: Valida a seleção e a SENHA do treinador, e envia para a API.
 * - handleDeletePokemon: Pede senha de admin e confirmação para deletar um Pokémon via API.
 */

import { dom } from './domElements.js';
import { getState, addSelectedPokemon, removeSelectedPokemon, clearSelectedPokemons, setIsDeletingPokemon, setSelectedPokemons, setCurrentClan } from './state.js'; // Importa setCurrentClan
import { fetchClanPokemons, postHistory, deletePokemonAPI } from './api.js';
import { updateClanStyles, displayError, displaySuccess } from './ui.js';
// A senha ADMIN_PASSWORD não é importada aqui
import { switchView } from './app.js';

// DEFINIR A SENHA ADMIN *LOCALMENTE* APENAS PARA COMPARAÇÃO (Inseguro, idealmente validar no backend)
const LOCAL_ADMIN_PASSWORD_FOR_CHECK = 'raito123'; // Use a mesma senha que está no backend

export async function loadClanView(clanName) {
    // Define o clã atual no estado global
    setCurrentClan(clanName); // Garante que o estado sabe qual clã está sendo visto
    updateClanStyles(clanName);

    try {
        // Limpa o campo de senha ANTES de buscar os pokemons
        if(dom.trainerPasswordInput) dom.trainerPasswordInput.value = '';

        const pokemons = await fetchClanPokemons(clanName);
        renderPokemonList(pokemons); // Renderiza a lista com os dados buscados
    } catch (error) {
        // Se falhar ao buscar, renderiza a lista vazia e mostra a mensagem
        renderPokemonList([]);
        // displayError já deve ter sido chamado em fetchClanPokemons
    }
}


function renderPokemonList(pokemons) {
    // Verifica se os elementos do DOM existem
    if (!dom.pokemonSelectionContainer || !dom.emptyClanMessage || !dom.selectEntireBagButton) {
         console.error("Elementos essenciais da Clan View não encontrados no DOM (pokemonSelectionContainer, emptyClanMessage, selectEntireBagButton).");
         // Poderia opcionalmente mostrar um erro mais visível para o usuário aqui
         return;
    }

    dom.pokemonSelectionContainer.innerHTML = ''; // Limpa a lista existente

    if (!pokemons || pokemons.length === 0) {
        // Mostra mensagem de clã vazio e esconde container da lista
        dom.pokemonSelectionContainer.classList.add('hidden');
        dom.emptyClanMessage.classList.remove('hidden');
        dom.selectEntireBagButton.disabled = true; // Desabilita botão "Adicionar Tudo"
    } else {
        // Mostra container da lista e esconde mensagem de clã vazio
        dom.pokemonSelectionContainer.classList.remove('hidden');
        dom.emptyClanMessage.classList.add('hidden');
        dom.selectEntireBagButton.disabled = false; // Garante que o botão está habilitado

        pokemons.forEach(pokemon => {
            const div = document.createElement('div');
            div.className = 'pokemon-item';
            div.dataset.pokemonId = pokemon.id; // Guarda o ID do Pokémon

            const nameDiv = document.createElement('div');
            nameDiv.className = 'pokemon-name';
            nameDiv.textContent = pokemon.name + (pokemon.held_item ? ` (${pokemon.held_item})` : '');
            div.appendChild(nameDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'pokemon-actions';

            const selectButton = document.createElement('button');
            selectButton.className = 'select-button';
            selectButton.dataset.action = 'toggle-select'; // Ação para o event listener

            // Verifica o ESTADO GLOBAL para ver se este Pokémon está selecionado
            const isSelectedGlobally = getState().selectedPokemons[pokemon.id];

            if (pokemon.status !== 'available') {
                // Pokémon indisponível
                div.classList.add('unavailable');
                selectButton.disabled = true;
                selectButton.classList.add('unavailable'); // Classe específica para estilização se necessário
                selectButton.textContent = 'X'; // Indicação visual de indisponibilidade
                const statusDiv = document.createElement('div');
                statusDiv.className = 'pokemon-status';
                statusDiv.textContent = `Em uso`; // Ou outro status relevante
                // Adiciona o status ao lado do nome (ou onde for apropriado no layout)
                nameDiv.appendChild(statusDiv); // Exemplo: adiciona ao lado do nome
            } else {
                // Pokémon disponível
                selectButton.textContent = isSelectedGlobally ? '✓' : '+';
                if (isSelectedGlobally) {
                    div.classList.add('selected');
                    selectButton.classList.add('selected');
                }
            }

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = '-'; // Ícone ou texto para deletar
            deleteButton.dataset.action = 'delete-pokemon'; // Ação para o event listener
            deleteButton.title = 'Deletar este Pokémon (Admin)'; // Tooltip

            actionsDiv.appendChild(selectButton);
            actionsDiv.appendChild(deleteButton);
            div.appendChild(actionsDiv);

            dom.pokemonSelectionContainer.appendChild(div);
        });

        // Atualiza o estado do botão "Adicionar Tudo" após renderizar a lista
        updateSelectEntireBagButton(pokemons);
    }

    // REMOVIDO: clearSelectedPokemons(); // <<-- LINHA REMOVIDA DAQUI -->>
    // A limpeza da seleção não deve acontecer aqui para permitir seleção multi-clã.
}


export function handleTogglePokemonSelection(button) {
    const pokemonItem = button.closest('.pokemon-item');
    // Não faz nada se o item não for encontrado ou estiver indisponível
    if (!pokemonItem || pokemonItem.classList.contains('unavailable')) return;

    const pokemonId = pokemonItem.dataset.pokemonId;
    const isSelected = getState().selectedPokemons[pokemonId];

    if (isSelected) {
        // Desseleciona
        removeSelectedPokemon(pokemonId);
        pokemonItem.classList.remove('selected');
        button.classList.remove('selected');
        button.textContent = '+';
    } else {
        // Seleciona
        addSelectedPokemon(pokemonId);
        pokemonItem.classList.add('selected');
        button.classList.add('selected');
        button.textContent = '✓';
    }

    // Atualiza o botão "Adicionar/Retirar Tudo" baseado na nova seleção global
    // Busca os pokémons renderizados atualmente no DOM para recalcular o estado do botão
    const pokemonItems = dom.pokemonSelectionContainer ? dom.pokemonSelectionContainer.querySelectorAll('.pokemon-item') : [];
     const currentClanPokemons = Array.from(pokemonItems).map(item => ({
         id: item.dataset.pokemonId,
         status: item.classList.contains('unavailable') ? 'borrowed' : 'available'
     }));
    updateSelectEntireBagButton(currentClanPokemons);
}


export async function handleSelectEntireBag() {
    const currentClan = getState().currentClan;
    if (!currentClan || currentClan === 'home' || !dom.pokemonSelectionContainer) return;

    try {
        // Busca os dados mais recentes dos pokémons do clã atual
        const pokemons = await fetchClanPokemons(currentClan);
        const availablePokemons = pokemons.filter(p => p.status === 'available');

        if (availablePokemons.length === 0) {
            displayError('Nenhum Pokémon disponível neste clã para selecionar.');
            return;
        }

        const currentSelection = getState().selectedPokemons;
        const availableIdsInCurrentClan = availablePokemons.map(p => p.id);
        // Verifica se todos os disponíveis DESTE CLÃ já estão selecionados no estado global
        const allAvailableInClanSelected = availableIdsInCurrentClan.every(id => currentSelection[id]);

        let newSelection = { ...currentSelection }; // Começa com a seleção global atual

        if (allAvailableInClanSelected) {
            // Se todos disponíveis DESTE CLÃ já estão selecionados, a ação é REMOVER apenas os disponíveis deste clã
            availableIdsInCurrentClan.forEach(id => {
                delete newSelection[id]; // Remove da cópia
            });
            console.log(`Removendo ${availableIdsInCurrentClan.length} pokemons do clã ${currentClan} da seleção.`);
        } else {
             // Se nem todos estão selecionados, a ação é ADICIONAR todos os disponíveis deste clã à seleção global
            availableIdsInCurrentClan.forEach(id => {
                newSelection[id] = true; // Adiciona/garante que está na cópia
            });
             console.log(`Adicionando ${availableIdsInCurrentClan.length} pokemons do clã ${currentClan} à seleção.`);
        }

        setSelectedPokemons(newSelection); // Atualiza o estado global da seleção COM A CÓPIA MODIFICADA
        renderPokemonList(pokemons); // Re-renderiza a lista para refletir a nova seleção visualmente

    } catch (error) {
        // displayError já chamado em fetchClanPokemons
        console.error("Erro ao selecionar/deselecionar toda a bag:", error);
    }
}


// Atualiza o texto e estado do botão "Adicionar Tudo"
function updateSelectEntireBagButton(pokemons) {
     if(!dom.selectEntireBagButton) return;

    const availablePokemons = pokemons.filter(p => p.status === 'available');
    // Se não há pokémons disponíveis, desabilita o botão
    if (availablePokemons.length === 0) {
        dom.selectEntireBagButton.textContent = 'Adicionar Tudo';
        dom.selectEntireBagButton.classList.remove('remove-all');
        dom.selectEntireBagButton.disabled = true;
        return;
    }

    // Habilita o botão se há pokémons disponíveis
    dom.selectEntireBagButton.disabled = false;

    const currentSelection = getState().selectedPokemons;
    const availableIdsInCurrentClan = availablePokemons.map(p => p.id);
    // Verifica se TODOS os disponíveis DESTE CLÃ JÁ ESTÃO na seleção global atual
    const allAvailableInClanSelected = availableIdsInCurrentClan.every(id => currentSelection[id]);

    if (allAvailableInClanSelected) {
        // Se sim, o botão servirá para REMOVER todos DESTE CLÃ
        dom.selectEntireBagButton.textContent = 'Retirar Tudo';
        dom.selectEntireBagButton.classList.add('remove-all'); // Classe para estilização diferente
    } else {
        // Se não, o botão servirá para ADICIONAR todos DESTE CLÃ
        dom.selectEntireBagButton.textContent = 'Adicionar Tudo';
        dom.selectEntireBagButton.classList.remove('remove-all');
    }
}


// Confirma seleção usando senha do treinador
export async function handleConfirmSelection() {
     if(!dom.trainerPasswordInput || !dom.confirmSelectionButton) return;

    const trainerPassword = dom.trainerPasswordInput.value.trim(); // Pega a SENHA
    const selectedIds = Object.keys(getState().selectedPokemons); // Pega IDs dos pokemons selecionados (de todos os clãs)

    if (!trainerPassword) {
        displayError("Por favor, insira sua senha de treinador."); // Mensagem atualizada
        dom.trainerPasswordInput.focus();
        return;
    }

    if (selectedIds.length === 0) {
        displayError("Nenhum Pokémon selecionado.");
        return;
    }

    const confirmButton = dom.confirmSelectionButton;
    confirmButton.disabled = true; // Desabilita o botão

    try {
        // Chama a API passando a SENHA e os IDs (de todos os clãs selecionados)
        const result = await postHistory(trainerPassword, selectedIds);
        // A API POST /history agora retorna a mensagem com o nome do treinador
        displaySuccess(result.message || `${selectedIds.length} Pokémon(s) registrado(s) com sucesso!`);

        clearSelectedPokemons(); // Limpa a seleção do estado APÓS o sucesso
        dom.trainerPasswordInput.value = ''; // Limpa o campo de senha
        switchView('home'); // Volta para a home após o sucesso

    } catch (error) {
        // displayError já é chamado em fetchData/postHistory
        console.error("Erro ao confirmar seleção:", error);
         if (error.message && error.message.toLowerCase().includes('senha do treinador inválida')) {
             displayError('Senha do treinador inválida. Tente novamente.');
              dom.trainerPasswordInput.focus();
         } else if (error.message && error.message.toLowerCase().includes('disponível')) {
             displayError(`Um ou mais Pokémons selecionados não estão mais disponíveis: ${error.message}. Recarregando a lista...`);
              // Recarrega a view do clã para mostrar o status atualizado
              loadClanView(getState().currentClan);
         }
    } finally {
        confirmButton.disabled = false; // Reabilita o botão
    }
}


export async function handleDeletePokemon(button) {
    const pokemonItem = button.closest('.pokemon-item');
    // Previne múltiplas deleções simultâneas
    if (!pokemonItem || getState().isDeletingPokemon) return;

    const pokemonId = pokemonItem.dataset.pokemonId;
    const pokemonNameElement = pokemonItem.querySelector('.pokemon-name');
    const pokemonName = pokemonNameElement ? pokemonNameElement.textContent.split('(')[0].trim() : pokemonId; // Tenta pegar só o nome

    const password = prompt(`[ADMIN] Digite a senha para deletar PERMANENTEMENTE o Pokémon "${pokemonName}":`);
    if (password === null) return; // Cancelou o prompt

    // MUDAR: Compara com a constante local definida no início do arquivo
    if (password !== LOCAL_ADMIN_PASSWORD_FOR_CHECK) {
           displayError('Senha de administrador incorreta!');
        return;
    }

    if (!confirm(`Tem certeza que deseja deletar PERMANENTEMENTE o Pokémon "${pokemonName}" (${pokemonId})? Esta ação não pode ser desfeita.`)) {
        return;
    }

    setIsDeletingPokemon(true); // Flag para evitar concorrência
    const deleteButton = button; // Guarda referência ao botão
    deleteButton.disabled = true; // Desabilita o botão durante a operação

    try {
        const result = await deletePokemonAPI(pokemonId);
        displaySuccess(result.message || 'Pokémon deletado com sucesso!');

        // Remove o item do DOM imediatamente após sucesso para feedback rápido
        pokemonItem.remove();
         // Força recarregamento da view para garantir consistência,
         // especialmente se a mensagem "empty-clan" deve aparecer.
         if(dom.pokemonSelectionContainer) {
            loadClanView(getState().currentClan);
         }

    } catch (error) {
        console.error(`Erro ao deletar Pokémon ${pokemonId}:`, error);
         if (error.message && error.message.toLowerCase().includes('emprestado')) {
             displayError('Não é possível deletar um Pokémon que está emprestado.');
         }
         deleteButton.disabled = false; // Reabilita botão em caso de falha
    } finally {
        setIsDeletingPokemon(false); // Libera a flag
    }
}