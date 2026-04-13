const { 
    Client, GatewayIntentBits, ActivityType, Collection, 
    EmbedBuilder, AttachmentBuilder, Events, ModalBuilder, TextInputBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions, // Requerido para votos
        GatewayIntentBits.GuildVoiceStates
    ],
    // AÑADE ESTO:
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'] 
});

// --- 🛡️ CONFIGURACIÓN DE SEGURIDAD ---
const SERVIDORES_PERMITIDOS = ['1475568777360969932', '1473156452674961502'];
const CANAL_REPORTES_ID = '1476788899186737172';
const USER_A_MENCIONAR_ID = '824811313989419018';
const CANAL_TICKETS_ID = '1476763743424610305';

// 🛑 SISTEMA ANTI-DDOS / RATE LIMIT
const cooldowns = new Map();
const COOLDOWN_SECONDS = 3;

client.commands = new Collection();
client.prefixInteractions = new Collection(); 

// --- 🎫 IMPORTACIONES ---
const { handleTicketInteractions, sendTicketPanel } = require('./Comandos/Automatizaciones/tickets');
const { db } = require('./Comandos/Automatizaciones/firebase');

// --- 📂 CARGA DE COMANDOS Y SISTEMAS ---
const eventsPath = path.join(__dirname, 'Seguridad');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

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

const loadPrefixInteractions = () => {
    const interaccionesPath = path.join(__dirname, 'Interacciones');
    if (fs.existsSync(interaccionesPath)) {
        const files = fs.readdirSync(interaccionesPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const interaccion = require(path.join(interaccionesPath, file));
            client.prefixInteractions.set(interaccion.name || file.split('.')[0], interaccion);
        }
    }
};

loadCommands(path.join(__dirname, 'Comandos'));
loadPrefixInteractions();

// --- 🚀 EVENTO READY ---
client.once('ready', async (c) => {
    console.log(`✅ Anda RP Online: ${c.user.tag}`);
    client.user.setPresence({ 
        activities: [{ name: '🔥 Anda RP | Rol de Calidad', type: ActivityType.Watching }], 
        status: 'online' 
    });

    // A. Persistencia de Despachos
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
        try {
            const mensajes = await canalTickets.messages.fetch({ limit: 10 });
            if (mensajes.size > 0) await canalTickets.bulkDelete(mensajes, true);
            await sendTicketPanel(canalTickets);
        } catch (e) { console.error("❌ Error renovando panel de tickets:", e); }
    }
});

// --- 🛡️ SEGURIDAD: ANTI-INVITE ---
client.on('guildCreate', async (guild) => {
    if (!SERVIDORES_PERMITIDOS.includes(guild.id)) {
        const canalReportes = client.channels.cache.get(CANAL_REPORTES_ID);
        if (canalReportes) {
            const owner = await guild.fetchOwner();
            const embed = new EmbedBuilder()
                .setTitle('🚨 INTENTO DE INGRESO NO AUTORIZADO')
                .setColor('#FF0000')
                .addFields(
                    { name: '🏰 Servidor', value: guild.name, inline: true },
                    { name: '🆔 ID', value: guild.id, inline: true },
                    { name: '👑 Dueño', value: owner.user.tag, inline: true }
                ).setTimestamp();
            await canalReportes.send({ content: `<@${USER_A_MENCIONAR_ID}>`, embeds: [embed] });
        }
        await guild.leave();
    }
});

// --- 💬 EVENTO MENSAJES (PREFIJO !) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    if (message.content.startsWith('!')) {
        if (cooldowns.has(userId)) {
            const lastTime = cooldowns.get(userId);
            if (Date.now() - lastTime < COOLDOWN_SECONDS * 1000) return;
        }
        cooldowns.set(userId, Date.now());
    }

    const msgHandler = client.prefixInteractions.get('mensajes');
    if (msgHandler?.handlePrefixCommands) await msgHandler.handlePrefixCommands(message);

    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === 'dinero-give') {
        const cmdBanco = client.commands.get('banco');
        if (cmdBanco?.handleAdminGive) return await cmdBanco.handleAdminGive(message);
    }

    const interaccion = client.prefixInteractions.get(commandName);
    if (interaccion?.execute) await interaccion.execute(message, args, client).catch(console.error);
});

// --- ⚡ INTERACCIONES (MOTOR PRINCIPAL) ---
client.on('interactionCreate', async (interaction) => {
    const userId = interaction.user.id;
    
    // Anti-Spam de botones/modales
    if (cooldowns.has(userId)) {
        const lastTime = cooldowns.get(userId);
        if (Date.now() - lastTime < 500) return;
    }
    cooldowns.set(userId, Date.now());

    // 1. Comandos de Barra (Slash)
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction).catch(console.error);
        return;
    }

    const customId = interaction.customId;
    if (!customId) return;

    try {
        // --- A. GESTIÓN DE MODALES ---
        if (interaction.isModalSubmit()) {
            // NUEVO: SISTEMA DE VEHÍCULOS (DGT)
            if (customId === 'modal_registro_vehiculo') {
                return await client.commands.get('vehiculo')?.handleVehiculoInteractions(interaction);
            }

            // Sistemas de Identidad
            if (customId === 'modal_crear_dni') return await client.commands.get('dni')?.handleDNIInteractions(interaction);
            if (customId === 'modal_solicitar_licencia') return await client.commands.get('licencia')?.handleLicenciaInteractions(interaction);
            
            // Cuarentena / Seguridad
            if (customId.startsWith('modal_cuarentena_')) {
                const motivo = interaction.fields.getTextInputValue('motivo_ingreso');
                const explicacion = interaction.fields.getTextInputValue('explicacion');
                const canalSecurityId = '1492339602420273241';
                const canalSecurity = interaction.guild.channels.cache.get(canalSecurityId);

                const embedStaff = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('📑 Apelación de Cuarentena')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Usuario', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                        { name: '❓ Motivo percibido', value: motivo },
                        { name: '📝 Explicación del Staff', value: explicacion }
                    ).setTimestamp();

                const rowDecisiva = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceptar_cuarentena_${userId}`).setLabel('Devolver Rangos').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rechazar_cuarentena_${userId}`).setLabel('Expulsar y Blacklist').setStyle(ButtonStyle.Danger)
                );

                if (canalSecurity) await canalSecurity.send({ content: `⚠️ <@&1476768951034970253> Nueva apelación.`, embeds: [embedStaff], components: [rowDecisiva] });
                return await interaction.reply({ content: '✅ Formulario enviado.', ephemeral: true });
            }

            // Kick por Anti-Alt
            if (customId.startsWith('modal_kick_')) {
                const targetId = customId.split('_')[2];
                const motivo = interaction.fields.getTextInputValue('kick_reason');
                const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (member) {
                    await member.kick(motivo);
                    return await interaction.reply({ content: `✅ <@${targetId}> expulsado.`, ephemeral: true });
                }
            }
            
            // TICKETS: Captura de Modales (Importante para que no falle el submit)
            if (customId.startsWith('modal_t_') || customId === 'modal_pre_close') {
                return await handleTicketInteractions(interaction);
            }
        }

        // --- B. GESTIÓN DE MENÚS DESPLEGABLES (Select Menus) ---
        if (interaction.isStringSelectMenu()) {
            if (customId === 'select_tramite_vehiculo') {
                return await client.commands.get('vehiculo')?.handleVehiculoInteractions(interaction);
            }
        }

        // --- C. GESTIÓN DE BOTONES ---
        if (interaction.isButton()) {
            // NUEVO: SISTEMA DE VEHÍCULOS (APROBAR/DENEGAR)
            if (customId.startsWith('aprobar_veh_') || customId.startsWith('denegar_veh_')) {
                return await client.commands.get('vehiculo')?.handleButtons(interaction);
            }

            // Licencias (Aprobar/Denegar)
            if (customId.startsWith('aprobar_lic_') || customId.startsWith('denegar_lic_')) {
                return await client.commands.get('licencia')?.handleButtons(interaction);
            }

            // Seguridad: Cuarentena
            if (customId.startsWith('aceptar_cuarentena_') || customId.startsWith('rechazar_cuarentena_')) {
                const [accion, , targetId] = customId.split('_');
                const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
                const rolCuarentenaId = '1492342183813189783';

                if (accion === 'aceptar' && targetMember) {
                    await targetMember.roles.remove(rolCuarentenaId);
                    return await interaction.reply({ content: `✅ Cuarentena retirada a <@${targetId}>.`, ephemeral: true });
                }
                if (accion === 'rechazar' && targetMember) {
                    await targetMember.ban({ reason: 'Apelación rechazada' });
                    await db.collection('blacklist').doc(targetId).set({ usuarioId: targetId, motivo: 'Falla en apelación', fecha: new Date().toISOString() });
                    return await interaction.reply({ content: `🚫 <@${targetId}> baneado y en Blacklist.`, ephemeral: true });
                }
            }

            // Anti-Alt Info & Kick
            if (customId.startsWith('kick_')) {
                const targetId = customId.split('_')[1];
                const modal = new ModalBuilder().setCustomId(`modal_kick_${targetId}`).setTitle('Expulsar Usuario');
                const input = new TextInputBuilder().setCustomId('kick_reason').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }

            if (customId.startsWith('info_')) {
                const targetId = customId.split('_')[1];
                const userSnap = await db.collection('sanciones_warns').where('usuarioId', '==', targetId).get();
                const infoEmbed = new EmbedBuilder().setTitle(`Detalles: ${targetId}`).setColor('#e1ff00').setDescription(`Historial de warns: **${userSnap.size}**`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`kick_${targetId}`).setLabel('Expulsar').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ignore_alert').setLabel('Ignorar').setStyle(ButtonStyle.Secondary)
                );
                return await interaction.reply({ embeds: [infoEmbed], components: [row], ephemeral: true });
            }

            if (customId === 'ignore_alert') return await interaction.update({ content: '✅ Alerta ignorada.', embeds: [], components: [] });
        }

        // --- D. FALLBACKS Y OTROS SISTEMAS ---
        // Tickets (Captura botones y modales de cierre)
        if (customId.startsWith('t_') || customId.startsWith('ticket_') || customId.includes('close')) {
            return await handleTicketInteractions(interaction);
        }
        // Despachos
        if (customId.startsWith('apr_desp_') || customId.startsWith('den_desp_')) {
            return await client.prefixInteractions.get('despacho')?.handleButtons(interaction);
        }
        // Apertura
        if (customId.match(/^(confirm_|abort_|modal_setup|modal_resumen|apertura)/)) {
            return await client.commands.get('apertura')?.handleAperturaInteractions(interaction);
        }
        // Tiendas
        if (customId === 'comprar_tienda') return await client.commands.get('tienda')?.handleTiendaInteractions(interaction);
        if (customId === 'comprar_blackmarket') return await client.commands.get('blackmarket')?.handleBlackmarketInteractions(interaction);

        // Handler Automático por Prefijo (dni_, multa_, etc)
        const prefix = customId.split('_')[0];
        const cmd = client.commands.get(prefix) || client.commands.get(customId);
        if (cmd) {
            if (interaction.isButton() && cmd.handleButtons) return await cmd.handleButtons(interaction);
            if (interaction.isModalSubmit() && cmd.handleModal) return await cmd.handleModal(interaction);
            const genericHandler = `handle${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Interactions`;
            if (cmd[genericHandler]) return await cmd[genericHandler](interaction);
        }

    } catch (error) {
        console.error(`❌ Error en interacción [${customId}]:`, error);
        if (!interaction.replied) await interaction.reply({ content: 'Error procesando la acción.', ephemeral: true }).catch(() => {});
    }
});

// --- 🎭 REACCIONES ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    await client.commands.get('apertura')?.handleReactions?.(reaction, user);
});

// --- 🏢 SISTEMA DE VOZ ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member?.user.bot) return;
    const despachoCmd = client.prefixInteractions.get('despacho');
    if (newState.channelId === despachoCmd?.salaEsperaId && oldState.channelId !== newState.channelId) {
        await despachoCmd.handleWaitingRoom(oldState, newState).catch(console.error);
    }
});

// 🛡️ ERRORES GLOBALES
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(process.env.DISCORD_TOKEN);