// TODOLISTPOKEMON/poke-api/index.js
/**
 * Servidor backend Express para a API Pokes da House.
 * ... (comentários anteriores) ...
 * Inclui endpoint dedicado para devolução múltipla de Pokémons.
 *
 * Principais Endpoints:
 * ...
 * - PUT /history/:id/return : Marca UMA entrada de histórico como devolvida.
 * - PUT /history/return-multiple: Marca VÁRIAS entradas de histórico como devolvidas (NOVO).
 * ...
 */

import express from 'express';
import cors from 'cors';
import { db, uuidv4 } from './database.js';

const ADMIN_PASSWORD = 'russelgay24';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// <<< NOVO: Endpoint simples para Health Check / Keep-alive >>>
app.get('/health', (req, res) => {
    console.log("[GET /health] Ping received.");
    res.status(200).send('OK'); // Envia uma resposta simples e rápida
});

// --- Endpoints de Treinadores ---
// (Endpoints /trainers GET, POST, DELETE permanecem os mesmos)
app.post('/trainers', (req, res) => {
    const { name, email, password, admin_password } = req.body;
    console.log(`[POST /trainers] Recebida requisição para adicionar treinador: ${name} (${email})`);
    // Validação da senha admin (agora compara com 'russelgay24')
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
    // <<< MUDANÇA: Não seleciona mais o email >>>
    const query = `SELECT id, name FROM trainers ORDER BY name COLLATE NOCASE`;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /trainers] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar lista de treinadores.' });
        }
        console.log(`[GET /trainers] Retornando ${rows.length} treinadores (sem email).`);
        res.status(200).json(rows); // Envia apenas ID e Nome
    });
});

app.delete('/trainers/:id', (req, res) => {
    const { id } = req.params;
    const { admin_password } = req.body;
    console.warn(`[DELETE /trainers/:id] Recebida requisição para DELETAR TREINADOR ID: ${id}`);
    // Validação da senha admin (agora compara com 'russelgay24')
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
// (Endpoints /pokemons/:id GET, /clans/:clan/pokemons GET, POST, /pokemons/:id DELETE permanecem os mesmos)
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
// (Endpoints POST /history, GET /history, GET /history/active, DELETE /history/:id, DELETE /history permanecem os mesmos)
app.post('/history', (req, res) => {
    const { pokemons, trainer_password, comment } = req.body;
    const dateISO = new Date().toISOString();
    if (!pokemons || !Array.isArray(pokemons) || pokemons.length === 0) {
        return res.status(400).json({ error: 'Lista de Pokémons inválida ou vazia.' });
    }
    if (!trainer_password) {
        return res.status(400).json({ error: 'Senha do treinador é obrigatória.' });
    }
    console.log(`[POST /history] Recebido pedido com senha para ${pokemons.join(', ')} em ${dateISO}. Comentário: ${comment || '(nenhum)'}`);
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
                                db.run('INSERT INTO history (pokemon, pokemon_name, trainer_id, date, comment) VALUES (?, ?, ?, ?, ?)',
                                    [id, name, trainerId, dateISO, comment || null], function (err) {
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
                             res.status(201).json({ message: `Pokémons registrados com sucesso para ${trainerName}!` });
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

// Endpoint antigo para devolver UM pokemon (mantido para compatibilidade, se necessário, mas não usado pela devolução múltipla)
app.put('/history/:id/return', (req, res) => {
    const { id } = req.params;
    const { trainer_password } = req.body;
    const returnDateISO = new Date().toISOString();
    console.log(`[DEPRECATED /history/:id/return] Recebida requisição para devolver entrada ID: ${id}`);
    if (!trainer_password) {
        return res.status(400).json({ error: 'Senha do treinador é obrigatória para devolver.' });
    }
    // (Lógica de validação de senha e transação para UM item permanece a mesma)
    db.get('SELECT pokemon, returned, trainer_id FROM history WHERE id = ?', [id], (err, historyEntry) => {
        if (err) { /* ... */ return res.status(500).json({ error: 'Erro DB' });}
        if (!historyEntry) { /* ... */ return res.status(404).json({ error: 'Não encontrado' }); }
        if (historyEntry.returned) { /* ... */ return res.status(200).json({ message: 'Já devolvido' }); }
        const pokemonId = historyEntry.pokemon;
        const trainerId = historyEntry.trainer_id;
        db.get('SELECT password FROM trainers WHERE id = ?', [trainerId], (trainerErr, trainerRow) => {
            if (trainerErr) { /* ... */ return res.status(500).json({ error: 'Erro DB trainer' });}
            if (!trainerRow) { /* ... */ return res.status(500).json({ error: 'Erro trainer assoc.' }); }
            const correctPassword = trainerRow.password;
            if (trainer_password !== correctPassword) {
                return res.status(401).json({ error: 'Senha do treinador inválida.' });
            }
            db.serialize(() => {
                db.run('BEGIN TRANSACTION', (beginErr) => {
                    if (beginErr) { /* ... */ return res.status(500).json({ error: 'Erro begin TX' }); }
                    db.run('UPDATE pokemon SET status = "available" WHERE id = ?', [pokemonId], function (updatePokemonErr) {
                        if (updatePokemonErr) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Erro update pokemon' }); }
                        db.run('UPDATE history SET returned = 1, returnDate = ? WHERE id = ? AND returned = 0',
                               [returnDateISO, id], function (updateHistoryErr) {
                            if (updateHistoryErr) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Erro update history' }); }
                            if (this.changes === 0) { db.run('ROLLBACK'); return res.status(409).json({ error: 'Já devolvido ou ID inválido.' }); }
                            db.run('COMMIT', (commitErr) => {
                                 if (commitErr) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Erro commit' }); }
                                 res.status(200).json({ message: 'Pokémon devolvido com sucesso!' });
                            });
                        });
                    });
                });
            });
        });
    });
});

// <<< NOVO ENDPOINT para devolver múltiplos Pokémons >>>
app.put('/history/return-multiple', async (req, res) => {
    const { historyEntryIds, trainer_password } = req.body;
    const returnDateISO = new Date().toISOString();

    console.log(`[PUT /history/return-multiple] Recebida requisição para devolver IDs: ${historyEntryIds?.join(', ')}`);

    if (!Array.isArray(historyEntryIds) || historyEntryIds.length === 0) {
        return res.status(400).json({ error: 'Lista de IDs de histórico inválida ou vazia.' });
    }
    if (!trainer_password) {
        return res.status(400).json({ error: 'Senha do treinador é obrigatória.' });
    }

    // Validação básica dos IDs (são números?)
    if (historyEntryIds.some(id => isNaN(parseInt(id, 10)))) {
        return res.status(400).json({ error: 'Um ou mais IDs de histórico são inválidos.' });
    }

    // --- Validação da Senha e Obtenção dos Dados (FORA da transação principal) ---
    try {
        // 1. Pegar a primeira entrada para validar o treinador e a senha
        const firstEntry = await new Promise((resolve, reject) => {
            db.get('SELECT trainer_id, returned FROM history WHERE id = ?', [historyEntryIds[0]], (err, row) => {
                if (err) reject(new Error('Erro ao buscar registro inicial do histórico.'));
                else if (!row) reject(new Error('Registro inicial do histórico não encontrado.'));
                else resolve(row);
            });
        });

        // Não precisa devolver se o primeiro já foi (assume que todos foram ou houve erro antes)
        if (firstEntry.returned) {
            console.warn(`[PUT /history/return-multiple] Primeiro item (ID: ${historyEntryIds[0]}) já devolvido. Abortando.`);
            return res.status(200).json({ message: 'Itens já estavam marcados como devolvidos.' });
        }

        // 2. Validar a senha do treinador
        const trainer = await new Promise((resolve, reject) => {
            db.get('SELECT password FROM trainers WHERE id = ?', [firstEntry.trainer_id], (err, row) => {
                if (err) reject(new Error('Erro ao buscar dados do treinador.'));
                else if (!row) reject(new Error('Treinador associado não encontrado.'));
                else resolve(row);
            });
        });

        if (trainer.password !== trainer_password) {
            console.warn(`[PUT /history/return-multiple] Senha incorreta para treinador ID: ${firstEntry.trainer_id}`);
            return res.status(401).json({ error: 'Senha do treinador inválida.' });
        }
        console.log(`[PUT /history/return-multiple] Senha validada para treinador ID: ${firstEntry.trainer_id}.`);

        // --- Transação Principal ---
        db.serialize(() => {
            db.run('BEGIN TRANSACTION', async (beginErr) => {
                if (beginErr) {
                    console.error(`[PUT /history/return-multiple] Erro ao iniciar transação:`, beginErr.message);
                    return res.status(500).json({ error: 'Erro interno ao iniciar devolução.' });
                }
                console.log(`[PUT /history/return-multiple] Transação iniciada para IDs: ${historyEntryIds.join(', ')}`);

                try {
                    // 3. Obter IDs dos Pokémons a serem atualizados
                    const placeholders = historyEntryIds.map(() => '?').join(',');
                    const pokemonIdsToUpdate = await new Promise((resolve, reject) => {
                        const query = `SELECT DISTINCT pokemon FROM history WHERE id IN (${placeholders}) AND returned = 0`;
                        db.all(query, historyEntryIds, (err, rows) => {
                            if (err) reject(new Error(`Erro ao buscar IDs de Pokémon: ${err.message}`));
                            else resolve(rows.map(r => r.pokemon));
                        });
                    });

                    if (pokemonIdsToUpdate.length === 0) {
                        // Isso pode acontecer se os itens foram devolvidos entre a validação e aqui
                        console.warn("[PUT /history/return-multiple] Nenhum Pokémon encontrado para atualizar status (podem já ter sido devolvidos).");
                        // Considera sucesso, pois o estado final desejado (devolvido) foi alcançado.
                    } else {
                         // 4. Atualizar status dos Pokémons
                         const pokemonPlaceholders = pokemonIdsToUpdate.map(() => '?').join(',');
                         await new Promise((resolve, reject) => {
                             const updatePokemonQuery = `UPDATE pokemon SET status = 'available' WHERE id IN (${pokemonPlaceholders})`;
                             db.run(updatePokemonQuery, pokemonIdsToUpdate, function (err) {
                                 if (err) reject(new Error(`Erro ao atualizar status dos Pokémons: ${err.message}`));
                                 else {
                                     console.log(`[PUT /history/return-multiple] Status de ${this.changes} Pokémons atualizado para 'available'.`);
                                     resolve();
                                 }
                             });
                         });
                    }

                    // 5. Atualizar registros do histórico
                    const historyPlaceholders = historyEntryIds.map(() => '?').join(',');
                    const updatedHistoryCount = await new Promise((resolve, reject) => {
                        const updateHistoryQuery = `UPDATE history SET returned = 1, returnDate = ? WHERE id IN (${historyPlaceholders}) AND returned = 0`;
                        db.run(updateHistoryQuery, [returnDateISO, ...historyEntryIds], function (err) {
                            if (err) reject(new Error(`Erro ao atualizar histórico: ${err.message}`));
                            else {
                                console.log(`[PUT /history/return-multiple] ${this.changes} registros de histórico atualizados.`);
                                resolve(this.changes);
                            }
                        });
                    });

                    // Validação: O número de registros de histórico atualizados deve ser igual ao número de IDs recebidos
                    // (a menos que alguns já estivessem devolvidos, mas já checamos o primeiro)
                    if (updatedHistoryCount !== historyEntryIds.length) {
                         console.warn(`[PUT /history/return-multiple] Discrepância no número de históricos atualizados. Esperado: ${historyEntryIds.length}, Atualizado: ${updatedHistoryCount}. Possível devolução concorrente.`);
                         // Decide se isso é um erro ou apenas um aviso. Vamos tratar como aviso e commitar o que foi feito.
                         // throw new Error('Falha ao atualizar todos os registros de histórico solicitados.');
                    }

                    // 6. Commitar a transação
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            console.error(`[PUT /history/return-multiple] Erro ao commitar: ${commitErr.message}`);
                            // Tenta Rollback em caso de erro no commit
                            db.run('ROLLBACK', rbErr => { if(rbErr) console.error("Erro no Rollback pós-commit:", rbErr); });
                            return res.status(500).json({ error: 'Erro ao finalizar a devolução.' });
                        }
                        console.log(`[PUT /history/return-multiple] Transação commitada com sucesso para IDs: ${historyEntryIds.join(', ')}.`);
                        res.status(200).json({ message: `${updatedHistoryCount} Pokémon(s) devolvido(s) com sucesso!` });
                    });

                } catch (error) {
                    console.error(`[PUT /history/return-multiple] Erro DENTRO da transação: ${error.message}`);
                    db.run('ROLLBACK', (rollbackErr) => {
                        if (rollbackErr) console.error("Erro ao executar ROLLBACK:", rollbackErr);
                        else console.log("[PUT /history/return-multiple] Transação revertida (ROLLBACK).");
                    });
                    // Retorna o erro específico que causou o rollback
                    return res.status(500).json({ error: error.message || 'Erro interno durante a devolução.' });
                }
            }); // Fim BEGIN TRANSACTION
        }); // Fim db.serialize

    } catch (validationError) {
        // Erros que ocorreram ANTES da transação (busca inicial, validação de senha)
        console.error(`[PUT /history/return-multiple] Erro de validação pré-transação: ${validationError.message}`);
        const statusCode = validationError.message.includes('inválida') ? 401 : validationError.message.includes('não encontrado') ? 404 : 500;
        res.status(statusCode).json({ error: validationError.message });
    }
});



// --- Server Start ---
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});