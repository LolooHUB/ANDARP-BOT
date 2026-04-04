const { Client, GatewayIntentBits, ActivityType, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { handleTicketInteractions, sendTicketPanel } = require('./Automatizaciones/tickets');

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

// --- CARGA DE COMANDOS ---
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

// --- EVENTO READY ---
client.once('ready', async () => {
    console.log(`✅ Bot Online: ${client.user.tag}`);

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
                await canalTickets.bulkDelete(mensajes, true);
            }
            await sendTicketPanel(canalTickets);
            console.log("🎫 Canal de tickets limpiado y panel enviado.");
        } catch (error) {
            console.error("❌ Error en auto-panel:", error);
        }
    }
});

// --- MANEJO DE INTERACCIONES ---
client.on('interactionCreate', async (interaction) => {
    // 1️⃣ COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Hubo un error al ejecutar el comando.', ephemeral: true });
        }
    }

    // 2️⃣ BOTONES Y MODALES (Sistemas RP)
    if (interaction.isButton() || interaction.isModalSubmit()) {
        const { customId } = interaction;

        // --- SISTEMA DE APERTURA (SESIONES) ---
        if (customId.includes('modal_setup') || customId.includes('confirm_') || customId.includes('abort_') || customId.includes('modal_resumen')) {
            const cmdApertura = client.commands.get('apertura');
            if (cmdApertura) return await cmdApertura.handleAperturaInteractions(interaction);
        }

        // --- SISTEMA DE DNI ---
        if (customId === 'modal_crear_dni') {
            const cmdDni = client.commands.get('dni');
            if (cmdDni) return await cmdDni.handleDNIInteractions(interaction);
        }

        // --- SISTEMA DE LICENCIAS (MODAL Y BOTONES STAFF) ---
        if (customId === 'modal_solicitar_licencia') {
            const cmdLic = client.commands.get('licencia');
            if (cmdLic) return await cmdLic.handleLicenciaInteractions(interaction);
        }

        if (customId.includes('_lic_')) { // Captura aprobar_lic_ y denegar_lic_
            const cmdLic = client.commands.get('licencia');
            if (cmdLic) return await cmdLic.handleButtons(interaction);
        }

        // --- LÓGICA DE TICKETS (Por defecto si nada coincide) ---
        try {
            await handleTicketInteractions(interaction);
        } catch (error) {
            // Solo loguear si no fue manejado por los sistemas anteriores
            if (!interaction.replied && !interaction.deferred) {
                console.error("Error en interacción de ticket:", error);
            }
        }
    }
});

// --- MANEJO DE REACCIONES (Para el sistema de apertura por votos) ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
        try { await reaction.fetch(); } catch (e) { return; }
    }
    
    const cmdApertura = client.commands.get('apertura');
    if (cmdApertura && cmdApertura.handleReactions) {
        await cmdApertura.handleReactions(reaction, user);
    }
});

client.login(process.env.DISCORD_TOKEN);