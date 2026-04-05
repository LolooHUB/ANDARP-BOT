const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'Comandos');
const commandFolders = fs.readdirSync(foldersPath);

console.log('🔍 [1/3] Preparando comandos...');

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    if (fs.lstatSync(commandsPath).isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => 
            file.endsWith('.js') && !['firebase.js', 'tickets.js'].includes(file)
        );
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                if (command.data && command.execute) {
                    commands.push(command.data.toJSON());
                }
            } catch (err) { console.error(`   ❌ Error en ${file}: ${err.message}`); }
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const clientId = process.env.CLIENT_ID;

        if (!clientId) {
            console.error('\n❌ ERROR: No hay CLIENT_ID en el .env');
            process.exit(1);
        }

        console.log(`\n📡 [2/3] Intentando Registro GLOBAL (Saltando restricciones de servidor)...`);
        console.log(`   > Bot ID: ${clientId}`);

        // Usamos la ruta GLOBAL para evitar el error de "Missing Access" del servidor
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`\n✨ [3/3] ¡ÉXITO TOTAL! Se registraron ${data.length} comandos de forma global.`);
        console.log(`💡 Nota: Los comandos globales pueden tardar hasta 10 minutos en aparecer en Discord.`);
        
        // Pequeño delay para asegurar que la conexión se cierre bien
        setTimeout(() => process.exit(0), 1000); 

    } catch (error) {
        console.error('\n❌ ERROR CRÍTICO AL REGISTRAR:');
        
        if (error.status === 401) {
            console.error('   > El TOKEN en el .env es incorrecto.');
        } else if (error.status === 403) {
            console.error('   > El CLIENT_ID no pertenece a este TOKEN o falta el scope "applications.commands".');
        } else {
            console.error(error);
        }
        process.exit(1);
    }
})();