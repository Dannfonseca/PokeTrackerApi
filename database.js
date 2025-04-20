// TODOLISTPOKEMON/poke-api/database.js
/**
 * Configuração e inicialização do banco de dados SQLite.
 * Define os schemas das tabelas (pokemon_type, pokemon, clan, trainers, clan_pokemon, history),
 * cria as tabelas se não existirem, insere dados iniciais (clãs) e configura triggers
 * para atualizar timestamps. Tabela history inclui comentário e tempo esperado de devolução.
 *
 * Funções Exportadas:
 * - db: A instância da conexão com o banco de dados.
 * - uuidv4: Função para gerar UUIDs.
 */
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

const sqlite3Verbose = sqlite3.verbose();

export const db = new sqlite3Verbose.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');

        db.serialize(() => {

            // --- Criação das Tabelas ---
            db.run(`
                CREATE TABLE IF NOT EXISTS pokemon_type (
                    id TEXT PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                );
            `, (err) => { if (err) console.error('Erro ao criar tabela pokemon_type:', err.message); });

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
            `, (err) => { if (err) console.error('Erro ao criar tabela pokemon:', err.message); });

            db.run(`
                CREATE TABLE IF NOT EXISTS clan (
                    id TEXT PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    elements TEXT NOT NULL,
                    color TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                );
            `, (err) => { if (err) console.error('Erro ao criar tabela clan:', err.message); });

            db.run(`
                CREATE TABLE IF NOT EXISTS trainers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL, /* ATENÇÃO: Senha em texto plano! */
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                );
            `, (err) => { if (err) console.error('Erro ao criar tabela trainers:', err.message); });

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
            `, (err) => { if (err) console.error('Erro ao criar tabela clan_pokemon:', err.message); });

            db.run(`
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pokemon TEXT NOT NULL,
                    pokemon_name TEXT NOT NULL,
                    trainer_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    returned INTEGER DEFAULT 0,
                    returnDate TEXT,
                    comment TEXT,
                    expected_return_time TEXT, -- <<< NOVO: Tempo esperado para devolução
                    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
                );
            `, (err) => { if (err) console.error('Erro ao criar/modificar tabela history:', err.message); });

            // --- Inserção dos Clãs ---
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
                { id: uuidv4(), name: 'raibolt', elements: 'Electric', color: '#facc15' },
                { id: uuidv4(), name: 'outros', elements: 'Utilitários Diversos', color: '#71717a' }
            ];

            clans.forEach(clan => {
                db.run(
                    `INSERT OR IGNORE INTO clan (id, name, elements, color) VALUES (?, ?, ?, ?)`,
                    [clan.id, clan.name, clan.elements, clan.color],
                    (err) => {
                        if (err) console.error(`Erro ao inserir clã ${clan.name}:`, err.message);
                    }
                );
            });

            // --- Criação dos Triggers ---
            db.run(`
                CREATE TRIGGER IF NOT EXISTS update_pokemon_updated_at
                AFTER UPDATE ON pokemon
                FOR EACH ROW
                BEGIN
                    UPDATE pokemon SET updated_at = datetime('now') WHERE id = OLD.id;
                END;
            `, (err) => { if (err) console.error('Erro ao criar trigger update_pokemon_updated_at:', err.message); });

            db.run(`
                CREATE TRIGGER IF NOT EXISTS update_trainers_updated_at
                AFTER UPDATE ON trainers
                FOR EACH ROW
                BEGIN
                    UPDATE trainers SET updated_at = datetime('now') WHERE id = OLD.id;
                END;
            `, (err) => { if (err) console.error('Erro ao criar trigger update_trainers_updated_at:', err.message); });

            console.log('Estrutura do banco de dados verificada/criada.');
        });
    }
});

export { uuidv4 };