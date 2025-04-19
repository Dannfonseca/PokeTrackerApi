// TODOLISTPOKEMON/js/history.js
/**
 * Gerencia a lógica do modal de Histórico de Empréstimos.
 * Responsável por abrir/fechar o modal, buscar os dados do histórico completo
 * via API (incluindo nome do treinador via JOIN), filtrar e renderizar as entradas
 * agrupadas por treinador/data, permitir a busca e filtragem, e lidar com
 * a exclusão de grupos de histórico (devolvendo Pokémons pendentes antes)
 * ou a exclusão total do histórico (com confirmação e senha admin).
 *
 * Funções Principais:
 * - openHistoryModal / closeHistoryModal: Abre/fecha o modal.
 * - loadAndRenderHistory: Busca dados da API e chama a renderização.
 * - filterAndRenderHistory: Filtra o cache local e renderiza a lista agrupada.
 * - handleDeleteHistoryGroup: Devolve Pokémons pendentes de um grupo e deleta entradas associadas.
 * - handleDeleteAllHistory: Deleta todo o histórico (requer senha admin).
 * - clearHistoryCache: Limpa o cache local do histórico.
 */
import { dom } from './domElements.js';
import { fetchAllHistory, deleteHistoryEntryAPI, deleteAllHistoryAPI, returnPokemonAPI } from './api.js';
import { displayError, displaySuccess, formatBrazilianDate, showSpinner, hideSpinner } from './ui.js';
// A linha "import { ADMIN_PASSWORD, clanData } from './config.js';" foi REMOVIDA
import { clanData } from './config.js'; // Importar apenas clanData
import { renderActivePokemons } from './homeView.js'; // Para atualizar home após deleção

// DEFINIR A SENHA ADMIN *LOCALMENTE* APENAS PARA COMPARAÇÃO (Inseguro, idealmente validar no backend)
const LOCAL_ADMIN_PASSWORD_FOR_CHECK = 'raito123'; // Use a mesma senha que está no backend

let fullHistoryCache = []; // Cache dos dados brutos da API
let groupedHistoryForDelete = {}; // Cache dos dados agrupados, usado para deleção

export function openHistoryModal() {
    if (dom.historyModal) {
        dom.historyModal.style.display = 'flex';
        fullHistoryCache = []; // Limpa cache ao abrir
        groupedHistoryForDelete = {}; // Limpa cache agrupado também
        if(dom.historySearchInput) dom.historySearchInput.value = ''; // Limpa busca
        if(dom.historyFilterSelect) dom.historyFilterSelect.value = 'all'; // Reseta filtro
        loadAndRenderHistory(); // Carrega e renderiza
    } else {
        console.error("Modal de Histórico não encontrado no DOM.");
    }
}

export function closeHistoryModal() {
    if (dom.historyModal) {
        dom.historyModal.style.display = 'none';
    }
     // Não limpa o cache aqui, pode ser útil manter se reabrir logo
}

async function loadAndRenderHistory() {
    if (!dom.historyListContainer) {
        console.error("Container 'historyListContainer' não encontrado no DOM.");
        return;
    }
    dom.historyListContainer.innerHTML = ''; // Limpa enquanto carrega
    showSpinner(); // Mostra spinner
    try {
        console.log("[History] Buscando histórico completo da API...");
        fullHistoryCache = await fetchAllHistory() || []; // Busca dados (já vem com trainer_name)
        hideSpinner(); // Esconde spinner
        console.log(`[History] Histórico recebido: ${fullHistoryCache.length} entradas.`);
        filterAndRenderHistory(); // Filtra e renderiza com os dados buscados
    } catch (error) {
        hideSpinner(); // Esconde spinner em caso de erro
        console.error("[History] Erro ao carregar histórico:", error);
        // displayError já chamado em fetchAllHistory
        dom.historyListContainer.innerHTML = `<div class="error-message">Erro ao carregar histórico. Tente novamente.</div>`;
    }
}

// Filtra e renderiza o histórico baseado no cache local (fullHistoryCache)
export function filterAndRenderHistory() {
    if (!dom.historyFilterSelect || !dom.historySearchInput || !dom.historyListContainer) {
        console.error("[History] Elementos de filtro/lista do histórico não encontrados.");
        return;
    }
    const filterValue = dom.historyFilterSelect.value; // 'all', 'active', 'returned'
    const searchValue = dom.historySearchInput.value.toLowerCase().trim(); // Termo de busca
    dom.historyListContainer.innerHTML = ''; // Limpa a lista atual
    groupedHistoryForDelete = {}; // Reseta cache agrupado antes de refazer

    if (!Array.isArray(fullHistoryCache)) {
        console.error("[History] Cache de histórico inválido:", fullHistoryCache);
        dom.historyListContainer.innerHTML = `<div class="error-message">Erro interno ao processar histórico.</div>`;
        return;
    }

    console.log(`[History] Filtrando: Status='${filterValue}', Busca='${searchValue}'`);

    // 1. Agrupar o histórico por Treinador (nome) e Data
    const groupedHistory = {}; // Usar variável local para agrupamento da renderização
    fullHistoryCache.forEach((entry, entryIndex) => {
        // Validação da entrada
        if (!entry || typeof entry !== 'object' || !entry.trainer_name || !entry.date || !entry.pokemon_name) {
            console.warn(`[History] Entrada inválida ignorada (índice ${entryIndex}):`, entry);
            return;
        }

        // Chave de agrupamento: Nome do Treinador + Data ISO
        const key = `${entry.trainer_name}-${entry.date}`;
        if (!groupedHistory[key]) {
            groupedHistory[key] = {
                trainer_id: entry.trainer_id, // Guarda ID
                trainer_name: entry.trainer_name, // Guarda Nome
                date: entry.date, // Data ISO original
                pokemons: [], // Lista de pokemons neste grupo
                allReturned: true, // Assume que todos estão devolvidos inicialmente
                entryIds: [] // Guarda os IDs das entradas individuais do histórico neste grupo
            };
        }

        // Adiciona o pokemon ao grupo
        groupedHistory[key].pokemons.push({
            id: entry.id, // ID da *entrada* do histórico
            name: entry.pokemon_name,
            returned: !!entry.returned, // Converte para booleano
            returnDate: entry.returnDate || null, // Data de devolução ISO
            pokemonId: entry.pokemon, // ID do Pokémon em si
            clan_name: entry.clan_name || 'unknown' // Nome do clã
        });
        // Adiciona o ID da entrada à lista de IDs do grupo
        groupedHistory[key].entryIds.push(entry.id);
        // Se *qualquer* pokemon no grupo não foi devolvido, o grupo não está 'allReturned'
        if (!entry.returned) {
            groupedHistory[key].allReturned = false;
        }
    });
    // Atualiza o cache agrupado para uso na função de delete
    groupedHistoryForDelete = { ...groupedHistory }; // Copia o agrupamento local para o cache de deleção

    // 2. Filtrar os grupos baseado nos critérios (status e busca)
    const filteredGroups = Object.values(groupedHistory)
        .filter(group => {
            // Filtro por Status
            if (filterValue === 'active' && group.allReturned) return false; // Esconde devolvidos se filtro é 'active'
            if (filterValue === 'returned' && !group.allReturned) return false; // Esconde ativos se filtro é 'returned'

            // Filtro por Busca (se houver termo de busca)
            if (searchValue) {
                const trainerMatch = group.trainer_name.toLowerCase().includes(searchValue);
                // Verifica se algum pokemon no grupo bate com a busca
                const pokemonMatch = group.pokemons.some(p => p?.name?.toLowerCase().includes(searchValue));
                return trainerMatch || pokemonMatch; // Retorna true se o treinador OU algum pokemon bater
            }
            return true; // Se não houver busca, passa pelo filtro
        })
        // 3. Ordenar os grupos filtrados (mais recentes primeiro)
        .sort((a, b) => {
             try {
                 // Tenta ordenar por data ISO (decrescente)
                 const dateA = new Date(a.date); const dateB = new Date(b.date);
                 if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0; // Não ordena se data inválida
                 return dateB - dateA; // Mais recente primeiro
             } catch(e) {
                 console.warn("[History] Erro ao ordenar datas:", a.date, b.date, e);
                 return 0; // Não ordena se der erro
             }
         });


    // 4. Renderizar os grupos filtrados ou mensagem de vazio
    if (filteredGroups.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'Nenhum registro encontrado para os filtros atuais.';
        dom.historyListContainer.appendChild(emptyMessage);
        return;
    }

    // Helper para criar HTML do nome do Pokémon com tag de clã
    const createPokemonNameHTML = (pokemon) => {
        if (!pokemon || typeof pokemon !== 'object') return '<span style="color: red;">[Erro Dados]</span>';
        const clanKey = pokemon.clan_name || 'unknown';
        const clanConfig = clanData[clanKey];
        const clanColor = clanConfig?.color || '#cccccc'; // Cor padrão cinza
        const clanNameTitle = (clanKey !== 'unknown' && clanConfig) ? (clanKey.charAt(0).toUpperCase() + clanKey.slice(1)) : 'Desconhecido'; // Nome formatado
        const clanTag = `<span class="pokemon-clan-tag" style="background-color: ${clanColor};" title="Clã: ${clanNameTitle}"></span>`;
        const safeName = (pokemon.name || 'Nome Inválido').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `${clanTag}${safeName}`;
    };

    // Itera sobre os grupos filtrados e cria os elementos HTML
    filteredGroups.forEach(group => {
        const item = document.createElement('div');
        // Adiciona classe 'returned' ou 'active' baseado no status do grupo
        item.className = `history-item ${group.allReturned ? 'returned' : 'active'}`;

        const header = document.createElement('div');
        header.className = 'history-header';

        const trainerInfo = document.createElement('div');
        trainerInfo.className = 'history-trainer';
        trainerInfo.textContent = group.trainer_name; // Usa o nome do treinador

        const dateInfo = document.createElement('div');
        dateInfo.className = 'history-date';
        dateInfo.textContent = formatBrazilianDate(group.date); // Formata data do empréstimo

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button button';
        deleteButton.textContent = 'Deletar';
        deleteButton.dataset.action = 'delete-history-group'; // Ação para listener
        deleteButton.dataset.trainer = group.trainer_name; // Guarda nome para identificar grupo
        deleteButton.dataset.date = group.date; // Guarda data ISO para identificar grupo
        deleteButton.title = 'Deletar este registro (devolverá Pokémons pendentes)'; // Tooltip

        header.appendChild(trainerInfo);
        header.appendChild(dateInfo);
        header.appendChild(deleteButton);

        // Div para listar os pokémons dentro do grupo
        const pokemonsListDiv = document.createElement('div');
        pokemonsListDiv.className = 'history-pokemons';

        // Separa pokémons ativos e devolvidos dentro do grupo
        const activePokemonsInGroup = group.pokemons.filter(p => !p.returned);
        const returnedPokemonsInGroup = group.pokemons.filter(p => p.returned);

        // Renderiza lista de ativos (se houver)
        if (activePokemonsInGroup.length > 0) {
            const activeListHTML = activePokemonsInGroup.map(createPokemonNameHTML).join(', ');
            const activeDiv = document.createElement('div');
            activeDiv.innerHTML = `<span class="history-status active">Em uso</span>: ${activeListHTML}`;
            pokemonsListDiv.appendChild(activeDiv);
        }

        // Agrupa os devolvidos por data de devolução para exibição organizada
        const returnsByDate = {};
        returnedPokemonsInGroup.forEach(p => {
            const returnDateKey = p.returnDate || 'Data Indisponível';
            if (!returnsByDate[returnDateKey]) { returnsByDate[returnDateKey] = []; }
            returnsByDate[returnDateKey].push(p);
        });

        // Renderiza listas de devolvidos, ordenadas por data de devolução (mais recentes primeiro)
        Object.entries(returnsByDate).sort(([dateA], [dateB]) => {
            if (dateA === 'Data Indisponível') return 1; if (dateB === 'Data Indisponível') return -1;
            try { const dA = new Date(dateA); const dB = new Date(dateB); if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return 0; return dB - dA; } catch(e) { return 0; }
        }).forEach(([returnDateISO, pokemons]) => {
             const returnedListHTML = pokemons.map(createPokemonNameHTML).join(', ');
             const returnedDiv = document.createElement('div');
             const formattedReturnDate = (returnDateISO !== 'Data Indisponível') ? formatBrazilianDate(returnDateISO) : '';
             returnedDiv.innerHTML = `<span class="history-status returned">Devolvido</span>: ${returnedListHTML} ${formattedReturnDate ? `<div class="history-return-date">em ${formattedReturnDate}</div>` : ''}`;
             pokemonsListDiv.appendChild(returnedDiv);
         });

        item.appendChild(header);
        item.appendChild(pokemonsListDiv);
        dom.historyListContainer.appendChild(item); // Adiciona o item completo ao DOM
    });
    console.log(`[History] ${filteredGroups.length} grupos renderizados.`);
}



export async function handleDeleteHistoryGroup(button) {
    const trainerName = button.dataset.trainer; // Pega nome do treinador do botão
    const dateISO = button.dataset.date; // Pega data ISO do botão

    // Constrói a chave para encontrar o grupo no cache agrupado
    const groupKey = `${trainerName}-${dateISO}`;
    const groupInfo = groupedHistoryForDelete[groupKey]; // Usa o cache de deleção

    if (!groupInfo || !groupInfo.entryIds || groupInfo.entryIds.length === 0) {
         console.error(`[History Delete] Não foi possível encontrar informações/IDs para deletar o grupo: ${groupKey}`, groupInfo);
         displayError('Erro ao preparar a deleção do registro (IDs não encontrados). Verifique o console.');
         return;
    }

    // Pede senha do admin
    const password = prompt(`ATENÇÃO: Pokémons em uso neste grupo (${groupInfo.pokemons.filter(p=>!p.returned).length}) serão devolvidos!\nDigite a senha ADMIN para DEVOLVER e DELETAR o histórico de ${trainerName} de ${formatBrazilianDate(dateISO)}:`);
    if (password === null) return; // Cancelou

    // MUDAR: Compara com a constante local definida no início do arquivo
    if (password !== LOCAL_ADMIN_PASSWORD_FOR_CHECK) {
        displayError('Senha de administrador incorreta!');
        return;
    }

    // Confirmação final
    if (!confirm(`Tem certeza que deseja DEVOLVER os Pokémons pendentes e DELETAR este registro de histórico?\nTreinador: ${trainerName}\nData: ${formatBrazilianDate(dateISO)}\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    const deleteButton = button; // Referência ao botão
    deleteButton.disabled = true; // Desabilita durante a operação
    showSpinner(); // Mostra spinner

    // 1. Devolver Pokémons pendentes (se houver)
    const notReturnedPokemons = groupInfo.pokemons.filter(p => !p.returned);
    let werePokemonsReturned = false;

    try {
        if (notReturnedPokemons.length > 0) {
            console.log(`[History Delete] Devolvendo ${notReturnedPokemons.length} Pokémon(s) pendentes para o grupo ${groupKey}...`);
            const returnPromises = notReturnedPokemons.map(p => {
                console.log(`[History Delete] Tentando devolver entrada ID: ${p.id} (Pokémon: ${p.name})`);
                return returnPokemonAPI(p.id); // Chama API de devolução
            });
            await Promise.all(returnPromises);
            console.log("[History Delete] Pokémons pendentes devolvidos com sucesso.");
            werePokemonsReturned = true;
        } else {
            console.log(`[History Delete] Nenhum Pokémon pendente para devolver no grupo ${groupKey}.`);
        }

        // 2. Deletar as entradas do histórico associadas ao grupo
        console.log(`[History Delete] Deletando ${groupInfo.entryIds.length} entradas do histórico (IDs: ${groupInfo.entryIds.join(', ')})`);
        // Chama a API de deleção para CADA entrada do histórico no grupo
        const deletePromises = groupInfo.entryIds.map(id => deleteHistoryEntryAPI(id));
        await Promise.all(deletePromises);

        displaySuccess(`Registro de histórico deletado com sucesso! ${werePokemonsReturned ? '(Pokémons pendentes foram devolvidos automaticamente)' : ''}`);

    } catch (error) {
        console.error("[History Delete] Erro durante a devolução/deleção do grupo:", error);
        // displayError já chamado nas APIs
    } finally {
        hideSpinner();
        deleteButton.disabled = false; // Reabilita mesmo se der erro
        // Sempre recarrega o histórico e a home para refletir o estado final
        fullHistoryCache = []; // Limpa cache para forçar busca completa
        groupedHistoryForDelete = {}; // Limpa cache agrupado
        loadAndRenderHistory();
        renderActivePokemons();
    }
}



export async function handleDeleteAllHistory() {
    // Pede senha admin
    const password = prompt('[CUIDADO] Digite a senha ADMIN para deletar TODO o histórico (NÃO devolve Pokémons):');
    if (password === null) return; // Cancelou

    // MUDAR: Compara com a constante local definida no início do arquivo
    if (password !== LOCAL_ADMIN_PASSWORD_FOR_CHECK) {
        displayError('Senha de administrador incorreta!');
        return;
    }
    // Confirmações
    if (!confirm('ALERTA MÁXIMO!\n\nVocê está prestes a deletar TODO o histórico de empréstimos.\nEsta ação é IRREVERSÍVEL e NÃO devolverá Pokémons que ainda estejam em uso.\n\nConfirma a exclusão total do histórico?')) {
        return;
    }
     if (!confirm('Segunda confirmação: Tem ABSOLUTA CERTEZA que deseja apagar TODO o histórico? Os Pokémons em uso NÃO serão devolvidos automaticamente.')) {
        return;
    }

    showSpinner();
    try {
        // A API deleteAllHistoryAPI como está NÃO recebe senha. A validação ocorreu acima.
        await deleteAllHistoryAPI(); // Chama a API
        displaySuccess('Histórico completo deletado com sucesso!');
        fullHistoryCache = []; // Limpa cache
        groupedHistoryForDelete = {}; // Limpa cache agrupado
        loadAndRenderHistory(); // Re-renderiza (mostrará vazio)
        renderActivePokemons(); // Atualiza home (mostrará vazio se não houver mais ativos)
    } catch (error) {
         // displayError já chamado na API
         console.error("Erro ao deletar todo o histórico:", error);
    } finally {
        hideSpinner();
    }
}


// Limpa o cache local (pode ser chamado ao sair do modal, por exemplo)
export function clearHistoryCache() {
    console.log("[History] Limpando cache do histórico.");
    fullHistoryCache = [];
    groupedHistoryForDelete = {};
}