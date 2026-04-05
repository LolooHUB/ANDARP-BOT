const { Client, GatewayIntentBits, ActivityType, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- 🎫 IMPORTACIÓN DE TICKETS ---
const { handleTicketInteractions, sendTicketPanel } = require('./Comandos/Automatizaciones/tickets');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.commands = new Collection();
client.prefixInteractions = new Collection(); // Colección para comandos con '!'

// --- 📂 1. CARGA DE COMANDOS SLASH (/) ---
const foldersPath = path.join(__dirname, 'Comandos');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// --- 📂 2. CARGA DE INTERACCIONES DE PREFIJO (!) ---
// Carga archivos de la carpeta ./Interacciones en la raíz
const interaccionesPath = path.join(__dirname, 'Interacciones');
if (fs.existsSync(interaccionesPath)) {
    const interaccionFiles = fs.readdirSync(interaccionesPath).filter(file => file.endsWith('.js'));
    for (const file of interaccionFiles) {
        const filePath = path.join(interaccionesPath, file);
        const interaccion = require(filePath);
        // Guardamos por nombre de archivo o propiedad específica si la tiene
        const name = file.split('.')[0]; 
        client.prefixInteractions.set(name, interaccion);
    }
}

// --- 🚀 EVENTO READY ---
client.once('ready', async (c) => {
    console.log(`✅ Anda RP Online: ${c.user.tag}`);

    client.user.setPresence({
        activities: [{ name: 'Anda RP 🔥', type: ActivityType.Watching }],
        status: 'online',
    });

    const canalTicketsId = '1476763743424610305';
    const canalTickets = client.channels.cache.get(canalTicketsId);

    if (canalTickets) {
        try {
            const mensajes = await canalTickets.messages.fetch({ limit: 50 });
            if (mensajes.size > 0) {
                await canalTickets.bulkDelete(mensajes, true).catch(() => {});
            }
            await sendTicketPanel(canalTickets);
            console.log("🎫 Canal de tickets actualizado y panel enviado.");
        } catch (error) {
            console.error("❌ Error en auto-panel:", error);
        }
    }
});

// --- 💬 MANEJO DE MENSAJES (COMANDOS CON PREFIX !) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // 1. Caso específico: dinero-give (Buscando en la colección de comandos slash)
    if (commandName === 'dinero-give') {
        const cmdBanco = client.commands.get('banco');
        if (cmdBanco && cmdBanco.handleAdminGive) {
            return await cmdBanco.handleAdminGive(message);
        }
    }

    // 2. Ejecución dinámica de la carpeta ./Interacciones
    // Si tienes un archivo llamado "ayuda.js" en ./Interacciones, se ejecutará con "!ayuda"
    const interaccion = client.prefixInteractions.get(commandName);
    if (interaccion && typeof interaccion.execute === 'function') {
        try {
            await interaccion.execute(message, args, client);
        } catch (error) {
            console.error(`❌ Error en interaccion !${commandName}:`, error);
        }
    }
});

// --- ⚡ MANEJO DE INTERACCIONES (SLASH, BOTONES, MODALES) ---
client.on('interactionCreate', async (interaction) => {
    
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Error ejecutando ${interaction.commandName}:`, error);
            const msgError = { content: 'Hubo un error al ejecutar el comando.', ephemeral: true };
            interaction.replied || interaction.deferred ? await interaction.followUp(msgError) : await interaction.reply(msgError);
        }
        return;
    }

    if (interaction.isButton() || interaction.isModalSubmit()) {
        const { customId } = interaction;

        // SISTEMA DE TICKETS (Centralizado)
        try {
            await handleTicketInteractions(interaction);
        } catch (error) {
            console.error("❌ Error en interacción de ticket:", error);
        }

        // --- SISTEMAS ADICIONALES (Carga por colección) ---
        const systems = ['apertura', 'dni', 'licencia', 'multar', 'detencion', 'vehiculo'];
        
        // Mapeo de prefijos de customId a nombres de comandos
        if (customId.includes('modal_setup') || customId.includes('confirm_') || customId.includes('abort_')) {
            const cmd = client.commands.get('apertura');
            if (cmd) return await cmd.handleAperturaInteractions(interaction);
        }
        if (customId === 'modal_crear_dni') {
            const cmd = client.commands.get('dni');
            if (cmd) return await cmd.handleDNIInteractions(interaction);
        }
        if (customId.includes('licencia') || customId.includes('_lic_')) {
            const cmd = client.commands.get('licencia');
            if (cmd) return customId.includes('_lic_') ? await cmd.handleButtons(interaction) : await cmd.handleLicenciaInteractions(interaction);
        }
        if (customId.startsWith('modal_multa_')) {
            const cmd = client.commands.get('multar');
            if (cmd) return await cmd.handleMultaInteractions(interaction);
        }
        if (customId.startsWith('modal_detencion_')) {
            const cmd = client.commands.get('detencion');
            if (cmd) return await cmd.handleDetencionInteractions(interaction);
        }
        if (customId.includes('vehiculo') || customId.includes('_veh_')) {
            const cmd = client.commands.get('vehiculo');
            if (cmd) return customId.includes('_veh_') ? await cmd.handleButtons(interaction) : await cmd.handleVehiculoInteractions(interaction);
        }
    }
});

// --- ⭐ MANEJO DE REACCIONES ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) try { await reaction.fetch(); } catch (e) { return; }
    
    const cmdApertura = client.commands.get('apertura');
    if (cmdApertura && cmdApertura.handleReactions) {
        await cmdApertura.handleReactions(reaction, user);
    }
});

client.login(process.env.DISCORD_TOKEN);