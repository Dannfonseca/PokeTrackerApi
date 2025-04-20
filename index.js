// TODOLISTPOKEMON/poke-api/index.js
/**
 * Servidor backend Express para a API Pokes da House.
 * Define endpoints RESTful para gerenciar Pokémons, clãs, treinadores e empréstimos (histórico),
 * interagindo com o banco de dados SQLite (configurado em database.js).
 * Inclui campo de comentário opcional e duração do empréstimo ao registrar histórico.
 *
 * Principais Endpoints:
 * - POST /trainers : (Admin) Adiciona um novo treinador.
 * - GET /pokemons/:id : Busca um Pokémon por ID.
 * - POST /history : Registra um novo empréstimo (senha, pokemons, duração[opcional], comentário[opcional]).
 * - GET /clans/:clan/pokemons : Lista Pokémons de um clã específico.
 * - GET /history : Retorna todo o histórico (com nome do treinador, comentário e tempo esperado de devolução).
 * - GET /history/active : Retorna os empréstimos ativos (com nome, comentário e tempo esperado de devolução), agrupados.
 * - PUT /history/:id/return : Marca uma entrada de histórico como devolvida.
 * - POST /clans/:clan/pokemons : Adiciona um novo Pokémon a um clã.
 * - DELETE /history/:id : Deleta uma entrada específica do histórico.
 * - DELETE /history : Deleta todo o histórico.
 * - DELETE /pokemons/:id : Deleta um Pokémon.
 */

import express from 'express';
import cors from 'cors';
import { db, uuidv4 } from './database.js';

const ADMIN_PASSWORD = 'raito123';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- Endpoints de Treinadores ---

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
    const query = `SELECT id, name, email FROM trainers ORDER BY name COLLATE NOCASE`;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /trainers] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar lista de treinadores.' });
        }
        console.log(`[GET /trainers] Retornando ${rows.length} treinadores.`);
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

app.post('/history', (req, res) => {
    // <<< NOVO: Recebe duration_hours >>>
    const { pokemons, trainer_password, comment, duration_hours } = req.body;
    const dateISO = new Date().toISOString();

    // <<< NOVO: Validação da duração >>>
    const duration = parseInt(duration_hours, 10);
    if (isNaN(duration) || duration < 1 || duration > 10) {
        return res.status(400).json({ error: 'Duração inválida. Deve ser um número entre 1 e 10 horas.' });
    }

    if (!pokemons || !Array.isArray(pokemons) || pokemons.length === 0) {
        return res.status(400).json({ error: 'Lista de Pokémons inválida ou vazia.' });
    }
    if (!trainer_password) {
        return res.status(400).json({ error: 'Senha do treinador é obrigatória.' });
    }

    console.log(`[POST /history] Recebido pedido com senha para ${pokemons.join(', ')} em ${dateISO}. Duração: ${duration}h. Comentário: ${comment || '(nenhum)'}`);

    // <<< NOVO: Calcular tempo esperado de devolução >>>
    const borrowTime = Date.now();
    const expectedReturnTimeMillis = borrowTime + (duration * 60 * 60 * 1000);
    const expectedReturnTimeISO = new Date(expectedReturnTimeMillis).toISOString();
    console.log(`[POST /history] Tempo de empréstimo: ${dateISO}, Retorno esperado: ${expectedReturnTimeISO}`);


    // 1. Validar senha do treinador
    db.get('SELECT id, name FROM trainers WHERE password = ?', [trainer_password], (trainerErr, trainerRow) => {
        if (trainerErr) {
            console.error(`[POST /history] Erro DB ao buscar treinador por senha:`, trainerErr.message);
            return res.status(500).json({ error: 'Erro interno ao validar treinador.' });
        }
        if (!trainerRow) {
            console.warn(`[POST /history] Senha de treinador inválida fornecida.`);
            return res.status(401).json({ error: 'Senha do treinador inválida.' });
        }

        const trainerId = trainerRow.id;
        const trainerName = trainerRow.name;
        console.log(`[POST /history] Treinador ${trainerName} (ID: ${trainerId}) validado.`);

        // 2. Continuar com a lógica de transação
        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr) => {
                if(beginErr){
                    console.error(`[POST /history] Erro ao iniciar transação:`, beginErr.message);
                    return res.status(500).json({ error: 'Erro interno ao iniciar registro.' });
                }
                console.log(`[POST /history] Transação iniciada para treinador ID ${trainerId}.`);

                const validationPromises = pokemons.map(pokemonId => {
                    return new Promise((resolve, reject) => {
                        if (typeof pokemonId !== 'string' || pokemonId.length < 10) {
                            return reject(new Error(`ID de Pokémon inválido: ${pokemonId}`));
                        }
                        db.get('SELECT name, status FROM pokemon WHERE id = ?', [pokemonId], (err, row) => {
                            if (err) return reject(err);
                            if (!row) return reject(new Error(`Pokémon com ID ${pokemonId} não encontrado no banco.`));
                            resolve({ id: pokemonId, name: row.name, status: row.status });
                        });
                    });
                });

                Promise.all(validationPromises)
                    .then(pokemonData => {
                        console.log(`[POST /history] Dados dos pokémons validados:`, pokemonData.map(p=>({id:p.id, name:p.name, status:p.status})));
                        const unavailablePokemons = pokemonData.filter(p => p.status !== 'available');
                        if (unavailablePokemons.length > 0) {
                            const names = unavailablePokemons.map(p => p.name || p.id).join(', ');
                            throw new Error(`Pokémon(s) não disponível(is): ${names}. Status atual: ${unavailablePokemons.map(p=>p.status).join(',')}`);
                        }
                        const updatePromises = pokemonData.map(({ id }) => {
                            return new Promise((resolve, reject) => {
                                db.run('UPDATE pokemon SET status = "borrowed" WHERE id = ? AND status = "available"', [id], function (err) {
                                    if (err) return reject(err);
                                    if (this.changes === 0) return reject(new Error(`Pokémon ${id} não pôde ser marcado como emprestado (status pode ter mudado).`));
                                    console.log(`[POST /history] Status do Pokémon ${id} atualizado para 'borrowed'.`);
                                    resolve();
                                });
                            });
                        });
                        return Promise.all(updatePromises).then(() => pokemonData);
                    })
                    .then((pokemonData) => {
                        console.log(`[POST /history] Inserindo ${pokemonData.length} registro(s) no histórico para trainer ID ${trainerId}...`);
                        const historyPromises = pokemonData.map(({ id, name }) => {
                            return new Promise((resolve, reject) => {
                                // <<< NOVO: Inclui 'expected_return_time' no INSERT >>>
                                db.run('INSERT INTO history (pokemon, pokemon_name, trainer_id, date, comment, expected_return_time) VALUES (?, ?, ?, ?, ?, ?)',
                                    [id, name, trainerId, dateISO, comment || null, expectedReturnTimeISO], function (err) { // Passa expectedReturnTimeISO
                                    if (err) return reject(err);
                                    console.log(`[POST /history] Registro ID ${this.lastID} inserido para Pokémon ${id}.`);
                                    resolve(this.lastID);
                                });
                            });
                        });
                        return Promise.all(historyPromises);
                    })
                    .then((insertedIds) => {
                        console.log(`[POST /history] Registros inseridos com IDs: ${insertedIds.join(', ')}. Commitando transação.`);
                        db.run('COMMIT', (commitErr) => {
                             if(commitErr){
                                console.error(`[POST /history] Erro ao commitar transação:`, commitErr.message);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Erro interno ao finalizar registro.' });
                             }
                             console.log(`[POST /history] Transação commitada com sucesso para trainer ID ${trainerId}.`);
                             res.status(201).json({ message: `Pokémons registrados com sucesso para ${trainerName} por ${duration} hora(s)!` }); // Mensagem atualizada
                        });
                    })
                    .catch(err => {
                        console.error(`[POST /history] Erro durante o processo para trainer ID ${trainerId}: ${err.message}`);
                        db.run('ROLLBACK', (rollbackErr) => {
                             if(rollbackErr) console.error(`[POST /history] Erro ao executar ROLLBACK:`, rollbackErr.message);
                             else console.log(`[POST /history] Transação revertida (ROLLBACK) para trainer ID ${trainerId}.`);
                        });
                        const statusCode = err.message.includes('disponível') || err.message.includes('emprestado') || err.message.includes('encontrado') || err.message.includes('inválido') ? 400 : 500;
                        res.status(statusCode).json({ error: err.message });
                    });
            });
        });
    });
});

app.get('/history', (req, res) => {
    console.log("[GET /history] Buscando histórico completo...");
    // <<< NOVO: Adiciona expected_return_time >>>
    const query = `
        SELECT
            h.id, h.pokemon, h.pokemon_name,
            h.trainer_id, t.name AS trainer_name,
            h.date, h.returned, h.returnDate,
            c.name AS clan_name,
            h.comment,
            h.expected_return_time
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
    // <<< NOVO: Adiciona expected_return_time >>>
    const query = `
        SELECT
            h.id,
            h.trainer_id,
            t.name AS trainer_name,
            h.date,
            p.name AS pokemon_name,
            c.name AS clan_name,
            h.comment,
            h.expected_return_time
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
            const key = `${entry.trainer_name}-${entry.date}`; // Chave ainda é trainer + data empréstimo

            if (!groupedHistory[key]) {
                groupedHistory[key] = {
                    trainer_id: entry.trainer_id,
                    trainer_name: entry.trainer_name,
                    date: entry.date,
                    pokemons: [],
                    comment: entry.comment || null,
                    expected_return_time: entry.expected_return_time || null // <<< NOVO: Adiciona ao grupo
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


app.put('/history/:id/return', (req, res) => {
    const { id } = req.params;
    const { trainer_password } = req.body;
    const returnDateISO = new Date().toISOString();
    console.log(`[RETURN API] Recebida requisição para devolver entrada ID: ${id}`);
    if (!trainer_password) {
        console.warn(`[RETURN API] Senha do treinador não fornecida para devolução do histórico ID: ${id}`);
        return res.status(400).json({ error: 'Senha do treinador é obrigatória para devolver.' });
    }
    db.get('SELECT pokemon, returned, trainer_id FROM history WHERE id = ?', [id], (err, historyEntry) => {
        if (err) {
            console.error(`[RETURN API] Erro DB ao buscar history ID ${id}: ${err.message}`);
            return res.status(500).json({ error: 'Erro ao buscar registro de empréstimo.' });
        }
        if (!historyEntry) {
            console.warn(`[RETURN API] Histórico ID ${id} não encontrado.`);
            return res.status(404).json({ error: 'Registro de empréstimo não encontrado.' });
        }
        if (historyEntry.returned) {
            console.warn(`[RETURN API] Histórico ID ${id} já está marcado como devolvido.`);
            return res.status(200).json({ message: 'Registro já estava marcado como devolvido.' });
        }
        const pokemonId = historyEntry.pokemon;
        const trainerId = historyEntry.trainer_id;
        db.get('SELECT password FROM trainers WHERE id = ?', [trainerId], (trainerErr, trainerRow) => {
            if (trainerErr) {
                console.error(`[RETURN API] Erro DB ao buscar senha do treinador ID ${trainerId} (para Histórico ID ${id}): ${trainerErr.message}`);
                return res.status(500).json({ error: 'Erro interno ao verificar treinador.' });
            }
            if (!trainerRow) {
                 console.error(`[RETURN API] Treinador ID ${trainerId} associado ao Histórico ID ${id} não encontrado na tabela trainers.`);
                return res.status(500).json({ error: 'Erro ao verificar dados do treinador associado.' });
            }
            const correctPassword = trainerRow.password;
            if (trainer_password !== correctPassword) {
                console.warn(`[RETURN API] Senha incorreta fornecida para devolução do histórico ID: ${id} (Treinador ID: ${trainerId})`);
                return res.status(401).json({ error: 'Senha do treinador inválida.' });
            }
            console.log(`[RETURN API] Senha validada para devolução do histórico ID: ${id}. Iniciando transação.`);
            db.serialize(() => {
                db.run('BEGIN TRANSACTION', (beginErr) => {
                     if (beginErr) {
                         console.error(`[RETURN API] Erro ao iniciar transação para ID ${id}: ${beginErr.message}`);
                         return res.status(500).json({ error: 'Erro interno ao iniciar devolução.' });
                     }
                     console.log(`[RETURN API] Transação iniciada para ID ${id}.`);
                    db.run('UPDATE pokemon SET status = "available" WHERE id = ?', [pokemonId], function (updatePokemonErr) {
                        if (updatePokemonErr) {
                            console.error(`[RETURN API] Erro ao atualizar status do Pokémon ${pokemonId} (para Histórico ID ${id}): ${updatePokemonErr.message}`);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Erro ao atualizar status do Pokémon.' });
                        }
                        console.log(`[RETURN API] Status do Pokémon ${pokemonId} atualizado para 'available'. Linhas afetadas: ${this.changes}`);
                        db.run('UPDATE history SET returned = 1, returnDate = ? WHERE id = ? AND returned = 0',
                               [returnDateISO, id], function (updateHistoryErr) {
                            if (updateHistoryErr) {
                                console.error(`[RETURN API] Erro ao atualizar history ID ${id}: ${updateHistoryErr.message}`);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Erro ao atualizar registro histórico.' });
                            }
                            if (this.changes === 0) {
                                console.warn(`[RETURN API] Nenhuma linha atualizada no histórico para ID ${id} (pode já ter sido devolvido ou ID inválido).`);
                                db.run('ROLLBACK');
                                return res.status(409).json({ error: 'Devolução pode já ter sido registrada ou o ID é inválido.' });
                            }
                            console.log(`[RETURN API] Histórico ID ${id} atualizado para returned=1 com data ${returnDateISO}. Linhas afetadas: ${this.changes}`);
                            db.run('COMMIT', (commitErr) => {
                                 if (commitErr) {
                                     console.error(`[RETURN API] Erro ao commitar transação para ID ${id}: ${commitErr.message}`);
                                     db.run('ROLLBACK');
                                     return res.status(500).json({ error: 'Erro ao finalizar devolução.' });
                                 }
                                 console.log(`[RETURN API] Transação para ID ${id} commitada com sucesso.`);
                                 res.status(200).json({ message: 'Pokémon devolvido com sucesso!' });
                            });
                        });
                    });
                });
            });
        });
    });
});

app.delete('/history/:id', (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE /history/:id] Recebida requisição para deletar ID: ${id}`);
    if (isNaN(parseInt(id, 10))) {
         return res.status(400).json({ error: 'ID de histórico inválido.' });
    }
    const query = `DELETE FROM history WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) {
            console.error(`[DELETE /history/:id] Erro DB ao deletar ID ${id}:`, err.message);
            return res.status(500).json({ error: 'Erro ao deletar registro do histórico.' });
        }
        if (this.changes === 0) {
             console.warn(`[DELETE /history/:id] Nenhum registro encontrado para deletar com ID ${id}.`);
            return res.status(404).json({ error: 'Registro de histórico não encontrado.' });
        }
        console.log(`[DELETE /history/:id] Registro ID ${id} deletado com sucesso. Linhas afetadas: ${this.changes}`);
        res.status(200).json({ message: 'Registro deletado com sucesso!' });
    });
});

app.delete('/history', (req, res) => {
    console.warn("[DELETE /history] Recebida requisição para DELETAR TODO O HISTÓRICO!");
    const query = `DELETE FROM history`;
    db.run(query, [], function(err) {
        if (err) {
             console.error("[DELETE /history] Erro DB:", err.message);
             return res.status(500).json({ error: 'Erro ao deletar histórico.' });
        }
        console.log(`[DELETE /history] Histórico deletado. Linhas afetadas: ${this.changes}`);
        res.status(200).json({ message: `Histórico deletado com sucesso! (${this.changes} registros removidos)` });
    });
});


// --- Server Start ---
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});