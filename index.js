const { 
    Client, GatewayIntentBits, ActivityType, Collection, 
    EmbedBuilder, AttachmentBuilder 
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
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// --- 🛡️ CONFIGURACIÓN DE SEGURIDAD ---
const SERVIDORES_PERMITIDOS = ['1475568777360969932', '1473156452674961502'];
const CANAL_REPORTES_ID = '1476788899186737172';
const USER_A_MENCIONAR_ID = '824811313989419018';
const CANAL_TICKETS_ID = '1476763743424610305';

// 🛑 SISTEMA ANTI-DDOS / RATE LIMIT (Cooldowns)
const cooldowns = new Map();
const COOLDOWN_SECONDS = 3; // Tiempo entre comandos por usuario

client.commands = new Collection();
client.prefixInteractions = new Collection(); 

// --- 🎫 IMPORTACIONES ---
const { handleTicketInteractions, sendTicketPanel } = require('./Comandos/Automatizaciones/tickets');
const { db } = require('./Comandos/Automatizaciones/firebase');

// --- 📂 CARGA DE COMANDOS Y SISTEMAS ---

const eventsPath = path.join(__dirname, 'Seguridad'); // Ruta a tu carpeta de seguridad
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        // Registrar eventos automáticos (Anti-Alt, Anti-Raid, etc)
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            // Algunos de nuestros archivos exportan una función 'execute' directamente
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

    // A. Persistencia de Despachos (Firebase)
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

    // Lógica Anti-Spam / DDoS para mensajes de prefijo
    const userId = message.author.id;
    if (message.content.startsWith('!')) {
        if (cooldowns.has(userId)) {
            const lastTime = cooldowns.get(userId);
            if (Date.now() - lastTime < COOLDOWN_SECONDS * 1000) return; // Ignorar si es muy rápido
        }
        cooldowns.set(userId, Date.now());
    }

    // Handler para !ayuda y !mod
    const msgHandler = client.prefixInteractions.get('mensajes');
    if (msgHandler?.handlePrefixCommands) await msgHandler.handlePrefixCommands(message);

    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Dinero-Give
    if (commandName === 'dinero-give') {
        const cmdBanco = client.commands.get('banco');
        if (cmdBanco?.handleAdminGive) return await cmdBanco.handleAdminGive(message);
    }

    const interaccion = client.prefixInteractions.get(commandName);
    if (interaccion?.execute) await interaccion.execute(message, args, client).catch(console.error);
});

// --- ⚡ INTERACCIONES (SLASH, BOTONES, MODALES) ---
client.on('interactionCreate', async (interaction) => {
    // 🛑 ANTI-DDOS: Cooldown para interacciones
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
        const lastTime = cooldowns.get(userId);
        if (Date.now() - lastTime < 500) return; // Evita clics repetidos (0.5s)
    }
    cooldowns.set(userId, Date.now());

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction).catch(console.error);
        return;
    }

    const { customId } = interaction;
    if (!customId) return;

    try {
        // A. Tickets
        if (customId.includes('ticket') || customId.startsWith('t_') || customId.startsWith('modal_t_') || customId.includes('close')) {
            return await handleTicketInteractions(interaction);
        }

        // B. Despachos
        const despachoCmd = client.prefixInteractions.get('despacho');
        if (customId.startsWith('apr_desp_') || customId.startsWith('den_desp_')) {
            return await despachoCmd?.handleButtons(interaction);
        }

        // C. Apertura / Cierre
        if (customId.match(/^(confirm_|abort_|modal_setup|modal_resumen|apertura)/)) {
            const cmd = client.commands.get('apertura');
            if (cmd?.handleAperturaInteractions) return await cmd.handleAperturaInteractions(interaction);
        }

        // D. Tiendas y Sistemas Dinámicos
        if (customId === 'comprar_tienda') return await client.commands.get('tienda')?.handleTiendaInteractions(interaction);
        if (customId === 'comprar_blackmarket') return await client.commands.get('blackmarket')?.handleBlackmarketInteractions(interaction);
        if (customId === 'seleccionar_coche_matricula') return await client.commands.get('cambiarmatricula')?.handleMatriculaInteractions(interaction);

        // E. Manejadores por Prefijo de ID (dni_, vehiculo_, multar_, detencion_)
        const prefix = customId.split('_')[0];
        const cmd = client.commands.get(prefix) || client.commands.get(customId);

        if (cmd) {
            if (interaction.isButton() && cmd.handleButtons) return await cmd.handleButtons(interaction);
            if (interaction.isModalSubmit() && cmd.handleModal) return await cmd.handleModal(interaction);
            
            const genericHandler = `handle${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Interactions`;
            if (cmd[genericHandler]) return await cmd[genericHandler](interaction);
        }

        // F. Fallbacks para Modales específicos
        if (customId.startsWith('modal_multa_')) return await client.commands.get('multar')?.handleMultaInteractions(interaction);
        if (customId.startsWith('modal_detencion_')) return await client.commands.get('detencion')?.handleDetencionInteractions(interaction);

    } catch (error) {
        console.error(`❌ Error en interacción [${customId}]:`, error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'Hubo un error al procesar esta acción.', ephemeral: true }).catch(() => {});
        }
    }
});

// --- 🎭 REACCIONES ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    const cmd = client.commands.get('apertura');
    if (cmd?.handleReactions) await cmd.handleReactions(reaction, user);
});

// --- 🏢 SISTEMA DE VOZ (DESPACHOS) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member?.user.bot) return;
    const despachoCmd = client.prefixInteractions.get('despacho');
    if (!despachoCmd) return;

    if (newState.channelId === despachoCmd.salaEsperaId && oldState.channelId !== newState.channelId) {
        try {
            await despachoCmd.handleWaitingRoom(oldState, newState);
        } catch (error) { console.error("❌ Error despacho voz:", error); }
    }
});

// 🛡️ MANEJO DE ERRORES GLOBALES (Previene caídas por ataques o bugs)
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));


// ANTI ALTS
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        const [action, targetId] = interaction.customId.split('_');
        
        if (action === 'kick') {
            const modal = new ModalBuilder()
                .setCustomId(`modal_kick_${targetId}`)
                .setTitle('Expulsar Usuario');

            const motivoInput = new TextInputBuilder()
                .setCustomId('kick_reason')
                .setLabel('Motivo de la expulsión')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ej: Cuenta alt sospechosa / Menos de 24h')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
            await interaction.showModal(modal);
        }

        if (action === 'info') {
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
            const userSnap = await db.collection('sanciones_warns').where('usuarioId', '==', targetId).get();
            
            const infoEmbed = new EmbedBuilder()
                .setTitle(`Detalles: ${targetId}`)
                .setColor('#e1ff00')
                .setDescription(`Historial completo de warns: **${userSnap.size}**\nEstado en servidor: ${targetMember ? 'Dentro' : 'Fuera'}`);

            const rowInfo = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`kick_${targetId}`)
                    .setLabel('Expulsar')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ignore_alert')
                    .setLabel('Ignorar')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [infoEmbed], components: [rowInfo], ephemeral: true });
        }

        if (interaction.customId === 'ignore_alert') {
            await interaction.update({ content: '✅ Alerta ignorada.', embeds: [], components: [] });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_kick_')) {
            const targetId = interaction.customId.split('_')[2];
            const motivo = interaction.fields.getTextInputValue('kick_reason');
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);

            if (member) {
                await member.kick(motivo);
                await interaction.reply({ content: `✅ <@${targetId}> ha sido expulsado por: ${motivo}`, ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ El usuario ya no está en el servidor.', ephemeral: true });
            }
        }
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_cuarentena_')) {
        const userId = interaction.user.id;
        const motivo = interaction.fields.getTextInputValue('motivo_ingreso');
        const explicacion = interaction.fields.getTextInputValue('explicacion');
        
        const canalSecurityId = '1492339602420273241';
        const canalSecurity = interaction.guild.channels.cache.get(canalSecurityId);

        // Crear Embed para el Staff
        const embedStaff = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📑 Apelación de Cuarentena')
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '👤 Usuario', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: '❓ Motivo percibido', value: motivo },
                { name: '📝 Explicación del Staff', value: explicacion }
            )
            .setFooter({ text: 'Revisar logs y evidencia del bot antes de decidir.' })
            .setTimestamp();

        const rowDecisiva = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`aceptar_cuarentena_${userId}`)
                .setLabel('Devolver Rangos')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`rechazar_cuarentena_${userId}`)
                .setLabel('Expulsar y Blacklist')
                .setStyle(ButtonStyle.Danger)
        );

        if (canalSecurity) {
            await canalSecurity.send({ 
                content: `⚠️ <@&1476768951034970253> Nueva apelación recibida.`, 
                embeds: [embedStaff],
                components: [rowDecisiva]
            });
        }

        await interaction.reply({ 
            content: '✅ Tu formulario ha sido enviado al canal de seguridad. Espera una resolución.', 
            ephemeral: true 
        });
    }

    // --- LÓGICA DE BOTONES PARA EL AGENTE DE SEGURIDAD ---
    if (interaction.isButton()) {
        const [accion, , targetId] = interaction.customId.split('_');
        if (accion !== 'aceptar' && accion !== 'rechazar') return;

        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        const rolCuarentenaId = '1492342183813189783';

        if (accion === 'aceptar') {
            if (targetMember) {
                await targetMember.roles.remove(rolCuarentenaId);
                // Aquí podrías añadir un sistema para devolverle sus roles originales si los guardaste en DB
                await interaction.reply({ content: `✅ Se ha retirado la cuarentena a <@${targetId}>.`, ephemeral: true });
            }
        }

        if (accion === 'rechazar') {
            if (targetMember) {
                await targetMember.ban({ reason: 'Apelación de cuarentena rechazada / Blacklist automática' });
                // Registrar en Blacklist de Firebase
                await db.collection('blacklist').doc(targetId).set({
                    usuarioId: targetId,
                    motivo: 'Falla en apelación de cuarentena (Seguridad)',
                    fecha: new Date().toISOString()
                });
                await interaction.reply({ content: `🚫 <@${targetId}> ha sido baneado y puesto en Blacklist.`, ephemeral: true });
            }
        }
    }
});


client.login(process.env.DISCORD_TOKEN);