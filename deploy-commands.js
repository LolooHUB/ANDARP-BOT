const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'Comandos');

console.log('🔍 Iniciando lectura de carpetas...');

const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    
    if (fs.lstatSync(commandsPath).isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => 
            file.endsWith('.js') && 
            !['firebase.js', 'tickets.js'].includes(file)
        );
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                // Forzamos la limpieza de caché para evitar conflictos
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (command.data && command.execute) {
                    commands.push(command.data.toJSON());
                    console.log(`✅ [CARGADO] ${file}`);
                }
            } catch (err) {
                console.error(`❌ [ERROR] Fallo al leer ${file}: ${err.message}`);
            }
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const guildId = '1475568777360969932';
        const clientId = process.env.CLIENT_ID;

        if (!clientId) throw new Error("Falta CLIENT_ID en el .env");

        console.log(`\n📡 Conectando con la API de Discord para registrar ${commands.length} comandos...`);

        // timeout para no quedarse esperando eternamente
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 segundos máximo

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        clearTimeout(timeout);
        console.log(`\n✨ ÉXITO: Se registraron ${data.length} comandos.`);
        
        // FORZAMOS EL CIERRE DEL PROCESO
        console.log('🏁 Finalizando proceso...');
        process.exit(0); 

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('\n❌ ERROR: La conexión con Discord tardó demasiado (Timeout).');
        } else {
            console.error('\n❌ ERROR API DISCORD:');
            console.error(error);
        }
        process.exit(1);
    }
})();