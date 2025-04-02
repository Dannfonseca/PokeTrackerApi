// TODOLISTPOKEMON/poke-api/database.js
/**
 * Configuração e inicialização do banco de dados SQLite.
 * Define os schemas das tabelas (pokemon_type, pokemon, clan, clan_pokemon, loan, history),
 * cria as tabelas se não existirem, insere dados iniciais (clãs) e configura triggers
 * para atualizar timestamps.
 *
 * Funções Exportadas:
 * - db: A instância da conexão com o banco de dados.
 * - borrowPokemon: Função para marcar um Pokémon como emprestado e criar um registro de empréstimo (loan).
 * - returnPokemon: Função para marcar um Pokémon como disponível e atualizar o registro de empréstimo.
 * - uuidv4: Função para gerar UUIDs.
 */
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');


const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');

        db.serialize(() => {



            db.run(`
                CREATE TABLE IF NOT EXISTS pokemon_type (
                    id TEXT PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                );
            `, (err) => {
                if (err) console.error('Erro ao criar tabela pokemon_type:', err.message);
                else console.log('Tabela pokemon_type criada com sucesso.');
            });


            db.run(`
                CREATE TABLE IF NOT EXISTS pokemon (
                    id TEXT PRIMARY KEY,
                    type_id TEXT,
                    name TEXT NOT NULL,
                    held_item TEXT,
                    status TEXT CHECK (status IN ('available', 'borrowed', 'inactive')) DEFAULT 'available',
                    version INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (type_id) REFERENCES pokemon_type(id)
                );
            `, (err) => {
                if (err) console.error('Erro ao criar tabela pokemon:', err.message);
                else console.log('Tabela pokemon criada com sucesso.');
            });


            db.run(`
                CREATE TABLE IF NOT EXISTS clan (
                    id TEXT PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    elements TEXT NOT NULL,
                    color TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                );
            `, (err) => {
                if (err) console.error('Erro ao criar tabela clan:', err.message);
                else console.log('Tabela clan criada com sucesso.');
            });


            db.run(`
                CREATE TABLE IF NOT EXISTS clan_pokemon (
                    id TEXT PRIMARY KEY,
                    clan_id TEXT,
                    pokemon_id TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(clan_id, pokemon_id),
                    FOREIGN KEY (clan_id) REFERENCES clan(id) ON DELETE CASCADE,
                    FOREIGN KEY (pokemon_id) REFERENCES pokemon(id) ON DELETE CASCADE
                );
            `, (err) => {
                if (err) console.error('Erro ao criar tabela clan_pokemon:', err.message);
                else console.log('Tabela clan_pokemon criada com sucesso.');
            });


            db.run(`
                CREATE TABLE IF NOT EXISTS loan (
                    id TEXT PRIMARY KEY,
                    pokemon_id TEXT,
                    trainer TEXT NOT NULL,
                    borrowed_at TEXT DEFAULT (datetime('now')),
                    returned_at TEXT,
                    is_active INTEGER DEFAULT 1,
                    version INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (pokemon_id) REFERENCES pokemon(id)
                );
            `, (err) => {
                if (err) console.error('Erro ao criar tabela loan:', err.message);
                else console.log('Tabela loan criada com sucesso.');
            });


            db.run(`
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pokemon TEXT NOT NULL,
                    pokemon_name TEXT NOT NULL,
                    trainer TEXT NOT NULL,
                    date TEXT NOT NULL,
                    returned INTEGER DEFAULT 0,
                    returnDate TEXT
                );
            `, (err) => {
                if (err) console.error('Erro ao criar tabela history:', err.message);
                else console.log('Tabela history criada com sucesso.');
            });


            const clans = [
                { id: uuidv4(), name: 'malefic', elements: 'Dark, Ghost, Venom', color: '#6b21a8' },
                { id: uuidv4(), name: 'wingeon', elements: 'Flying, Dragon', color: '#0284c7' },
                { id: uuidv4(), name: 'ironhard', elements: 'Metal, Crystal', color: '#64748b' },
                { id: uuidv4(), name: 'volcanic', elements: 'Fire', color: '#dc2626' },
                { id: uuidv4(), name: 'seavell', elements: 'Water, Ice', color: '#0891b2' },
                { id: uuidv4(), name: 'gardestrike', elements: 'Fighting, Normal', color: '#b45309' },
                { id: uuidv4(), name: 'orebound', elements: 'Rock, Earth', color: '#92400e' },
                { id: uuidv4(), name: 'naturia', elements: 'Grass, Bug', color: '#16a34a' },
                { id: uuidv4(), name: 'psycraft', elements: 'Psychic, Fairy', color: '#d946ef' },
                { id: uuidv4(), name: 'raibolt', elements: 'Electric', color: '#facc15' }
            ];

            clans.forEach(clan => {
                db.run(
                    `INSERT OR IGNORE INTO clan (id, name, elements, color) VALUES (?, ?, ?, ?)`,
                    [clan.id, clan.name, clan.elements, clan.color],
                    (err) => {
                        if (err) console.error(`Erro ao inserir clã ${clan.name}:`, err.message);
                        else console.log(`Clã ${clan.name} inserido com sucesso.`);
                    }
                );
            });


            db.run(`
                CREATE TRIGGER IF NOT EXISTS update_pokemon_updated_at
                AFTER UPDATE ON pokemon
                FOR EACH ROW
                BEGIN
                    UPDATE pokemon SET updated_at = datetime('now') WHERE id = OLD.id;
                END;
            `, (err) => {
                if (err) console.error('Erro ao criar trigger update_pokemon_updated_at:', err.message);
                else console.log('Trigger update_pokemon_updated_at criada com sucesso.');
            });

            db.run(`
                CREATE TRIGGER IF NOT EXISTS update_loan_updated_at
                AFTER UPDATE ON loan
                FOR EACH ROW
                BEGIN
                    UPDATE loan SET updated_at = datetime('now') WHERE id = OLD.id;
                END;
            `, (err) => {
                if (err) console.error('Erro ao criar trigger update_loan_updated_at:', err.message);
                else console.log('Trigger update_loan_updated_at criada com sucesso.');
            });

            console.log('Tabelas e triggers criadas com sucesso.');
        });
    }
});


const borrowPokemon = (pokemonId, trainer, version, callback) => {
    db.serialize(() => {
        db.get(`SELECT version, status FROM pokemon WHERE id = ?`, [pokemonId], (err, row) => {
            if (err) return callback(err);

            if (!row || row.version !== version || row.status !== 'available') {
                return callback(null, false);
            }

            db.run(`
                UPDATE pokemon
                SET status = 'borrowed', version = version + 1
                WHERE id = ?`,
                [pokemonId],
                function(err) {
                    if (err) return callback(err);

                    db.run(`
                        INSERT INTO loan (id, pokemon_id, trainer)
                        VALUES (?, ?, ?)`,
                        [uuidv4(), pokemonId, trainer],
                        (err) => {
                            if (err) return callback(err);
                            callback(null, true);
                        }
                    );
                }
            );
        });
    });
};


const returnPokemon = (pokemonId, version, callback) => {
    db.serialize(() => {
        db.get(`SELECT version, status FROM pokemon WHERE id = ?`, [pokemonId], (err, row) => {
            if (err) return callback(err);

            if (!row || row.version !== version || row.status !== 'borrowed') {
                return callback(null, false);
            }

            db.run(`
                UPDATE pokemon
                SET status = 'available', version = version + 1
                WHERE id = ?`,
                [pokemonId],
                function(err) {
                    if (err) return callback(err);

                    db.run(`
                        UPDATE loan
                        SET is_active = 0, returned_at = datetime('now')
                        WHERE pokemon_id = ? AND is_active = 1`,
                        [pokemonId],
                        (err) => {
                            if (err) return callback(err);
                            callback(null, true);
                        }
                    );
                }
            );
        });
    });
};


module.exports = { db, borrowPokemon, returnPokemon, uuidv4 };