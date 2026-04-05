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

// CONFIGURACIÓN DE CONEXIÓN
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const guildId = '1482587270790906008'; // 👈 TU NUEVO ID APLICADO
        const clientId = process.env.CLIENT_ID;

        if (!clientId) {
            console.error('\n❌ ERROR: No hay CLIENT_ID en el .env');
            process.exit(1);
        }

        console.log(`\n📡 [2/3] Enviando petición a Discord...`);
        console.log(`   > Bot: ${clientId}`);
        console.log(`   > Server: ${guildId}`);

        // Forzamos la sobrescritura directa
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`\n✨ [3/3] ¡ÉXITO! Se registraron ${data.length} comandos.`);
        process.exit(0); 

    } catch (error) {
        console.error('\n❌ ERROR DE CONEXIÓN:');
        if (error.status === 401) console.error('   > El TOKEN es inválido o expiró.');
        if (error.status === 404) console.error('   > El CLIENT_ID o el GUILD_ID no existen.');
        console.error(error);
        process.exit(1);
    }
})();