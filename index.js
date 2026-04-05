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
client.prefixInteractions = new Collection(); 

// --- 📂 1. CARGA DE COMANDOS SLASH (/) ---
const foldersPath = path.join(__dirname, 'Comandos');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    if (fs.lstatSync(commandsPath).isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            }
        }
    }
}

// --- 📂 2. CARGA DE INTERACCIONES DE PREFIJO (!) ---
const interaccionesPath = path.join(__dirname, 'Interacciones');
if (fs.existsSync(interaccionesPath)) {
    const interaccionFiles = fs.readdirSync(interaccionesPath).filter(file => file.endsWith('.js'));
    for (const file of interaccionFiles) {
        const filePath = path.join(interaccionesPath, file);
        const interaccion = require(filePath);
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

    if (commandName === 'dinero-give') {
        const cmdBanco = client.commands.get('banco');
        if (cmdBanco && cmdBanco.handleAdminGive) {
            return await cmdBanco.handleAdminGive(message);
        }
    }

    const interaccion = client.prefixInteractions.get(commandName) || client.prefixInteractions.get('despachos');
    if (interaccion && typeof interaccion.execute === 'function') {
        try {
            await interaccion.execute(message, args, client);
        } catch (error) {
            console.error(`❌ Error en interaccion !${commandName}:`, error);
        }
    }
});

// --- ⚡ MANEJO DE INTERACCIONES (SLASH, BOTONES, MODALES, MENÚS) ---
client.on('interactionCreate', async (interaction) => {
    
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Error ejecutando ${interaction.commandName}:`, error);
            const msgError = { content: 'Hubo un error al ejecutar el comando.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msgError).catch(() => {});
            } else {
                await interaction.reply(msgError).catch(() => {});
            }
        }
        return;
    }

    // 2. BOTONES, MODALES Y MENÚS
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
        const { customId } = interaction;

        try {
            // --- 🎫 SISTEMA DE TICKETS ---
            if (customId.includes('ticket') || customId.includes('modal_t_') || customId.includes('modal_final_close') || customId.includes('t_')) {
                await handleTicketInteractions(interaction);
                return;
            }

            // --- 🛒 TIENDA LEGAL ---
            if (customId === 'comprar_tienda') {
                const cmd = client.commands.get('tienda');
                if (cmd) return await cmd.handleTiendaInteractions(interaction);
            }

            // --- 💀 BLACKMARKET ---
            if (customId === 'comprar_blackmarket') {
                const cmd = client.commands.get('blackmarket');
                if (cmd) return await cmd.handleBlackmarketInteractions(interaction);
            }

            // --- 🆔 CAMBIO DE MATRÍCULAS ---
            if (customId === 'seleccionar_coche_matricula') {
                const cmd = client.commands.get('cambiarmatricula');
                if (cmd) return await cmd.handleMatriculaInteractions(interaction);
            }

            // --- 🚘 VEHÍCULOS (DGT) ---
            if (customId.includes('vehiculo') || customId.includes('_veh_') || customId === 'select_tramite_vehiculo' || customId === 'modal_registro_vehiculo') {
                const cmd = client.commands.get('vehiculo');
                if (cmd) {
                    if (customId.includes('_veh_') && interaction.isButton()) return await cmd.handleButtons(interaction);
                    return await cmd.handleVehiculoInteractions(interaction);
                }
            }

            // --- 🪪 DNI ---
            if (customId.includes('dni')) {
                const cmd = client.commands.get('dni');
                if (cmd) return await cmd.handleDNIInteractions(interaction);
            }

            // --- 📜 LICENCIAS ---
            if (customId.includes('licencia') || customId.includes('_lic_')) {
                const cmd = client.commands.get('licencia');
                if (cmd) {
                    if (customId.includes('_lic_')) return await cmd.handleButtons(interaction);
                    return await cmd.handleLicenciaInteractions(interaction);
                }
            }

            // --- 🏢 APERTURAS ---
            if (customId.includes('apertura') || customId.includes('confirm_') || customId.includes('abort_')) {
                const cmd = client.commands.get('apertura');
                if (cmd) return await cmd.handleAperturaInteractions(interaction);
            }

            // --- 🚔 SANCIONES (POLICÍA) ---
            if (customId.startsWith('modal_multa_')) {
                const cmd = client.commands.get('multar');
                if (cmd) return await cmd.handleMultaInteractions(interaction);
            }
            if (customId.startsWith('modal_detencion_')) {
                const cmd = client.commands.get('detencion');
                if (cmd) return await cmd.handleDetencionInteractions(interaction);
            }

        } catch (error) {
            console.error("❌ Error en interacción:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Error al procesar la interacción.', ephemeral: true }).catch(() => {});
            }
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