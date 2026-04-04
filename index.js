const { Client, GatewayIntentBits, ActivityType, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { handleTicketInteractions, sendTicketPanel } = require('./Automatizaciones/tickets');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
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
            if (mensajes.size > 0) await canalTickets.bulkDelete(mensajes, true);
            await sendTicketPanel(canalTickets);
            console.log("🎫 Canal de tickets listo.");
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

    // 2️⃣ BOTONES Y MODALES
    if (interaction.isButton() || interaction.isModalSubmit()) {
        const { customId } = interaction;

        // Lógica para el sistema de Apertura/Sesión
        if (customId.startsWith('modal_setup') || 
            customId.startsWith('vote_') || 
            customId.startsWith('modal_resumen')) {
            
            const cmdApertura = client.commands.get('apertura');
            if (cmdApertura && cmdApertura.handleAperturaInteractions) {
                try {
                    return await cmdApertura.handleAperturaInteractions(interaction);
                } catch (error) {
                    console.error("Error en handleAperturaInteractions:", error);
                }
            }
        }

        // Lógica para Tickets (si no es de apertura, va a tickets)
        try {
            await handleTicketInteractions(interaction);
        } catch (error) {
            console.error("Error en interacción de ticket:", error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);