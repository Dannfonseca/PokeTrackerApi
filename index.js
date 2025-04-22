// TODOLISTPOKEMON/poke-api/index.js
/**
 * Servidor backend Express para a API Pokes da House.
 * Define endpoints RESTful para gerenciar Pokémons, clãs, treinadores e empréstimos (histórico),
 * interagindo com o banco de dados SQLite (configurado em database.js).
 * Inclui campo de comentário opcional ao registrar empréstimos.
 * Endpoint GET /trainers não retorna mais email.
 * Inclui endpoint dedicado para devolução múltipla de Pokémons.
 * Adicionados endpoints para gerenciar e usar Listas Favoritas públicas.
 * Adicionado endpoint GET /pokemons/all-by-clan para listar todos os pokémons com status.
 * Listas Favoritas agora requerem senha do treinador para criação, edição e exclusão.
 */

import express from 'express';
import cors from 'cors';
import { db, uuidv4 } from './database.js';

const ADMIN_PASSWORD = 'russelgay24'; // Senha definida pelo administrador

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- Helper function para validar senha do treinador ---
async function validateTrainerPassword(password) {
    return new Promise((resolve, reject) => {
        if (!password) return reject({ status: 400, message: 'Senha do treinador é obrigatória.' });
        db.get('SELECT id, name FROM trainers WHERE password = ?', [password], (err, row) => {
            if (err) return reject({ status: 500, message: 'Erro interno ao validar treinador.' });
            if (!row) return reject({ status: 401, message: 'Senha do treinador inválida.' });
            resolve(row); // Retorna { id, name } do treinador validado
        });
    });
}

// --- Endpoints de Treinadores ---
// (Sem alterações aqui)
app.post('/trainers', (req, res) => {
    const { name, email, password, admin_password } = req.body;
    console.log(`[POST /trainers] Recebida requisição para adicionar treinador: ${name} (${email})`);
    if (admin_password !== ADMIN_PASSWORD) {
        console.warn(`[POST /trainers] Tentativa de adicionar treinador com senha de admin inválida.`);
        return res.status(403).json({ error: 'Senha de administrador incorreta.' });
    }
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, email e senha do treinador são obrigatórios.' });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
         return res.status(400).json({ error: 'Formato de email inválido.' });
    }
    const trainerId = uuidv4();
    const insertQuery = `INSERT INTO trainers (id, name, email, password) VALUES (?, ?, ?, ?)`;
     db.run(insertQuery, [trainerId, name.trim(), email.trim().toLowerCase(), password], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed: trainers.email')) {
                 console.warn(`[POST /trainers] Email já cadastrado: ${email}`);
                return res.status(409).json({ error: 'Email já cadastrado.' });
            }
            console.error(`[POST /trainers] Erro DB ao inserir ${name}:`, err.message);
            return res.status(500).json({ error: 'Erro interno ao cadastrar treinador.' });
        }
        console.log(`[POST /trainers] Treinador ${name} adicionado com ID ${trainerId}.`);
        res.status(201).json({ message: `Treinador ${name} adicionado com sucesso!`, trainerId: trainerId });
    });
});

app.get('/trainers', (req, res) => {
    console.log("[GET /trainers] Buscando lista de treinadores...");
    const query = `SELECT id, name FROM trainers ORDER BY name COLLATE NOCASE`;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /trainers] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar lista de treinadores.' });
        }
        console.log(`[GET /trainers] Retornando ${rows.length} treinadores (sem email).`);
        res.status(200).json(rows);
    });
});

app.delete('/trainers/:id', (req, res) => {
    const { id } = req.params;
    const { admin_password } = req.body;
    console.warn(`[DELETE /trainers/:id] Recebida requisição para DELETAR TREINADOR ID: ${id}`);
    if (admin_password !== ADMIN_PASSWORD) {
        console.warn(`[DELETE /trainers/:id] Tentativa de deletar treinador ${id} com senha de admin inválida.`);
        return res.status(403).json({ error: 'Senha de administrador incorreta.' });
    }
    if (!id) {
        return res.status(400).json({ error: 'ID do treinador é obrigatório.' });
    }
    const query = `DELETE FROM trainers WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) {
            console.error(`[DELETE /trainers/:id] Erro DB ao deletar treinador ID ${id}:`, err.message);
            return res.status(500).json({ error: 'Erro ao deletar treinador.' });
        }
        if (this.changes === 0) {
             console.warn(`[DELETE /trainers/:id] Nenhum treinador encontrado para deletar com ID ${id}.`);
            return res.status(404).json({ error: 'Treinador não encontrado.' });
        }
        console.log(`[DELETE /trainers/:id] Treinador ID ${id} deletado com sucesso. Linhas afetadas: ${this.changes}.`);
        res.status(200).json({ message: 'Treinador deletado com sucesso!' });
    });
});

// --- Endpoints de Pokémon e Clãs ---

app.get('/pokemons/available', (req, res) => {
    console.log("[GET /pokemons/available] Buscando pokémons DISPONÍVEIS...");
    const query = `
        SELECT p.id, p.name, p.held_item, c.name AS clan_name
        FROM pokemon p
        LEFT JOIN clan_pokemon cp ON p.id = cp.pokemon_id
        LEFT JOIN clan c ON cp.clan_id = c.id
        WHERE p.status = 'available'  -- Apenas disponíveis
        ORDER BY c.name COLLATE NOCASE, p.name COLLATE NOCASE
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /pokemons/available] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar pokémons disponíveis.' });
        }
        console.log(`[GET /pokemons/available] Encontrados ${rows.length} pokémons disponíveis.`);
        const groupedPokemons = {};
        rows.forEach(row => {
            const clan = row.clan_name || 'Sem Clã';
            if (!groupedPokemons[clan]) {
                groupedPokemons[clan] = [];
            }
            groupedPokemons[clan].push({
                id: row.id,
                name: row.name,
                held_item: row.held_item
                // Não inclui status aqui pois são todos 'available'
            });
        });
        res.status(200).json(groupedPokemons);
    });
});

// <<< NOVO ENDPOINT >>>
app.get('/pokemons/all-by-clan', (req, res) => {
    console.log("[GET /pokemons/all-by-clan] Buscando TODOS os pokémons por clã...");
    const query = `
        SELECT p.id, p.name, p.held_item, p.status, c.name AS clan_name
        FROM pokemon p
        LEFT JOIN clan_pokemon cp ON p.id = cp.pokemon_id
        LEFT JOIN clan c ON cp.clan_id = c.id
        ORDER BY c.name COLLATE NOCASE, p.name COLLATE NOCASE
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /pokemons/all-by-clan] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar todos os pokémons.' });
        }
        console.log(`[GET /pokemons/all-by-clan] Encontrados ${rows.length} pokémons no total.`);
        const groupedPokemons = {};
        rows.forEach(row => {
            const clan = row.clan_name || 'Sem Clã'; // Agrupa pokémons sem clã se houver
            if (!groupedPokemons[clan]) {
                groupedPokemons[clan] = [];
            }
            groupedPokemons[clan].push({
                id: row.id,
                name: row.name,
                held_item: row.held_item,
                status: row.status // Inclui o status aqui
            });
        });
        // Ordena os clãs alfabeticamente (exceto "Sem Clã", se existir)
        const sortedGroupedPokemons = Object.keys(groupedPokemons)
            .sort((a, b) => {
                if (a === 'Sem Clã') return 1;
                if (b === 'Sem Clã') return -1;
                return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
            })
            .reduce((obj, key) => {
                obj[key] = groupedPokemons[key];
                return obj;
            }, {});

        res.status(200).json(sortedGroupedPokemons);
    });
});


app.get('/pokemons/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT id, name FROM pokemon WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error(`Erro ao buscar Pokémon ID ${id}:`, err.message);
            return res.status(500).json({ error: 'Erro interno ao buscar Pokémon.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Pokémon não encontrado.' });
        }
        res.status(200).json(row);
    });
});

app.get('/clans/:clan/pokemons', (req, res) => {
    const { clan } = req.params;
    console.log(`[GET /clans/:clan/pokemons] Buscando pokémons para clã: ${clan}`);
    const query = `
        SELECT p.id, p.name, p.held_item, p.status, p.version
        FROM pokemon p
        JOIN clan_pokemon cp ON p.id = cp.pokemon_id
        JOIN clan c ON cp.clan_id = c.id
        WHERE c.name = ? COLLATE NOCASE
        ORDER BY p.name COLLATE NOCASE`;
    db.all(query, [clan], (err, rows) => {
        if (err) {
             console.error(`[GET /clans/:clan/pokemons] Erro DB para clã ${clan}:`, err.message);
             return res.status(500).json({ error: 'Erro ao buscar pokémons do clã.' });
        }
        console.log(`[GET /clans/:clan/pokemons] Encontrados ${rows.length} pokémons para clã ${clan}.`);
        res.status(200).json(rows);
    });
});

app.post('/clans/:clan/pokemons', (req, res) => {
    const { clan } = req.params;
    const { name, held_item } = req.body;
    console.log(`[POST /clans/:clan/pokemons] Adicionando ${name} ao clã ${clan}`);
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Nome do Pokémon é obrigatório.' });
    }
    db.get('SELECT id FROM clan WHERE name = ? COLLATE NOCASE', [clan], (err, clanRow) => {
        if (err) {
            console.error(`[POST /clans/:clan/pokemons] Erro ao verificar clã ${clan}:`, err.message);
            return res.status(500).json({ error: 'Erro interno ao verificar clã.' });
        }
        if (!clanRow) {
            return res.status(404).json({ error: `Clã '${clan}' não encontrado.` });
        }
        const clanId = clanRow.id;
        const pokemonId = uuidv4();
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run(`INSERT INTO pokemon (id, name, held_item) VALUES (?, ?, ?)`,
                   [pokemonId, name.trim(), held_item || null], function (insertPokeErr) {
                if (insertPokeErr) {
                    console.error(`[POST /clans/:clan/pokemons] Erro ao inserir Pokémon ${name}:`, insertPokeErr.message);
                    db.run('ROLLBACK');
                    const statusCode = insertPokeErr.message.includes('UNIQUE constraint') ? 409 : 500;
                    return res.status(statusCode).json({ error: `Erro ao inserir Pokémon: ${insertPokeErr.message}` });
                }
                console.log(`[POST /clans/:clan/pokemons] Pokémon ${name} inserido com ID ${pokemonId}.`);
                const clanPokemonId = uuidv4();
                db.run(`INSERT INTO clan_pokemon (id, clan_id, pokemon_id) VALUES (?, ?, ?)`,
                       [clanPokemonId, clanId, pokemonId], function (insertClanPokeErr) {
                    if (insertClanPokeErr) {
                        console.error(`[POST /clans/:clan/pokemons] Erro ao associar Pokémon ${pokemonId} ao clã ${clanId}:`, insertClanPokeErr.message);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Erro ao associar Pokémon ao clã.' });
                    }
                     console.log(`[POST /clans/:clan/pokemons] Associação criada ID ${clanPokemonId}. Commitando.`);
                    db.run('COMMIT', (commitErr) => {
                         if(commitErr){
                            console.error(`[POST /clans/:clan/pokemons] Erro ao commitar adição:`, commitErr.message);
                            return res.status(500).json({ error: 'Erro ao finalizar adição.' });
                         }
                         res.status(201).json({ message: `Pokémon ${name} adicionado ao clã ${clan} com sucesso!`, pokemonId: pokemonId });
                    });
                });
            });
        });
    });
});

app.delete('/pokemons/:id', (req, res) => {
    const { id } = req.params;
    console.warn(`[DELETE /pokemons/:id] Recebida requisição para DELETAR POKÉMON ID: ${id}`);
    // Idealmente, validar senha Admin aqui
    if (typeof id !== 'string' || id.length < 10) {
         return res.status(400).json({ error: 'ID de Pokémon inválido.' });
    }
    db.get('SELECT status FROM pokemon WHERE id = ?', [id], (err, pokemon) => {
        if (err) {
            console.error(`[DELETE /pokemons/:id] Erro ao verificar status do Pokémon ${id}:`, err.message);
            return res.status(500).json({ error: 'Erro ao verificar Pokémon.' });
        }
        if (!pokemon) {
             return res.status(404).json({ error: 'Pokémon não encontrado para verificar status.' });
        }
        if (pokemon.status === 'borrowed') {
            console.warn(`[DELETE /pokemons/:id] Tentativa de deletar Pokémon ${id} que está emprestado.`);
            return res.status(409).json({ error: 'Não é possível deletar um Pokémon que está atualmente emprestado. Devolva-o primeiro.' });
        }
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('DELETE FROM clan_pokemon WHERE pokemon_id = ?', [id], function(delCpErr){
                if(delCpErr){
                    console.error(`[DELETE /pokemons/:id] Erro ao deletar de clan_pokemon para ID ${id}:`, delCpErr.message);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Erro ao desassociar Pokémon do clã.' });
                }
                console.log(`[DELETE /pokemons/:id] Associação com clã removida para ID ${id}. Linhas afetadas: ${this.changes}`);
                db.run('DELETE FROM pokemon WHERE id = ?', [id], function(delPokeErr) {
                    if (delPokeErr) {
                        console.error(`[DELETE /pokemons/:id] Erro DB ao deletar Pokémon ID ${id}:`, delPokeErr.message);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Erro ao deletar Pokémon.' });
                    }
                    if (this.changes === 0) {
                        console.warn(`[DELETE /pokemons/:id] Nenhuma linha deletada na tabela pokemon para ID ${id} (já deletado?).`);
                         db.run('ROLLBACK');
                        return res.status(404).json({ error: 'Pokémon não encontrado para deletar (pode ter sido deletado por outra requisição).' });
                    }
                    console.log(`[DELETE /pokemons/:id] Pokémon ID ${id} deletado com sucesso. Linhas afetadas: ${this.changes}. Commitando.`);
                     db.run('COMMIT', (commitErr) => {
                         if(commitErr){
                             console.error(`[DELETE /pokemons/:id] Erro ao commitar deleção:`, commitErr.message);
                             return res.status(500).json({ error: 'Erro ao finalizar deleção.' });
                         }
                          res.status(200).json({ message: 'Pokémon deletado com sucesso!' });
                     });
                });
            });
        });
    });
});


// --- Endpoints de Histórico ---
// (Sem alterações aqui)
app.post('/history', async (req, res) => {
    const { pokemons, trainer_password, comment } = req.body;
    const dateISO = new Date().toISOString();

    if (!pokemons || !Array.isArray(pokemons) || pokemons.length === 0) return res.status(400).json({ error: 'Lista de Pokémons inválida ou vazia.' });

    try {
        const trainer = await validateTrainerPassword(trainer_password); // Valida senha e obtém ID/nome
        const trainerId = trainer.id;
        const trainerName = trainer.name;
        console.log(`[POST /history] Treinador ${trainerName} (ID: ${trainerId}) validado para empréstimo.`);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) throw new Error(`Erro ao iniciar transação: ${beginErr.message}`);

                const validationPromises = pokemons.map(pokemonId => {
                    return new Promise((resolve, reject) => {
                        if (typeof pokemonId !== 'string' || pokemonId.length < 10) return reject(new Error(`ID de Pokémon inválido: ${pokemonId}`));
                        db.get('SELECT name, status FROM pokemon WHERE id = ?', [pokemonId], (err, row) => {
                            if (err) return reject(new Error(`Erro DB ao verificar Pokémon ${pokemonId}: ${err.message}`));
                            if (!row) return reject(new Error(`Pokémon com ID ${pokemonId} não encontrado.`));
                            if (row.status !== 'available') return reject(new Error(`Pokémon ${row.name || pokemonId} não está disponível (status: ${row.status}).`));
                            resolve({ id: pokemonId, name: row.name });
                        });
                    });
                });

                Promise.all(validationPromises)
                    .then(pokemonData => {
                        const updatePromises = pokemonData.map(({ id }) => {
                            return new Promise((resolve, reject) => {
                                db.run('UPDATE pokemon SET status = "borrowed" WHERE id = ? AND status = "available"', [id], function (err) {
                                    if (err) return reject(new Error(`Erro DB ao atualizar status de ${id}: ${err.message}`));
                                    if (this.changes === 0) return reject(new Error(`Falha ao reservar Pokémon ${id} (status pode ter mudado).`));
                                    resolve();
                                });
                            });
                        });
                        return Promise.all(updatePromises).then(() => pokemonData);
                    })
                    .then(pokemonData => {
                        const historyPromises = pokemonData.map(({ id, name }) => {
                            return new Promise((resolve, reject) => {
                                db.run('INSERT INTO history (pokemon, pokemon_name, trainer_id, date, comment) VALUES (?, ?, ?, ?, ?)',
                                    [id, name, trainerId, dateISO, comment || null], function (err) {
                                    if (err) return reject(new Error(`Erro DB ao inserir histórico para ${id}: ${err.message}`));
                                    resolve(this.lastID);
                                });
                            });
                        });
                        return Promise.all(historyPromises);
                    })
                    .then(() => {
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) throw new Error(`Erro ao commitar: ${commitErr.message}`);
                            res.status(201).json({ message: `Pokémons registrados com sucesso para ${trainerName}!` });
                        });
                    })
                    .catch(err => {
                        console.error(`[POST /history] Erro durante transação: ${err.message}`);
                        db.run('ROLLBACK');
                        const statusCode = err.message.includes('disponível') || err.message.includes('encontrado') || err.message.includes('inválido') || err.message.includes('reservar') ? 400 : 500;
                        res.status(statusCode).json({ error: err.message });
                    });
            });
        });
    } catch (error) {
        console.error(`[POST /history] Erro pré-transação: ${error.message}`);
        res.status(error.status || 500).json({ error: error.message });
    }
});


app.get('/history', (req, res) => {
    console.log("[GET /history] Buscando histórico completo...");
    const query = `
        SELECT
            h.id, h.pokemon, h.pokemon_name,
            h.trainer_id, t.name AS trainer_name,
            h.date, h.returned, h.returnDate,
            c.name AS clan_name,
            h.comment
        FROM history h
        LEFT JOIN trainers t ON h.trainer_id = t.id
        LEFT JOIN pokemon p ON h.pokemon = p.id
        LEFT JOIN clan_pokemon cp ON p.id = cp.pokemon_id
        LEFT JOIN clan c ON cp.clan_id = c.id
        ORDER BY h.date DESC, c.name COLLATE NOCASE, p.name COLLATE NOCASE
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /history] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar histórico.'});
        }
        console.log(`[GET /history] Retornando ${rows.length} registros.`);
        res.status(200).json(rows);
    });
});

app.get('/history/active', (req, res) => {
    console.log("[GET /history/active] Buscando histórico ativo...");
    const query = `
        SELECT
            h.id,
            h.trainer_id,
            t.name AS trainer_name,
            h.date,
            p.name AS pokemon_name,
            c.name AS clan_name,
            h.comment
        FROM history h
        JOIN trainers t ON h.trainer_id = t.id
        JOIN pokemon p ON h.pokemon = p.id
        LEFT JOIN clan_pokemon cp ON p.id = cp.pokemon_id
        LEFT JOIN clan c ON cp.clan_id = c.id
        WHERE h.returned = 0
        ORDER BY h.date DESC, h.id ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /history/active] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar histórico ativo.' });
        }
        console.log(`[GET /history/active] ${rows.length} registros ativos encontrados, agrupando...`);
        const groupedHistory = {};
        rows.forEach(entry => {
            const key = `${entry.trainer_name}-${entry.date}`;
            if (!groupedHistory[key]) {
                groupedHistory[key] = {
                    trainer_id: entry.trainer_id,
                    trainer_name: entry.trainer_name,
                    date: entry.date,
                    pokemons: [],
                    comment: entry.comment || null
                };
            }
            groupedHistory[key].pokemons.push({
                name: entry.pokemon_name,
                clan: entry.clan_name || 'unknown'
            });
        });
        const result = Object.values(groupedHistory);
        console.log(`[GET /history/active] Retornando ${result.length} grupos ativos.`);
        res.status(200).json(result);
    });
});

app.put('/history/:id/return', async (req, res) => {
    const { id } = req.params;
    const { trainer_password } = req.body;
    const returnDateISO = new Date().toISOString();

    if (!trainer_password) return res.status(400).json({ error: 'Senha do treinador é obrigatória para devolução.' });
    console.log(`[PUT /history/:id/return] Devolução individual para ID ${id}.`);

    try {
        await validateTrainerPassword(trainer_password); // Valida a senha antes de prosseguir

        db.get('SELECT pokemon FROM history WHERE id = ? AND returned = 0', [id], (err, historyEntry) => {
            if (err) throw new Error(`Erro DB ao buscar histórico ${id}: ${err.message}`);
            if (!historyEntry) return res.status(404).json({ error: 'Registro de histórico não encontrado ou já devolvido.' });

            const pokemonId = historyEntry.pokemon;
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('UPDATE pokemon SET status = "available" WHERE id = ?', [pokemonId], function(updateErr) {
                    if (updateErr) throw new Error(`Erro ao atualizar status do Pokémon ${pokemonId}: ${updateErr.message}`);
                    db.run('UPDATE history SET returned = 1, returnDate = ? WHERE id = ?', [returnDateISO, id], function(historyErr) {
                        if (historyErr) throw new Error(`Erro ao atualizar histórico ${id}: ${historyErr.message}`);
                        if (this.changes === 0) throw new Error('Registro de histórico não pôde ser atualizado (concorrência?).');
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) throw new Error(`Erro ao commitar devolução: ${commitErr.message}`);
                            res.status(200).json({ message: 'Pokémon devolvido com sucesso!' });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error(`[PUT /history/:id/return] Erro: ${error.message}`);
        if (db.inTransaction) db.run('ROLLBACK');
        res.status(error.status || 500).json({ error: error.message });
    }
});

app.put('/history/return-multiple', async (req, res) => {
    const { historyEntryIds, trainer_password } = req.body;
    const returnDateISO = new Date().toISOString();

    if (!Array.isArray(historyEntryIds) || historyEntryIds.length === 0) return res.status(400).json({ error: 'Lista de IDs de histórico inválida ou vazia.' });

    console.log(`[PUT /history/return-multiple] Devolução múltipla para IDs: ${historyEntryIds.join(', ')}`);

    try {
        const trainer = await validateTrainerPassword(trainer_password); // Valida a senha e pega ID
        const trainerId = trainer.id;
        console.log(`[PUT /history/return-multiple] Senha validada para treinador ID: ${trainerId}`);

        const placeholders = historyEntryIds.map(() => '?').join(',');
        const pokemonIdsToReturn = await new Promise((resolve, reject) => {
            const query = `SELECT DISTINCT pokemon FROM history WHERE id IN (${placeholders}) AND returned = 0 AND trainer_id = ?`;
            db.all(query, [...historyEntryIds, trainerId], (err, rows) => {
                 if (err) return reject({ status: 500, message: 'Erro DB ao buscar Pokémons para devolver.' });
                 if (!rows || rows.length === 0) return reject({ status: 400, message: 'Nenhum registro válido ou pendente encontrado para os IDs e treinador fornecidos.'});
                 resolve(rows.map(r => r.pokemon));
            });
        });
         console.log(`[PUT /history/return-multiple] IDs de Pokémon a ter status atualizado: ${pokemonIdsToReturn.join(', ')}`);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            try {
                const pokemonPlaceholders = pokemonIdsToReturn.map(() => '?').join(',');
                db.run(`UPDATE pokemon SET status = 'available' WHERE id IN (${pokemonPlaceholders})`, pokemonIdsToReturn, function(pokeErr){
                    if(pokeErr) throw new Error(`Erro ao atualizar status dos Pokémons: ${pokeErr.message}`);
                    console.log(`[PUT /history/return-multiple] Status de ${this.changes} Pokémons atualizado para 'available'.`);
                });

                const historyPlaceholders = historyEntryIds.map(() => '?').join(',');
                db.run(`UPDATE history SET returned = 1, returnDate = ? WHERE id IN (${historyPlaceholders}) AND returned = 0 AND trainer_id = ?`,
                      [returnDateISO, ...historyEntryIds, trainerId], function(histErr){
                     if(histErr) throw new Error(`Erro ao atualizar histórico: ${histErr.message}`);
                     if(this.changes === 0) throw new Error('Nenhuma entrada de histórico pôde ser marcada como devolvida (concorrência?).');
                     console.log(`[PUT /history/return-multiple] ${this.changes} entradas de histórico atualizadas.`);
                     db.run('COMMIT', (commitErr) => {
                         if(commitErr) throw new Error(`Erro ao commitar devolução múltipla: ${commitErr.message}`);
                         console.log(`[PUT /history/return-multiple] Devolução múltipla commitada.`);
                         res.status(200).json({ message: `${this.changes} Pokémon(s) devolvido(s) com sucesso!` });
                     });
                 });
            } catch (error) {
                console.error(`[PUT /history/return-multiple] Erro durante transação: ${error.message}`);
                db.run('ROLLBACK');
                 res.status(error.status || 500).json({ error: error.message });
            }
        });

    } catch (error) {
         console.error(`[PUT /history/return-multiple] Erro pré-transação: ${error.message}`);
         res.status(error.status || 500).json({ error: error.message });
    }
});

app.delete('/history/:id', (req, res) => {
    const { id } = req.params;
    // Idealmente, validar senha admin aqui
    db.run('DELETE FROM history WHERE id = ?', [id], function(err) {
        if (err) {
            console.error(`Erro ao deletar registro de histórico ${id}:`, err.message);
            return res.status(500).json({ error: 'Erro ao deletar registro.' });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
        res.status(200).json({ message: 'Registro de histórico deletado com sucesso!' });
    });
});

app.delete('/history', (req, res) => {
    // Idealmente, validar senha admin aqui
    db.run('DELETE FROM history', [], function(err) {
        if (err) {
            console.error('Erro ao deletar todo o histórico:', err.message);
            return res.status(500).json({ error: 'Erro ao deletar histórico completo.' });
        }
        res.status(200).json({ message: `Histórico completo deletado (${this.changes} registros)!` });
    });
});


// --- Endpoints de Listas Favoritas ---
// (Sem alterações nos existentes, já lidam com senha corretamente)
app.get('/favorite-lists', (req, res) => {
    console.log("[GET /favorite-lists] Buscando todas as listas favoritas...");
    const query = `
        SELECT fl.id, fl.name, fl.updated_at, t.name AS trainer_name
        FROM favorite_lists fl
        JOIN trainers t ON fl.trainer_id = t.id
        ORDER BY t.name COLLATE NOCASE, fl.name COLLATE NOCASE`;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /favorite-lists] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar listas favoritas.' });
        }
        console.log(`[GET /favorite-lists] Retornando ${rows.length} listas.`);
        res.status(200).json(rows);
    });
});

app.post('/favorite-lists', async (req, res) => {
    const { name, pokemonIds, trainer_password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Nome da lista é obrigatório.' });
    if (!Array.isArray(pokemonIds) || pokemonIds.length === 0) return res.status(400).json({ error: 'É necessário fornecer pelo menos um ID de Pokémon.' });
    if (pokemonIds.some(id => typeof id !== 'string' || id.trim().length === 0)) return res.status(400).json({ error: 'Array de IDs de Pokémon contém IDs inválidos.' });

    try {
        const trainer = await validateTrainerPassword(trainer_password);
        const trainerId = trainer.id;
        const trainerName = trainer.name;
        console.log(`[POST /favorite-lists] Treinador '${trainerName}' (ID: ${trainerId}) validado para criar lista.`);

        const listId = uuidv4();
        const listName = name.trim();

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('INSERT INTO favorite_lists (id, name, trainer_id) VALUES (?, ?, ?)', [listId, listName, trainerId], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    const statusCode = err.message.includes('UNIQUE constraint failed') ? 409 : 500;
                    const message = statusCode === 409 ? `Você já possui uma lista com o nome '${listName}'.` : 'Erro ao salvar a lista.';
                    return res.status(statusCode).json({ error: message });
                }
                const stmt = db.prepare('INSERT INTO favorite_list_pokemons (id, list_id, pokemon_id) VALUES (?, ?, ?)');
                let insertErrors = false;
                pokemonIds.forEach(pokemonId => {
                    if (insertErrors) return;
                    stmt.run(uuidv4(), listId, pokemonId, function(itemErr) { if (itemErr) insertErrors = true; });
                });
                stmt.finalize((finalizeErr) => {
                     if (finalizeErr || insertErrors) {
                         db.run('ROLLBACK');
                         const errorMsg = 'Erro ao adicionar Pokémons à lista (verifique IDs).';
                         return res.status(400).json({ error: errorMsg });
                     } else {
                         db.run('COMMIT', (commitErr) => {
                             if (commitErr) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Erro ao finalizar criação da lista.' }); }
                             res.status(201).json({ message: `Lista '${listName}' criada com sucesso por ${trainerName}!`, listId: listId });
                         });
                     }
                });
            });
        });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});

app.get('/favorite-lists/:listId', (req, res) => {
    const { listId } = req.params;
    console.log(`[GET /favorite-lists/:listId] Buscando detalhes da lista ID: ${listId}`);
    const listQuery = 'SELECT id, name, trainer_id FROM favorite_lists WHERE id = ?';
    const pokemonsQuery = `
        SELECT p.id, p.name, p.held_item, p.status
        FROM pokemon p
        JOIN favorite_list_pokemons flp ON p.id = flp.pokemon_id
        WHERE flp.list_id = ?
        ORDER BY p.name COLLATE NOCASE`;

    db.get(listQuery, [listId], (listErr, listRow) => {
        if (listErr) return res.status(500).json({ error: 'Erro ao buscar lista.' });
        if (!listRow) return res.status(404).json({ error: 'Lista favorita não encontrada.' });

        db.all(pokemonsQuery, [listId], (pokemonsErr, pokemonRows) => {
            if (pokemonsErr) return res.status(500).json({ error: 'Erro ao buscar Pokémons da lista.' });
            res.status(200).json({
                id: listRow.id,
                name: listRow.name,
                trainer_id: listRow.trainer_id,
                pokemons: pokemonRows
            });
        });
    });
});

app.put('/favorite-lists/:listId', async (req, res) => {
    const { listId } = req.params;
    const { name, pokemonIds, trainer_password } = req.body;

    if (!name && !Array.isArray(pokemonIds)) return res.status(400).json({ error: 'Novo nome ou lista de IDs é necessário.' });
    if (name && (typeof name !== 'string' || name.trim().length === 0)) return res.status(400).json({ error: 'Nome inválido.' });
    if (pokemonIds && (!Array.isArray(pokemonIds))) return res.status(400).json({ error: 'pokemonIds deve ser um array.' });
    if (pokemonIds && pokemonIds.some(id => typeof id !== 'string' || id.trim().length === 0)) return res.status(400).json({ error: 'Array pokemonIds contém IDs inválidos.' });

    try {
        const trainer = await validateTrainerPassword(trainer_password);
        const trainerId = trainer.id;

        const listOwner = await new Promise((resolve, reject) => {
            db.get('SELECT trainer_id FROM favorite_lists WHERE id = ?', [listId], (err, row) => {
                 if (err) reject({ status: 500, message: 'Erro ao verificar dono da lista.' });
                 else if (!row) reject({ status: 404, message: 'Lista não encontrada.' });
                 else resolve(row.trainer_id);
            });
        });

        if (listOwner !== trainerId) {
            return res.status(403).json({ error: 'Você não tem permissão para editar esta lista.' });
        }
        console.log(`[PUT /favorite-lists/:listId] Treinador ID ${trainerId} autorizado a editar lista ${listId}.`);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            let operations = [];
            if (name) {
                operations.push(new Promise((resolve, reject) => {
                    db.get('SELECT id FROM favorite_lists WHERE name = ? AND trainer_id = ? AND id != ?', [name.trim(), trainerId, listId], (checkErr, existing) => {
                         if (checkErr) return reject({ status: 500, message: 'Erro ao verificar nome duplicado.' });
                         if (existing) return reject({ status: 409, message: `Você já possui outra lista com o nome '${name.trim()}'.` });
                         db.run('UPDATE favorite_lists SET name = ? WHERE id = ?', [name.trim(), listId], function(err) {
                             if (err) reject({ status: 500, message: 'Erro ao atualizar nome da lista.' });
                             else resolve();
                         });
                    });
                }));
            }
            if (pokemonIds) {
                operations.push(new Promise((resolve, reject) => {
                     db.run('DELETE FROM favorite_list_pokemons WHERE list_id = ?', [listId], err => err ? reject({ status: 500, message: 'Erro ao limpar pokémons antigos.' }) : resolve());
                }));
                if (pokemonIds.length > 0) {
                     operations.push(new Promise((resolve, reject) => {
                         const stmt = db.prepare('INSERT INTO favorite_list_pokemons (id, list_id, pokemon_id) VALUES (?, ?, ?)');
                         let itemErrors = false;
                         pokemonIds.forEach(pId => { if(itemErrors) return; stmt.run(uuidv4(), listId, pId, e => { if(e) itemErrors = true; }); });
                         stmt.finalize(e => e || itemErrors ? reject({ status: 400, message: 'Erro ao adicionar Pokémons (verifique IDs).' }) : resolve());
                     }));
                }
            }
            Promise.all(operations)
                .then(() => {
                    db.run('COMMIT', e => e ? res.status(500).json({ error: 'Erro ao finalizar atualização.' }) : res.status(200).json({ message: 'Lista atualizada com sucesso!' }));
                })
                .catch(error => {
                     db.run('ROLLBACK');
                     res.status(error.status || 500).json({ error: error.message });
                });
        });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});

app.delete('/favorite-lists/:listId', async (req, res) => {
    const { listId } = req.params;
    const { trainer_password, admin_password } = req.body;

    console.log(`[DELETE /favorite-lists/:listId] Tentativa de deletar lista ID: ${listId}`);

    try {
        const listInfo = await new Promise((resolve, reject) => {
             db.get('SELECT trainer_id, name FROM favorite_lists WHERE id = ?', [listId], (err, row) => {
                 if (err) reject({ status: 500, message: 'Erro ao buscar lista.' });
                 else if (!row) reject({ status: 404, message: 'Lista favorita não encontrada.' });
                 else resolve(row);
             });
        });
        const ownerId = listInfo.trainer_id;
        const listName = listInfo.name;

        let authorized = false;
        let deletedBy = "dono";

        if (admin_password && admin_password === ADMIN_PASSWORD) {
            authorized = true;
            deletedBy = "admin";
            console.log(`[DELETE /favorite-lists/:listId] Autorizado por ADMIN para deletar lista '${listName}'.`);
        }
        else if (trainer_password) {
            try {
                const trainer = await validateTrainerPassword(trainer_password);
                if (trainer.id === ownerId) {
                    authorized = true;
                    console.log(`[DELETE /favorite-lists/:listId] Autorizado por dono (ID ${trainer.id}) para deletar lista '${listName}'.`);
                } else {
                    console.warn(`[DELETE /favorite-lists/:listId] Senha válida, mas treinador ${trainer.id} não é o dono da lista ${listId} (dono: ${ownerId}).`);
                }
            } catch (validationError) {
                 console.log(`[DELETE /favorite-lists/:listId] Validação da senha do treinador falhou: ${validationError.message}`);
            }
        }

        if (!authorized) {
            return res.status(403).json({ error: 'Senha inválida ou permissão negada para deletar esta lista.' });
        }

        db.run('DELETE FROM favorite_lists WHERE id = ?', [listId], function(err) {
            if (err) {
                console.error(`[DELETE /favorite-lists/:listId] Erro DB ao deletar lista ${listId}:`, err.message);
                return res.status(500).json({ error: 'Erro ao deletar lista favorita.' });
            }
            console.log(`[DELETE /favorite-lists/:listId] Lista '${listName}' (ID: ${listId}) deletada com sucesso por ${deletedBy}.`);
            res.status(200).json({ message: `Lista '${listName}' deletada com sucesso!` });
        });

    } catch (error) {
         console.error(`[DELETE /favorite-lists/:listId] Erro: ${error.message}`);
         res.status(error.status || 500).json({ error: error.message });
    }
});


app.post('/favorite-lists/:listId/borrow', async (req, res) => {
    const { listId } = req.params;
    const { trainer_password, comment } = req.body;
    const dateISO = new Date().toISOString();

    console.log(`[POST /favorite-lists/:listId/borrow] Tentativa de empréstimo da lista ${listId}.`);
    try {
        const trainer = await validateTrainerPassword(trainer_password); // Valida quem está pegando
        const trainerId = trainer.id;
        const trainerName = trainer.name;
        console.log(`[POST /favorite-lists/:listId/borrow] Treinador '${trainerName}' (ID: ${trainerId}) validado.`);

         const pokemonIdsInList = await new Promise((resolve, reject) => {
            const query = 'SELECT pokemon_id FROM favorite_list_pokemons WHERE list_id = ?';
            db.all(query, [listId], (err, rows) => {
                if (err) reject({ status: 500, message: 'Erro ao buscar Pokémons da lista.' });
                else if (!rows || rows.length === 0) reject({ status: 404, message: 'Lista não encontrada ou vazia.' });
                else resolve(rows.map(r => r.pokemon_id));
            });
        });
        console.log(`[POST /favorite-lists/:listId/borrow] Lista ${listId} contém IDs: ${pokemonIdsInList.join(', ')}`);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', async (beginErr) => {
                 if (beginErr) return res.status(500).json({ error: 'Erro interno ao iniciar empréstimo.' });
                 try {
                    const placeholders = pokemonIdsInList.map(() => '?').join(',');
                    const pokemonDetails = await new Promise((resolve, reject) => {
                        const query = `SELECT id, name, status FROM pokemon WHERE id IN (${placeholders})`;
                        db.all(query, pokemonIdsInList, (err, rows) => {
                            if (err) return reject(new Error(`Erro ao verificar status: ${err.message}`));
                            const foundIds = rows.map(r => r.id);
                            const missingIds = pokemonIdsInList.filter(id => !foundIds.includes(id));
                            if (missingIds.length > 0) console.warn(`[BORROW LIST] Pokémons não encontrados: ${missingIds.join(', ')}`);
                            if (rows.length === 0) return reject(new Error('Nenhum dos Pokémons desta lista foi encontrado.'));
                            resolve(rows);
                        });
                    });
                    const availablePokemons = pokemonDetails.filter(p => p.status === 'available');
                    const unavailablePokemons = pokemonDetails.filter(p => p.status !== 'available');
                    if (availablePokemons.length === 0) throw new Error('Nenhum Pokémon desta lista está disponível.');
                    console.log(`[BORROW LIST] Disponíveis: ${availablePokemons.map(p=>p.name).join(', ')}`);
                    if (unavailablePokemons.length > 0) console.warn(`[BORROW LIST] Indisponíveis: ${unavailablePokemons.map(p=>p.name).join(', ')}`);

                    const availableIds = availablePokemons.map(p => p.id);
                    const updatePlaceholders = availableIds.map(() => '?').join(',');
                    await new Promise((resolve, reject) => {
                        const query = `UPDATE pokemon SET status = 'borrowed' WHERE id IN (${updatePlaceholders}) AND status = 'available'`;
                        db.run(query, availableIds, function (err) {
                             if (err) return reject(new Error(`Erro ao atualizar status: ${err.message}`));
                             if (this.changes !== availableIds.length) return reject(new Error(`Falha ao reservar (status pode ter mudado).`));
                             resolve();
                         });
                     });
                    const stmt = db.prepare('INSERT INTO history (pokemon, pokemon_name, trainer_id, date, comment) VALUES (?, ?, ?, ?, ?)');
                    let historyErrors = false;
                    availablePokemons.forEach(p => { if(historyErrors) return; stmt.run(p.id, p.name, trainerId, dateISO, comment || null, e => { if(e) historyErrors = true; }); });
                    await new Promise((resolve, reject) => { stmt.finalize(e => e || historyErrors ? reject(new Error(`Erro ao registrar histórico.`)) : resolve()); });

                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) throw new Error(`Erro ao commitar: ${commitErr.message}`);
                        let message = `${availablePokemons.length} Pokémon(s) emprestado(s) para ${trainerName}!`;
                        if(unavailablePokemons.length > 0) message += ` (${unavailablePokemons.map(p=>p.name).join(', ')} indisponíveis).`;
                        res.status(201).json({ message: message, borrowedCount: availablePokemons.length });
                    });
                 } catch (error) {
                     console.error(`[BORROW LIST] Erro DENTRO da TX: ${error.message}`);
                     db.run('ROLLBACK');
                     const statusCode = error.message.includes('disponível') || error.message.includes('encontrado') || error.message.includes('reservar') ? 409 : 500;
                     res.status(statusCode).json({ error: error.message });
                 }
            });
        });
    } catch (error) {
        console.error(`[BORROW LIST] Erro PRÉ-TX: ${error.message}`);
        res.status(error.status || 500).json({ error: error.message });
    }
});


// --- Endpoint de Health Check ---
app.get('/health', (req, res) => {
    console.log("[GET /health] Ping received.");
    res.status(200).send('OK');
});

// --- Server Start ---
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});