// TODOLISTPOKEMON/js/homeView.js
/**
 * Gerencia a lógica e a renderização da visualização principal (Home).
 * Responsável por exibir o banner de boas-vindas, instruções, cards de clãs
 * e, principalmente, a lista de Pokémons atualmente em uso (ativos), buscando
 * o nome do treinador associado ao empréstimo.
 *
 * Funções Principais:
 * - loadHomeView: Ativa a seção Home e chama a renderização dos Pokémons ativos.
 * - renderActivePokemons: Busca os dados dos empréstimos ativos via API (/history/active)
 * e cria os elementos HTML para exibir cada grupo de empréstimo (com nome do treinador) na lista.
 * - handleOpenReturnModal: Chamada quando o botão "Devolver" de um grupo ativo é clicado,
 * abrindo o modal de devolução parcial (gerenciado em modals.js).
 */
import { dom } from './domElements.js';
import { fetchActiveHistory } from './api.js';
import { openPartialReturnModal } from './modals.js';
import { formatBrazilianDate, displayError } from './ui.js'; // Importa displayError
import { clanData } from './config.js';

export async function loadHomeView() {
    console.log("Carregando Home View...");
    if (!dom.homeSection || !dom.clanSection) {
        console.error("Seção Home ou Clã não encontrada no DOM.");
        displayError("Erro crítico: Elementos principais da página não encontrados.");
        return;
    }
    dom.homeSection.classList.remove('hidden');
    dom.clanSection.classList.add('hidden');
    await renderActivePokemons(); // Chama a renderização dos ativos
    console.log("Home View carregada.");
}


export async function renderActivePokemons() {
    console.log("Renderizando Pokémons ativos...");
    if (!dom.activePokemonsList) {
        console.error("Container 'activePokemonsList' não encontrado no DOM.");
        return; // Não tenta renderizar se o container não existe
    }
    dom.activePokemonsList.innerHTML = ''; // Limpa a lista antes de renderizar

    try {
        const activeGroups = await fetchActiveHistory(); // Busca dados da API

        if (!activeGroups || activeGroups.length === 0) {
            // Exibe mensagem se não houver pokémons ativos
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message'; // Usa classe CSS padrão
            emptyMessage.textContent = 'Nenhum Pokémon em uso no momento.';
            dom.activePokemonsList.appendChild(emptyMessage);
            console.log("Nenhum Pokémon ativo encontrado.");
            return;
        }

        console.log("[Home View] Dados recebidos (API /history/active):", JSON.stringify(activeGroups, null, 2));

        // Itera sobre cada grupo de empréstimo ativo
        activeGroups.forEach((group, index) => {
            // Validação básica do objeto do grupo
            if (!group || !group.pokemons || !Array.isArray(group.pokemons) || !group.trainer_name || !group.date) {
                console.warn(`Grupo ativo inválido no índice ${index}:`, group);
                return; // Pula para o próximo grupo se este for inválido
            }

            // Determina a classe do clã (pode ser complexo se um grupo tiver pokémons de clãs diferentes)
            // Simplificação: Usaremos 'unknown-clan' ou tentaremos pegar o clã do primeiro pokemon se disponível
            let groupClanClass = 'unknown-clan';
            if (group.pokemons.length > 0 && group.pokemons[0].clan && clanData[group.pokemons[0].clan]) {
                 groupClanClass = group.pokemons[0].clan; // Usa o clã do primeiro pokemon
            } else {
                 // Tenta inferir pela cor se não tiver nome de clã explícito (menos ideal)
                 const firstClan = group.pokemons.length > 0 ? group.pokemons[0].clan : null;
                 if(firstClan && clanData[firstClan]) {
                     groupClanClass = firstClan;
                 }
            }

             console.log(`Grupo ${index} (Treinador: ${group.trainer_name}) - Classe CSS: ${groupClanClass}`);

            // Cria o elemento principal do item
            const item = document.createElement('div');
            item.className = `active-pokemon-item ${groupClanClass}`; // Adiciona classe do clã (ou unknown)

            // Cria o cabeçalho do item (Nome, Data, Botão)
            const header = document.createElement('div');
            header.className = 'active-pokemon-header';

            const trainerInfo = document.createElement('div');
            trainerInfo.className = 'active-pokemon-trainer';
            trainerInfo.textContent = group.trainer_name; // USA trainer_name DA API

            const dateInfo = document.createElement('div');
            dateInfo.className = 'active-pokemon-date';
            dateInfo.textContent = formatBrazilianDate(group.date); // Formata a data

            const returnButton = document.createElement('button');
            returnButton.className = 'return-button button'; // Classes CSS para botão
            returnButton.textContent = 'Devolver';
            returnButton.dataset.action = 'open-return-modal'; // Ação para event listener
            returnButton.dataset.groupIndex = index; // Guarda o índice do grupo para referência

            header.appendChild(trainerInfo);
            header.appendChild(dateInfo);
            header.appendChild(returnButton);

            // Cria a div para listar os nomes dos Pokémons
            const pokemonListDiv = document.createElement('div');
            pokemonListDiv.className = 'active-pokemon-name-list'; // Classe para possível estilização

            // Mapeia os nomes dos pokémons do grupo, tratando casos inválidos
            const pokemonNames = group.pokemons.map((pokemon, idx) => {
                 if (!pokemon || typeof pokemon.name !== 'string' || pokemon.name.trim() === '') {
                    console.warn(`Nome de Pokémon vazio ou inválido no grupo ${index}, índice ${idx}. Valor recebido:`, pokemon);
                    return '[Nome Inválido]';
                }
                return pokemon.name; // Retorna apenas o nome
            });
            pokemonListDiv.textContent = pokemonNames.join(', '); // Junta os nomes com vírgula

            // Adiciona cabeçalho e lista de pokémons ao item principal
            item.appendChild(header);
            item.appendChild(pokemonListDiv);
            // Adiciona o item completo à lista no DOM
            dom.activePokemonsList.appendChild(item);
        });
        console.log("Pokémons ativos renderizados.");

    } catch (error) {
        console.error("Erro CRÍTICO ao renderizar Pokémons ativos:", error);
        // displayError já foi chamado em fetchActiveHistory
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message'; // Usa classe CSS padrão
        errorMessage.textContent = 'Erro ao carregar a lista de Pokémons em uso. Verifique o console (F12) e tente recarregar.';
        if (dom.activePokemonsList) {
             dom.activePokemonsList.innerHTML = ''; // Limpa qualquer conteúdo anterior
             dom.activePokemonsList.appendChild(errorMessage); // Mostra a mensagem de erro
        }
    }
}


export function handleOpenReturnModal(button) {
    const groupIndexStr = button.dataset.groupIndex; // Pega o índice do grupo do botão
    // Converte para número inteiro
    const groupIndex = parseInt(groupIndexStr, 10);

    console.log(`Botão Devolver clicado para grupo índice (string): '${groupIndexStr}', (int): ${groupIndex}`);

    // Valida se o índice é um número válido e não negativo
    if (groupIndexStr !== null && groupIndexStr !== undefined && !isNaN(groupIndex) && groupIndex >= 0) {
        openPartialReturnModal(groupIndex); // Abre o modal de devolução parcial
    } else {
        console.error("Índice do grupo inválido ou não encontrado no botão de devolução:", groupIndexStr);
        displayError("Não foi possível identificar qual grupo devolver. Tente recarregar a página.");
    }
}