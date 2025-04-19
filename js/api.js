// TODOLISTPOKEMON/js/api.js
/**
 * Funções para interagir com a API do backend (definida em config.js).
 * Encapsula as chamadas fetch, tratando erros básicos e controlando
 * a exibição do spinner de carregamento (showSpinner, hideSpinner de ui.js).
 * Inclui função para adicionar treinadores e modifica postHistory para usar senha.
 *
 * Funções Principais:
 * - fetchData: Helper genérico para requisições fetch.
 * - addTrainerAPI: Adiciona um novo treinador (requer senha admin).
 * - fetchClanPokemons: Busca Pokémons de um clã.
 * - fetchAllHistory: Busca todo o histórico (com nome do treinador).
 * - fetchActiveHistory: Busca histórico ativo (empréstimos não devolvidos, com nome do treinador).
 * - postHistory: Registra um novo empréstimo validando a senha do treinador.
 * - returnPokemonAPI: Marca uma entrada de histórico como devolvida.
 * - deleteHistoryEntryAPI: Deleta uma entrada/grupo do histórico.
 * - deleteAllHistoryAPI: Deleta todo o histórico.
 * - addPokemonAPI: Adiciona um novo Pokémon a um clã.
 * - deletePokemonAPI: Deleta um Pokémon pelo ID.
 */
import { API_BASE_URL } from './config.js'; // Importa apenas o necessário
import { showSpinner, hideSpinner, displayError } from './ui.js';


async function fetchData(url, options = {}) {
    showSpinner();
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorData;
            try {
                // Tenta ler o corpo do erro como JSON
                errorData = await response.json();
            } catch (e) {
                // Se não for JSON, usa o statusText ou o status
                errorData = { error: response.statusText || `HTTP error! status: ${response.status}` };
            }
            // Lança o erro com a mensagem do backend ou uma mensagem genérica
            throw new Error(errorData.error || `HTTP error! status: ${response.status} - ${url}`);
        }

        // Trata respostas sem conteúdo (ex: DELETE bem-sucedido)
        if (response.status === 204) {
            return null; // Retorna null para indicar sucesso sem corpo
        }

        // Tenta analisar como JSON se o content-type indicar
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            // Retorna como texto se não for JSON
             const textResponse = await response.text();
             // Tenta retornar um objeto com message se for só texto simples (como algumas APIs retornam)
             return { message: textResponse };
        }

    } catch (error) {
        console.error('API Error:', error);
        displayError(`Falha na comunicação com a API: ${error.message}`);
        throw error; // Relança para tratamento posterior se necessário
    } finally {
        hideSpinner();
    }
}

// --- Funções da API ---

// Adiciona um treinador
export async function addTrainerAPI(name, email, password, adminPassword) { // adminPassword vem do input do modal
    if (!name || !email || !password || !adminPassword) {
        throw new Error("Nome, email, senha do treinador e senha do admin são obrigatórios.");
    }
    return await fetchData(`${API_BASE_URL}/trainers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            email: email,
            password: password,           // Senha do treinador a ser cadastrada
            admin_password: adminPassword // Senha do admin (digitada no modal) para autorizar
        }),
    });
}

export async function fetchTrainersAPI() {
    return await fetchData(`${API_BASE_URL}/trainers`);
}

// Deletar um Treinador (NOVA - requer senha admin no body)
export async function deleteTrainerAPI(trainerId, adminPassword) {
    if (!trainerId || !adminPassword) {
        throw new Error("ID do Treinador e Senha de Admin são obrigatórios para deleção.");
    }
    return await fetchData(`${API_BASE_URL}/trainers/${trainerId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // Envia a senha do admin no corpo da requisição
        body: JSON.stringify({ admin_password: adminPassword })
    });
}

export async function fetchClanPokemons(clan) {
    if (!clan || clan === 'home') return [];
    return await fetchData(`${API_BASE_URL}/clans/${clan}/pokemons`);
}


export async function fetchAllHistory() {
    // Backend já modificado para retornar trainer_name via JOIN
    return await fetchData(`${API_BASE_URL}/history`);
}


export async function fetchActiveHistory() {
     // Backend já modificado para retornar trainer_name via JOIN
    return await fetchData(`${API_BASE_URL}/history/active`);
}

// Aceita senha do treinador
export async function postHistory(trainerPassword, pokemonIds) {
     if (!trainerPassword || !pokemonIds || pokemonIds.length === 0) {
        throw new Error("Senha do treinador e Pokémons selecionados são necessários.");
    }
    return await fetchData(`${API_BASE_URL}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
             trainer_password: trainerPassword, // Envia a senha
             pokemons: pokemonIds
        }),
    });
}


export async function returnPokemonAPI(historyEntryId, trainerPassword) { // <<< Adicionado trainerPassword
    if (!trainerPassword) { // Validação básica no frontend
        throw new Error("Senha do treinador é necessária para a devolução.");
    }
    return await fetchData(`${API_BASE_URL}/history/${historyEntryId}/return`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       // Envia a senha no corpo da requisição
       body: JSON.stringify({ trainer_password: trainerPassword }) // <<< Enviando a senha
   });
}

export async function deleteHistoryEntryAPI(id) {
    // Nota: Idealmente, esta API deveria receber e validar a senha admin no backend
    if (!id) {
        throw new Error("ID da entrada do histórico é obrigatório para deleção.");
    }
    return await fetchData(`${API_BASE_URL}/history/${id}`, {
        method: 'DELETE',
        // headers: { 'Admin-Password': prompt('Senha Admin:') } // Exemplo se a API fosse protegida
    });
}


export async function deleteAllHistoryAPI() {
    // Nota: Idealmente, esta API deveria receber e validar a senha admin no backend
    return await fetchData(`${API_BASE_URL}/history`, {
        method: 'DELETE',
        // headers: { 'Admin-Password': prompt('Senha Admin:') } // Exemplo se a API fosse protegida
    });
}


export async function addPokemonAPI(clan, name, item) {
    // Nota: Idealmente, esta API deveria receber e validar a senha admin no backend
    if (!clan || !name) {
        throw new Error("Clã e nome do Pokémon são obrigatórios.");
    }
    return await fetchData(`${API_BASE_URL}/clans/${clan}/pokemons`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 'Admin-Password': prompt('Senha Admin:') // Exemplo se a API fosse protegida
        },
        body: JSON.stringify({ name, held_item: item || null }),
    });
}


export async function deletePokemonAPI(pokemonId) {
    // Nota: Idealmente, esta API deveria receber e validar a senha admin no backend
    if (!pokemonId) {
        throw new Error("ID do Pokémon é obrigatório para deleção.");
    }
    return await fetchData(`${API_BASE_URL}/pokemons/${pokemonId}`, {
        method: 'DELETE',
        // headers: { 'Admin-Password': prompt('Senha Admin:') } // Exemplo se a API fosse protegida
    });
}