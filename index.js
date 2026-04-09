const { Client, GatewayIntentBits, ActivityType, Collection, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- 🎫 IMPORTACIONES DE SISTEMAS EXTERNOS ---
const { handleTicketInteractions, sendTicketPanel } = require('./Comandos/Automatizaciones/tickets');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
client.prefixInteractions = new Collection(); 

// --- 🛡️ CONFIGURACIÓN DE SEGURIDAD Y CANALES ---
const SERVIDORES_PERMITIDOS = ['1475568777360969932', '1473156452674961502'];
const CANAL_REPORTES_ID = '1476788899186737172';
const USER_A_MENCIONAR_ID = '824811313989419018';
const CANAL_TICKETS_ID = '1476763743424610305';

// --- 📂 1. CARGA RECURSIVA DE COMANDOS SLASH (/) ---
const loadCommands = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            }
        }
    }
};
loadCommands(path.join(__dirname, 'Comandos'));

// --- 📂 2. CARGA DE INTERACCIONES DE PREFIJO (!) ---
const interaccionesPath = path.join(__dirname, 'Interacciones');
if (fs.existsSync(interaccionesPath)) {
    const interaccionFiles = fs.readdirSync(interaccionesPath).filter(file => file.endsWith('.js'));
    for (const file of interaccionFiles) {
        const interaccion = require(path.join(interaccionesPath, file));
        const name = interaccion.name || file.split('.')[0]; 
        client.prefixInteractions.set(name, interaccion);
    }
}

// --- 🚀 EVENTO READY ---
client.once('ready', async (c) => {
    console.log(`✅ Anda RP Online: ${c.user.tag}`);
    client.user.setPresence({ activities: [{ name: '🔥 Anda RP', type: ActivityType.Watching }], status: 'online' });

    // A. Persistencia de Despachos (Firebase)
    const { db } = require('./Comandos/Automatizaciones/firebase');
    const despachoCmd = client.prefixInteractions.get('despacho');

    setInterval(async () => {
        const ahora = Date.now();
        try {
            const snapshot = await db.collection('despachos_activos').where('expiracion', '<=', ahora).get();
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const guild = client.guilds.cache.get(data.guildId);
                if (guild && despachoCmd?.finalizarDespacho) {
                    await despachoCmd.finalizarDespacho(guild, doc.id, data.roleId);
                }
            }
        } catch (e) { console.error("❌ Error en persistencia:", e); }
    }, 60000);

    // B. Auto-Panel de Tickets
    const canalTickets = client.channels.cache.get(CANAL_TICKETS_ID);
    if (canalTickets) {
        const mensajes = await canalTickets.messages.fetch({ limit: 10 }).catch(() => null);
        if (mensajes && mensajes.size > 0) await canalTickets.bulkDelete(mensajes, true).catch(() => {});
        await sendTicketPanel(canalTickets);
    }
});

// --- 🛡️ SEGURIDAD: ANTI-INVITE ---
client.on('guildCreate', async (guild) => {
    if (!SERVIDORES_PERMITIDOS.includes(guild.id)) {
        const canalReportes = client.channels.cache.get(CANAL_REPORTES_ID);
        if (canalReportes) {
            const owner = await guild.fetchOwner();
            const embed = new EmbedBuilder()
                .setTitle('🚨 INGRESO NO AUTORIZADO')
                .setColor('#FF0000')
                .addFields(
                    { name: '🏰 Servidor', value: guild.name, inline: true },
                    { name: '👑 Dueño', value: owner.user.tag, inline: true }
                ).setTimestamp();
            await canalReportes.send({ content: `<@${USER_A_MENCIONAR_ID}>`, embeds: [embed] });
        }
        await guild.leave();
    }
});

// --- 💬 MENSAJES DE PREFIJO (!) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Soporte para !ayuda y !mod (mensajes.js)
    const msgHandler = client.prefixInteractions.get('mensajes');
    if (msgHandler?.handlePrefixCommands) await msgHandler.handlePrefixCommands(message);

    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Dinero-Give (Comando administrativo de banco)
    if (commandName === 'dinero-give') {
        const cmdBanco = client.commands.get('banco');
        if (cmdBanco?.handleAdminGive) return await cmdBanco.handleAdminGive(message);
    }

    const interaccion = client.prefixInteractions.get(commandName);
    if (interaccion?.execute) await interaccion.execute(message, args, client).catch(console.error);
});

// --- ⚡ INTERACCIONES (SLASH, BOTONES, MODALES, SELECTS) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction).catch(console.error);
        return;
    }

    const { customId } = interaction;
    if (!customId) return;

    try {
        // 1. TICKETS (Alta Prioridad)
        if (customId.includes('ticket') || customId.startsWith('t_') || customId.startsWith('modal_t_') || customId.includes('close')) {
            return await handleTicketInteractions(interaction);
        }

        // 2. APERTURA / CIERRE DE SESIONES
        if (customId.match(/^(confirm_|abort_|modal_setup|modal_resumen|apertura)/)) {
            const cmd = client.commands.get('apertura');
            if (cmd?.handleAperturaInteractions) return await cmd.handleAperturaInteractions(interaction);
        }

        // 3. TIENDA / MATRÍCULA / BLACKMARKET
        if (customId === 'comprar_tienda') return await client.commands.get('tienda')?.handleTiendaInteractions(interaction);
        if (customId === 'comprar_blackmarket') return await client.commands.get('blackmarket')?.handleBlackmarketInteractions(interaction);
        if (customId === 'seleccionar_coche_matricula') return await client.commands.get('cambiarmatricula')?.handleMatriculaInteractions(interaction);

        // 4. MANEJADOR DINÁMICO (DNI, Vehiculo, Licencia, Multar, Detencion)
        const prefix = customId.split('_')[0];
        const cmd = client.commands.get(prefix) || client.commands.get(customId);

        if (cmd) {
            if (interaction.isButton() && cmd.handleButtons) return await cmd.handleButtons(interaction);
            if (interaction.isModalSubmit() && cmd.handleModal) return await cmd.handleModal(interaction);
            
            // Lógica para DNI/Vehiculo (handleDNIInteractions / handleVehiculoInteractions)
            const genericHandler = `handle${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Interactions`;
            if (cmd[genericHandler]) return await cmd[genericHandler](interaction);
        }

        // 5. CASOS ESPECÍFICOS DE MODALES (Multas y Detención)
        if (customId.startsWith('modal_multa_')) return await client.commands.get('multar')?.handleMultaInteractions(interaction);
        if (customId.startsWith('modal_detencion_')) return await client.commands.get('detencion')?.handleDetencionInteractions(interaction);

    } catch (error) {
        console.error(`❌ Error en interacción [${customId}]:`, error);
    }
});

// --- 🎭 REACCIONES (Para el sistema de Apertura) ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    const cmd = client.commands.get('apertura');
    if (cmd?.handleReactions) await cmd.handleReactions(reaction, user);
});


// -- COSAS DESPACHOS XD 

client.on('voiceStateUpdate', async (oldState, newState) => {
    // 1. Verificamos si el usuario entró a un canal (newState.channelId no es nulo)
    // 2. Verificamos que no sea un bot
    if (newState.member.user.bot) return;

    // 3. Obtenemos el comando de la colección
    const despachoCmd = client.commands.get('despacho');
    if (!despachoCmd) return;

    // 4. Si el canal al que entró es el de la Sala de Espera
    if (newState.channelId === despachoCmd.salaEsperaId && oldState.channelId !== newState.channelId) {
        try {
            await despachoCmd.handleWaitingRoom(oldState, newState);
        } catch (error) {
            console.error("Error al ejecutar handleWaitingRoom:", error);
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    const despachoCmd = client.commands.get('despacho');
    if (!despachoCmd) return;

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('apr_desp_') || interaction.customId.startsWith('den_desp_')) {
            await despachoCmd.handleButtons(interaction);
        }
    }
});
client.login(process.env.DISCORD_TOKEN);