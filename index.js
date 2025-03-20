const express = require('express');
const cors = require('cors');
const db = require('./database').db;
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000; // Usa porta dinâmica para o Render
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

app.use(cors());
app.use(express.json());

const clanData = {
    malefic: { elements: 'Dark, Ghost, Venom', color: '#6b21a8' },
    wingeon: { elements: 'Flying, Dragon', color: '#0284c7' },
    ironhard: { elements: 'Metal, Crystal', color: '#64748b' },
    volcanic: { elements: 'Fire', color: '#dc2626' },
    seavell: { elements: 'Water, Ice', color: '#0891b2' },
    gardestrike: { elements: 'Fighting, Normal', color: '#b45309' },
    orebound: { elements: 'Rock, Earth', color: '#92400e' },
    naturia: { elements: 'Grass, Bug', color: '#16a34a' },
    psycraft: { elements: 'Psychic, Fairy', color: '#d946ef' },
    raibolt: { elements: 'Electric', color: '#facc15' }
};

// Endpoint para obter um Pokémon pelo ID
app.get('/pokemons/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT id, name FROM pokemon WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Pokémon não encontrado.' });
        res.status(200).json(row);
    });
});

// Endpoint para registrar um histórico de empréstimo de Pokémons
app.post('/history', (req, res) => {
    const { pokemons, trainer } = req.body;
    const date = new Date().toLocaleString();

    if (!pokemons || !Array.isArray(pokemons)) {
        return res.status(400).json({ error: 'Lista de Pokémons inválida.' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const promises = pokemons.map(pokemonId => {
            return new Promise((resolve, reject) => {
                db.get('SELECT name, status FROM pokemon WHERE id = ?', [pokemonId], (err, row) => {
                    if (err) reject(err);
                    else if (!row || row.status !== 'available') reject(new Error(`Pokémon ${pokemonId} não está disponível.`));
                    else resolve({ id: pokemonId, name: row.name });
                });
            });
        });

        Promise.all(promises)
            .then(pokemonData => {
                const updatePromises = pokemonData.map(({ id }) => {
                    return new Promise((resolve, reject) => {
                        db.run('UPDATE pokemon SET status = "borrowed", version = version + 1 WHERE id = ?', [id], function (err) {
                            if (err) reject(err);
                            else if (this.changes === 0) reject(new Error(`Pokémon ${id} foi modificado por outra pessoa.`));
                            else resolve();
                        });
                    });
                });

                Promise.all(updatePromises)
                    .then(() => {
                        const historyPromises = pokemonData.map(({ id, name }) => {
                            return new Promise((resolve, reject) => {
                                db.run('INSERT INTO history (pokemon, pokemon_name, trainer, date) VALUES (?, ?, ?, ?)', [id, name, trainer, date], function (err) {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });
                        });

                        Promise.all(historyPromises)
                            .then(() => {
                                db.run('COMMIT');
                                res.status(201).json({ message: 'Pokémons registrados com sucesso!' });
                            })
                            .catch(err => {
                                db.run('ROLLBACK');
                                res.status(500).json({ error: err.message });
                            });
                    })
                    .catch(err => {
                        db.run('ROLLBACK');
                        res.status(400).json({ error: err.message });
                    });
            })
            .catch(err => {
                db.run('ROLLBACK');
                res.status(400).json({ error: err.message });
            });
    });
});

// Endpoint para obter Pokémons de um clã específico
app.get('/clans/:clan/pokemons', (req, res) => {
    const { clan } = req.params;

    const query = `
        SELECT p.id, p.name, p.held_item, p.status, p.version
        FROM pokemon p
        JOIN clan_pokemon cp ON p.id = cp.pokemon_id
        WHERE cp.clan_id = ?
    `;

    db.all(query, [clan], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
    });
});

// Endpoint para obter todo o histórico de Pokémons
app.get('/history', (req, res) => {
    const query = `
        SELECT h.id, p.name AS pokemon_name, h.trainer, h.date, h.returned, h.returnDate
        FROM history h
        LEFT JOIN pokemon p ON h.pokemon = p.id
        ORDER BY h.date DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Verifica se os nomes dos Pokémons estão vindo corretamente
        console.log("Histórico retornado:", rows);

        res.status(200).json(rows);
    });
});



// Endpoint para obter o histórico ativo de Pokémons emprestados
app.get('/history/active', (req, res) => {
    const query = `
        SELECT h.trainer, h.date, p.name AS pokemon_name
        FROM history h
        JOIN pokemon p ON h.pokemon = p.id
        WHERE h.returned = 0
        ORDER BY h.date DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

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
            groupedHistory[key].pokemons.push(entry.pokemon_name);
        });

        res.status(200).json(Object.values(groupedHistory));
    });
});

// Endpoint para marcar um Pokémon como devolvido
app.put('/history/:id/return', (req, res) => {
    const { id } = req.params;
    const returnDate = new Date().toLocaleString();

    db.get('SELECT pokemon FROM history WHERE id = ?', [id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Registro de empréstimo não encontrado.' });

        const pokemonId = row.pokemon;

        db.run('UPDATE pokemon SET status = "available" WHERE id = ?', [pokemonId], function (err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar status do Pokémon.' });

            db.run('UPDATE history SET returned = 1, returnDate = ? WHERE pokemon = ?', [returnDate, pokemonId], function (err) {
                if (err) return res.status(500).json({ error: 'Erro ao atualizar histórico.' });
                res.status(200).json({ message: 'Pokémon devolvido com sucesso!' });
            });
        });
    });
});

// Endpoint para marcar um grupo de Pokémons como devolvido por treinador e data
app.put('/history/group/:groupId/return', (req, res) => {
    const { groupId } = req.params;
    const returnDate = new Date().toLocaleString();

    const [trainer, date] = groupId.split('-');

    const query = `
        UPDATE history
        SET returned = 1, returnDate = ?
        WHERE trainer = ? AND date = ? AND returned = 0
    `;

    db.run(query, [returnDate, trainer, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: 'Todos os Pokémons devolvidos com sucesso!' });
    });
});

app.post('/clans/:clan/pokemons', (req, res) => {
    const { clan } = req.params;
    const { name, held_item } = req.body;

    if (!name) return res.status(400).json({ error: 'Nome do Pokémon é obrigatório.' });

    const pokemonId = uuidv4();

    db.run(`INSERT INTO pokemon (id, name, held_item) VALUES (?, ?, ?)`, [pokemonId, name, held_item || null], function (err) {
        if (err) {
            console.error('Erro ao inserir Pokémon:', err.message);
            return res.status(500).json({ error: 'Erro ao inserir Pokémon no banco de dados.' });
        }

        const clanPokemonId = uuidv4();
        db.run(`INSERT INTO clan_pokemon (id, clan_id, pokemon_id) VALUES (?, ?, ?)`, [clanPokemonId, clan, pokemonId], function (err) {
            if (err) {
                console.error('Erro ao associar Pokémon ao clã:', err.message);
                return res.status(500).json({ error: 'Erro ao associar Pokémon ao clã.' });
            }
            res.status(201).json({ message: 'Pokémon adicionado com sucesso!' });
        });
    });
});

// Endpoint para obter empréstimos ativos
app.get('/loans/active', (req, res) => {
    const query = `
        SELECT l.id, l.trainer, l.borrowed_at, p.name AS pokemon_name
        FROM loan l
        JOIN pokemon p ON l.pokemon_id = p.id
        WHERE l.is_active = 1
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
    });
});

// Endpoint para criar um empréstimo
app.post('/loans', (req, res) => {
    const { pokemonId, trainer, version } = req.body;

    db.get('SELECT status, version FROM pokemon WHERE id = ?', [pokemonId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row || row.status !== 'available' || row.version !== version) {
            return res.status(400).json({ error: 'Pokémon não está disponível para empréstimo ou a versão fornecida é inválida.' });
        }

        db.run('UPDATE pokemon SET status = "borrowed", version = version + 1 WHERE id = ?', [pokemonId], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.run('INSERT INTO loan (id, pokemon_id, trainer) VALUES (?, ?, ?)', [uuidv4(), pokemonId, trainer], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Pokémon emprestado com sucesso!' });
            });
        });
    });
});

// Endpoint para emprestar um Pokémon específico
app.post('/pokemons/:id/borrow', (req, res) => {
    const { id } = req.params;
    const { trainer, version } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get('SELECT version, status FROM pokemon WHERE id = ? AND version = ? FOR UPDATE', [id, version], (err, row) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            if (!row || row.status !== 'available') {
                db.run('ROLLBACK');
                return res.status(400).json({ error: 'Pokémon não está disponível.' });
            }

            db.run('UPDATE pokemon SET status = "borrowed", version = version + 1 WHERE id = ?', [id], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                db.run('INSERT INTO history (pokemon, trainer, date) VALUES (?, ?, ?)', [id, trainer, new Date().toLocaleString()], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    db.run('COMMIT');
                    res.status(200).json({ message: 'Pokémon emprestado com sucesso!' });
                });
            });
        });
    });
});

// Endpoint para devolver um Pokémon emprestado
app.put('/loans/:pokemonId/return', (req, res) => {
    const { pokemonId } = req.params;
    const { version } = req.body;

    returnPokemon(pokemonId, version, (err, success) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!success) return res.status(400).json({ error: 'Pokémon não está emprestado ou a versão fornecida é inválida.' });
        res.status(200).json({ message: 'Pokémon devolvido com sucesso!' });
    });
});

// Endpoint para deletar um item específico do histórico pelo ID
app.delete('/history/:id', (req, res) => {
    const { id } = req.params;

    const query = `DELETE FROM history WHERE id = ?`;

    db.run(query, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Nenhum registro encontrado.' });
        res.status(200).json({ message: 'Registro deletado com sucesso!' });
    });
});

// Endpoint para deletar todo o histórico
app.delete('/history', (req, res) => {
    const query = `DELETE FROM history`;
    db.run(query, [], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: 'Histórico deletado com sucesso!' });
    });
});

// Endpoint para deletar um grupo de registros do histórico por treinador e data
app.delete('/history/trainer/:trainer/date/:date', (req, res) => {
    const { trainer, date } = req.params;

    const query = `DELETE FROM history WHERE trainer = ? AND date = ?`;

    db.run(query, [trainer, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Nenhum registro encontrado.' });
        res.status(200).json({ message: 'Registro deletado com sucesso!' });
    });
});

// Endpoint para deletar um Pokémon
app.delete('/pokemons/:id', (req, res) => {
    const { id } = req.params;

    const query = `DELETE FROM pokemon WHERE id = ?`;

    db.run(query, [id], function(err) {
        if (err) {
            console.error('Erro ao deletar Pokémon:', err.message);
            return res.status(500).json({ error: 'Erro ao deletar Pokémon.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Pokémon não encontrado.' });
        }
        res.status(200).json({ message: 'Pokémon deletado com sucesso!' });
    });
});

// Inicia o servidor na porta especificada
app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}`);
});