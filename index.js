const { Client, GatewayIntentBits, Collection, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// Carga Dinámica de Comandos
const foldersPath = path.join(__dirname, 'Comandos');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// Evento: Bot Listo
client.once('ready', () => {
    console.log(`✅ Anda RP Bot conectado como ${client.user.tag}`);
    client.user.setActivity('Viendo Anda RP', { type: ActivityType.Watching });
});

// Manejo de Comandos Slash (/)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
    }
});

// Manejo de Interacciones de Mensajes (!)
const { handlePrefixCommands } = require('./Interacciones/mensajes');
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    await handlePrefixCommands(message);
});

// Manejo de Botones y Modales (Tickets e Interacciones)
const { handleTicketInteractions } = require('./Automatizaciones/tickets');
client.on('interactionCreate', async interaction => {
    if (interaction.isButton() || interaction.isModalSubmit()) {
        await handleTicketInteractions(interaction);
    }
});

client.login(process.env.DISCORD_TOKEN);