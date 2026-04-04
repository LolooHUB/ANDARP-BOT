const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
// Carpeta principal de comandos
const foldersPath = path.join(__dirname, 'Comandos');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    // Entrar en cada subcarpeta (Roleplay, Moderacion, Administracion)
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ Comando cargado: ${file}`);
        } else {
            console.log(`⚠️ [ADVERTENCIA] El comando en ${filePath} no tiene las propiedades "data" o "execute".`);
        }
    }
}

// Configuración de REST con el Token del Bot
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🚀 Iniciando el registro de ${commands.length} comandos Slash...`);

        // Registro específico para tu Servidor (ID: 1475568777360969932)
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, '1475568777360969932'),
            { body: commands },
        );

        console.log(`✅ Éxito: Se registraron ${data.length} comandos correctamente en el servidor.`);
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();