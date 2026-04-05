const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'Comandos');

// Verificamos que la carpeta Comandos exista
if (!fs.existsSync(foldersPath)) {
    console.error('❌ Error: La carpeta "Comandos" no existe.');
    process.exit(1);
}

const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    
    if (fs.lstatSync(commandsPath).isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => 
            file.endsWith('.js') && 
            file !== 'firebase.js' && 
            file !== 'tickets.js' // 👈 Ignoramos tickets.js para limpiar el log
        );
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`✅ Comando cargado: ${file}`);
                }
            } catch (err) {
                console.error(`❌ Error al cargar ${file}: ${err.message}`);
            }
        }
    }
}

// Validación de variables de entorno
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = '1475568777360969932';

if (!token || !clientId) {
    console.error('❌ Error: Falta DISCORD_TOKEN o CLIENT_ID en el .env');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 Intentando registrar ${commands.length} comandos Slash...`);

        // Una sola petición PUT sobrescribe la lista anterior.
        // Esto es mucho más rápido y evita que el proceso se tilde.
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`\n✨ Éxito: Se registraron ${data.length} comandos correctamente.`);
        process.exit(0); // Forzamos la salida exitosa
    } catch (error) {
        console.error('\n❌ Error en el registro de la API de Discord:');
        console.error(error);
        process.exit(1);
    }
})();