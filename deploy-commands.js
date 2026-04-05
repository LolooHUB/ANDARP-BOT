const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'Comandos');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    
    // Verificamos que sea un directorio antes de leerlo
    if (fs.lstatSync(commandsPath).isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => 
            file.endsWith('.js') && file !== 'firebase.js' // 👈 Ignora firebase.js para evitar errores
        );
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Comando cargado: ${file}`);
            } else {
                console.log(`⚠️ [ADVERTENCIA] El archivo en ${filePath} no es un comando Slash válido (falta "data" o "execute").`);
            }
        }
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const guildId = '1475568777360969932';
        const clientId = process.env.CLIENT_ID;

        console.log(`🗑️ Limpiando comandos antiguos para evitar duplicados...`);
        
        // Esto pone la lista de comandos a cero antes de subir los nuevos
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] },
        );

        console.log(`🚀 Iniciando el registro de ${commands.length} comandos Slash...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`✅ Éxito: Se registraron ${data.length} comandos correctamente en el servidor.`);
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();