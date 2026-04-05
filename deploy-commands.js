const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'Comandos');

console.log('🔍 [1/3] Leyendo archivos de comandos...');

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
                // Limpiar caché para evitar que conexiones abiertas en el require bloqueen el proceso
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (command.data && command.execute) {
                    commands.push(command.data.toJSON());
                    console.log(`   ✅ Cargado: ${file}`);
                }
            } catch (err) {
                console.error(`   ❌ Error en ${file}: ${err.message}`);
            }
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const guildId = '1475568777360969932';
        const clientId = process.env.CLIENT_ID;

        if (!clientId || !process.env.DISCORD_TOKEN) {
            console.error('\n❌ ERROR: Faltan credenciales en el archivo .env');
            process.exit(1);
        }

        console.log(`\n📡 [2/3] Conectando con Discord API (Enviando ${commands.length} comandos)...`);

        // Enviamos los comandos
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`\n✨ [3/3] ÉXITO: Se registraron ${data.length} comandos en el servidor.`);
        
        // --- EL TRUCO FINAL ---
        // Forzamos un pequeño delay y cerramos todo. 
        // Esto "mata" cualquier conexión a Firebase que se haya abierto con los 'require'.
        console.log('🏁 Finalizando proceso de despliegue...');
        setTimeout(() => {
            process.exit(0);
        }, 1000);

    } catch (error) {
        console.error('\n❌ ERROR EN EL REGISTRO:');
        if (error.code === 50001) {
            console.error('   Causa: El bot no tiene permiso de "application.commands" en ese servidor.');
        } else {
            console.error(error);
        }
        process.exit(1);
    }
})();