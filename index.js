// TODOLISTPOKEMON/poke-api/index.js
/**
 * Servidor backend Express para a API Pokes da House.
 * Define endpoints RESTful para gerenciar Pokémons, clãs, empréstimos (histórico),
 * interagindo com o banco de dados SQLite (configurado em database.js).
 *
 * Principais Endpoints:
 * - GET /pokemons/:id : Busca um Pokémon por ID.
 * - POST /history : Registra um novo empréstimo de Pokémons para um treinador.
 * - GET /clans/:clan/pokemons : Lista Pokémons de um clã específico.
 * - GET /history : Retorna todo o histórico de empréstimos.
 * - GET /history/active : Retorna os empréstimos ativos, agrupados por treinador/data.
 * - PUT /history/:id/return : Marca uma entrada de histórico como devolvida e atualiza o status do Pokémon.
 * - POST /clans/:clan/pokemons : Adiciona um novo Pokémon a um clã.
 * - DELETE /history/:id : Deleta uma entrada específica do histórico.
 * - DELETE /history : Deleta todo o histórico.
 * - DELETE /pokemons/:id : Deleta um Pokémon (e sua associação com clãs).
 */


const express = require('express');
const cors = require('cors');

const { db, } = require('./database');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());


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


app.post('/history', (req, res) => {
    const { pokemons, trainer } = req.body;
    const dateISO = new Date().toISOString();


    if (!pokemons || !Array.isArray(pokemons) || pokemons.length === 0) {
        return res.status(400).json({ error: 'Lista de Pokémons inválida ou vazia.' });
    }
    if (!trainer || typeof trainer !== 'string' || trainer.trim() === '') {
        return res.status(400).json({ error: 'Nome do treinador inválido ou vazio.' });
    }

    console.log(`[POST /history] Recebido pedido de ${trainer} para ${pokemons.join(', ')} em ${dateISO}`);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
            if(beginErr){
                console.error(`[POST /history] Erro ao iniciar transação:`, beginErr.message);
                return res.status(500).json({ error: 'Erro interno ao iniciar registro.' });
            }
            console.log(`[POST /history] Transação iniciada para ${trainer}.`);


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
                    console.log(`[POST /history] Inserindo ${pokemonData.length} registro(s) no histórico...`);

                    const historyPromises = pokemonData.map(({ id, name }) => {
                        return new Promise((resolve, reject) => {
                            db.run('INSERT INTO history (pokemon, pokemon_name, trainer, date) VALUES (?, ?, ?, ?)',
                                [id, name, trainer, dateISO], function (err) {
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
                         console.log(`[POST /history] Transação commitada com sucesso para ${trainer}.`);
                         res.status(201).json({ message: 'Pokémons registrados com sucesso!' });
                    });
                })
                .catch(err => {

                    console.error(`[POST /history] Erro durante o processo para ${trainer}: ${err.message}`);
                    db.run('ROLLBACK', (rollbackErr) => {
                         if(rollbackErr) console.error(`[POST /history] Erro ao executar ROLLBACK:`, rollbackErr.message);
                         else console.log(`[POST /history] Transação revertida (ROLLBACK) para ${trainer}.`);
                    });

                    const statusCode = err.message.includes('disponível') || err.message.includes('emprestado') || err.message.includes('encontrado') || err.message.includes('inválido') ? 400 : 500;
                    res.status(statusCode).json({ error: err.message });
                });
        });
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


app.get('/history', (req, res) => {
    console.log("[GET /history] Buscando histórico completo...");
    const query = `
        SELECT
            h.id, h.pokemon, p.name AS pokemon_name,
            h.trainer, h.date, h.returned, h.returnDate,
            c.name AS clan_name
        FROM history h
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
            h.trainer,
            h.date,
            p.name AS pokemon_name,
            c.name AS clan_name
        FROM history h
        JOIN pokemon p ON h.pokemon = p.id
        LEFT JOIN clan_pokemon cp ON p.id = cp.pokemon_id
        LEFT JOIN clan c ON cp.clan_id = c.id
        WHERE h.returned = 0
        ORDER BY h.date DESC, c.name COLLATE NOCASE, p.name COLLATE NOCASE
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("[GET /history/active] Erro DB:", err.message);
            return res.status(500).json({ error: 'Erro ao buscar histórico ativo.' });
        }

        console.log(`[GET /history/active] ${rows.length} registros ativos encontrados, agrupando...`);
        const groupedHistory = {};
        rows.forEach(entry => {

            const key = `${entry.trainer}-${entry.date}`;

            if (!groupedHistory[key]) {
                groupedHistory[key] = {
                    trainer: entry.trainer,
                    date: entry.date,
                    pokemons: [],
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
    const returnDateISO = new Date().toISOString();

    console.log(`[RETURN API] Recebida requisição para devolver entrada do histórico ID: ${id}`);


    db.get('SELECT pokemon, returned FROM history WHERE id = ?', [id], (err, historyEntry) => {
        if (err) {
            console.error(`[RETURN API] Erro DB ao buscar history ID ${id}: ${err.message}`);
            return res.status(500).json({ error: 'Erro ao buscar registro de empréstimo.' });
        }
        if (!historyEntry) {
            console.warn(`[RETURN API] Histórico ID ${id} não encontrado.`);
            return res.status(404).json({ error: 'Registro de empréstimo não encontrado.' });
        }

        console.log(`[RETURN API] Histórico ID ${id} encontrado. Status atual 'returned': ${historyEntry.returned}. Pokemon ID associado: ${historyEntry.pokemon}`);


        if (historyEntry.returned) {
            console.warn(`[RETURN API] Histórico ID ${id} já está marcado como devolvido.`);
            return res.status(200).json({ message: 'Registro já estava marcado como devolvido.' });
        }

        const pokemonId = historyEntry.pokemon;


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