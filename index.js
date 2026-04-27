const { 
    Client, GatewayIntentBits, ActivityType, Collection, 
    EmbedBuilder, AttachmentBuilder, Events, ModalBuilder, TextInputBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputStyle, Partials 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * 🚀 ANDA RP - CORE INFRASTRUCTURE v7.5
 * -------------------------------------------------------------
 * Sistema Centralizado de Gestión de Rol de Alta Calidad.
 * Incluye: Tickets, Aperturas SSU, DGT, Seguridad Anti-Alt y Auditoría.
 * -------------------------------------------------------------
 */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User] 
});

// --- 🛡️ CONFIGURACIÓN DE SEGURIDAD Y RED ---
const SERVIDORES_PERMITIDOS = ['1475568777360969932', '1473156452674961502'];
const CANAL_REPORTES_ID = '1476788899186737172';
const USER_A_MENCIONAR_ID = '824811313989419018';
const CANAL_TICKETS_ID = '1476763743424610305';
const CANAL_LOGS_GLOBAL_ID = '1482565635715109015';

// 🛑 GESTIÓN DE TRÁFICO (RATE LIMIT)
const cooldowns = new Map();
const COOLDOWN_SECONDS = 3;

client.commands = new Collection();
client.prefixInteractions = new Collection(); 

// --- 🎫 IMPORTACIONES DE MÓDULOS ---
const { handleTicketInteractions, sendTicketPanel } = require('./Comandos/Automatizaciones/tickets');
const { db } = require('./Comandos/Automatizaciones/firebase');

// --- 📂 CARGA DE SISTEMAS (COMMANDS & EVENTS) ---
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

// --- 🚀 EVENTO READY (INICIALIZACIÓN DE SERVICIOS) ---
client.once('ready', async (c) => {
    console.log(`✅ Anda RP Online: ${c.user.tag}`);
    client.user.setPresence({ 
        activities: [{ name: '🔥 Anda RP | Rol de Calidad', type: ActivityType.Watching }], 
        status: 'online' 
    });

    // Auditoría de Despachos Activos (Persistencia)
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
        } catch (e) { console.error("❌ Error en persistencia de despachos:", e); }
    }, 60000);

    // Mantenimiento del Panel de Tickets
    const canalTickets = client.channels.cache.get(CANAL_TICKETS_ID);
    if (canalTickets) {
        try {
            const mensajes = await canalTickets.messages.fetch({ limit: 10 });
            if (mensajes.size > 0) await canalTickets.bulkDelete(mensajes, true);
            await sendTicketPanel(canalTickets);
        } catch (e) { console.error("❌ Error renovando panel de tickets:", e); }
    }
});

// --- 🛡️ SISTEMA DE PROTECCIÓN PERIMETRAL ---
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

// --- 💬 PROCESADOR DE MENSAJES (PREFIJO !) ---
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

    // Comandos Administrativos de Prefijo
    if (commandName === 'dinero-give') {
        const cmdBanco = client.commands.get('banco');
        if (cmdBanco?.handleAdminGive) return await cmdBanco.handleAdminGive(message);
    }

    const interaccion = client.prefixInteractions.get(commandName);
    if (interaccion?.execute) await interaccion.execute(message, args, client).catch(console.error);
});

// --- ⚡ MOTOR DE INTERACCIONES (EVENTO MAESTRO) ---
client.on('interactionCreate', async (interaction) => {
    const userId = interaction.user.id;
    
    // Anti-Spam global de interacciones
    if (cooldowns.has(userId)) {
        const lastTime = cooldowns.get(userId);
        if (Date.now() - lastTime < 450) return; 
    }
    cooldowns.set(userId, Date.now());

    // 1. Slash Commands (Comandos de Barra)
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction).catch(async (err) => {
            console.error(err);
            if (!interaction.replied) await interaction.reply({ content: 'Error crítico de ejecución.', ephemeral: true });
        });
        return;
    }

    const customId = interaction.customId;
    if (!customId) return;

    try {
        // --- A. GESTIÓN DE MODALES (DATA INPUT) ---
        if (interaction.isModalSubmit()) {
            
            // Sistema de Vehículos (DGT)
            if (customId === 'modal_registro_vehiculo') {
                return await client.commands.get('vehiculo')?.handleVehiculoInteractions(interaction);
            }

            // Sistemas de Identidad y Registro
            if (customId === 'modal_crear_dni') return await client.commands.get('dni')?.handleDNIInteractions(interaction);
            if (customId === 'modal_solicitar_licencia') return await client.commands.get('licencia')?.handleLicenciaInteractions(interaction);
            
            // Sistema de Apertura / SSU (Nuevo)
            if (customId === 'modal_setup_rol' || customId === 'modal_resumen_cierre') {
                return await client.commands.get('apertura')?.handleAperturaInteractions(interaction);
            }

            // Seguridad: Cuarentena y Apelaciones
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
                return await interaction.reply({ content: '✅ Formulario de apelación enviado correctamente.', ephemeral: true });
            }

            // Kick por Seguridad / Moderación
            if (customId.startsWith('modal_kick_')) {
                const targetId = customId.split('_')[2];
                const motivo = interaction.fields.getTextInputValue('kick_reason');
                const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (member) {
                    await member.kick(motivo);
                    return await interaction.reply({ content: `✅ <@${targetId}> ha sido expulsado por el staff.`, ephemeral: true });
                }
            }
            
            // Tickets: Captura de Modales
            if (customId.startsWith('modal_t_') || customId === 'modal_pre_close') {
                return await handleTicketInteractions(interaction);
            }
        }

        // --- B. GESTIÓN DE SELECCIÓN (SELECT MENUS) ---
        if (interaction.isStringSelectMenu()) {
            if (customId === 'select_tramite_vehiculo') {
                return await client.commands.get('vehiculo')?.handleVehiculoInteractions(interaction);
            }
        }

        // --- C. GESTIÓN DE BOTONES (ACCIONES RÁPIDAS) ---
        if (interaction.isButton()) {
            
            // Sistema SSU / Apertura (Botones Bypass, Cancel, etc)
            if (customId === 'confirm_bypass_vote' || customId === 'confirm_cancel_vote' || customId === 'abort_action' || customId === 'confirm_open_modal_cierre') {
                return await client.commands.get('apertura')?.handleAperturaInteractions(interaction);
            }

            // Vehículos (Aprobación de DGT)
            if (customId.startsWith('aprobar_veh_') || customId.startsWith('denegar_veh_')) {
                return await client.commands.get('vehiculo')?.handleButtons(interaction);
            }

            // Licencias (Aprobación de Jefatura)
            if (customId.startsWith('aprobar_lic_') || customId.startsWith('denegar_lic_')) {
                return await client.commands.get('licencia')?.handleButtons(interaction);
            }

            // Moderación de Cuarentena
            if (customId.startsWith('aceptar_cuarentena_') || customId.startsWith('rechazar_cuarentena_')) {
                const [accion, , targetId] = customId.split('_');
                const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
                const rolCuarentenaId = '1492342183813189783';

                if (accion === 'aceptar' && targetMember) {
                    await targetMember.roles.remove(rolCuarentenaId);
                    return await interaction.reply({ content: `✅ Cuarentena retirada a <@${targetId}>.`, ephemeral: true });
                }
                if (accion === 'rechazar' && targetMember) {
                    await targetMember.ban({ reason: 'Apelación de cuarentena rechazada por administración.' });
                    await db.collection('blacklist').doc(targetId).set({ usuarioId: targetId, motivo: 'Falla en apelación', fecha: new Date().toISOString() });
                    return await interaction.reply({ content: `🚫 <@${targetId}> ha sido baneado y añadido a la Blacklist.`, ephemeral: true });
                }
            }

            // Sistema de Información y Kick
            if (customId.startsWith('kick_')) {
                const targetId = customId.split('_')[1];
                const modal = new ModalBuilder().setCustomId(`modal_kick_${targetId}`).setTitle('Expulsar Usuario');
                const input = new TextInputBuilder().setCustomId('kick_reason').setLabel('Motivo de Expulsión').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }

            if (customId.startsWith('info_')) {
                const targetId = customId.split('_')[1];
                const userSnap = await db.collection('sanciones_warns').where('usuarioId', '==', targetId).get();
                const infoEmbed = new EmbedBuilder().setTitle(`Expediente: ${targetId}`).setColor('#e1ff00').setDescription(`Historial registrado de infracciones: **${userSnap.size}**`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`kick_${targetId}`).setLabel('Expulsar').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ignore_alert').setLabel('Ignorar Alerta').setStyle(ButtonStyle.Secondary)
                );
                return await interaction.reply({ embeds: [infoEmbed], components: [row], ephemeral: true });
            }

            if (customId === 'ignore_alert') return await interaction.update({ content: '✅ Alerta descartada por el operador.', embeds: [], components: [] });
        }

        // --- D. SISTEMAS DE SOPORTE Y TIENDAS ---
        
        // Tickets (Botones y Cierre)
        if (customId.startsWith('t_') || customId.startsWith('ticket_') || customId.includes('close')) {
            return await handleTicketInteractions(interaction);
        }

        // Sistema de Despachos de Facciones
        if (customId.startsWith('apr_desp_') || customId.startsWith('den_desp_')) {
            return await client.prefixInteractions.get('despacho')?.handleButtons(interaction);
        }

        // Tiendas e Intercambios
        if (customId === 'comprar_tienda') return await client.commands.get('tienda')?.handleTiendaInteractions(interaction);
        if (customId === 'comprar_blackmarket') return await client.commands.get('blackmarket')?.handleBlackmarketInteractions(interaction);

        // Handler Dinámico por Prefijo (Soporte para múltiples archivos)
        const prefix = customId.split('_')[0];
        const cmd = client.commands.get(prefix) || client.commands.get(customId);
        if (cmd) {
            if (interaction.isButton() && cmd.handleButtons) return await cmd.handleButtons(interaction);
            if (interaction.isModalSubmit() && cmd.handleModal) return await cmd.handleModal(interaction);
            const genericHandler = `handle${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Interactions`;
            if (cmd[genericHandler]) return await cmd[genericHandler](interaction);
        }

    } catch (error) {
        console.error(`❌ Error Crítico en interacción [ID: ${customId}]:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Se produjo un error interno al procesar esta acción. Contacte con desarrollo.', ephemeral: true }).catch(() => {});
        }
    }
});

// --- 🎭 MANEJADOR DE REACCIONES (AUTO-VOTOS SSU) ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    // Descarga parciales para mensajes antiguos
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('No se pudo obtener la reacción parcial:', error);
            return;
        }
    }

    // Ejecuta la lógica del sistema de apertura si existe el comando
    const aperturaCmd = client.commands.get('apertura');
    if (aperturaCmd && aperturaCmd.handleReactions) {
        await aperturaCmd.handleReactions(reaction, user).catch(console.error);
    }
});

// --- 🏢 SISTEMA DE CANALES DE VOZ (WAITING ROOMS) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member?.user.bot) return;
    
    const despachoCmd = client.prefixInteractions.get('despacho');
    if (despachoCmd && newState.channelId === despachoCmd.salaEsperaId) {
        if (oldState.channelId !== newState.channelId) {
            await despachoCmd.handleWaitingRoom(oldState, newState).catch(console.error);
        }
    }
});

// --- 🛡️ GESTIÓN GLOBAL DE ERRORES Y ESTABILIDAD ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('🛑 Rejection no manejada en:', promise, 'razón:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🛑 Excepción no capturada:', error);
});

// --- 🚀 CONEXIÓN FINAL ---
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log("-----------------------------------------");
    console.log("🔥 ANDA RP INFRASTRUCTURE INICIALIZADA");
    console.log("-----------------------------------------");
});

/**
 * NOTAS DE DESARROLLO (AUDITORÍA):
 * - Se integró 'Partials' para asegurar que el bot detecte reacciones en mensajes antiguos.
 * - Se añadió el disparador 'apertura' en el motor principal de interacciones.
 * - Se corrigieron fallos de 'interaction.deferred' en el manejo de errores.
 * - Capacidad actual: +400 líneas de lógica reactiva.
 */