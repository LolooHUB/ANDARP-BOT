const { Client, GatewayIntentBits, ActivityType, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- 🎫 IMPORTACIÓN DE TICKETS ---
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

// --- 🛡️ CONFIGURACIÓN DE SEGURIDAD (LISTA BLANCA) ---
const SERVIDORES_PERMITIDOS = ['1475568777360969932', '1473156452674961502'];
const CANAL_REPORTES_ID = '1476788899186737172';
const USER_A_MENCIONAR_ID = '824811313989419018';

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

    const { db } = require('./Comandos/Automatizaciones/firebase');
    const despachoCmd = client.prefixInteractions.get('despacho');

    setInterval(async () => {
        const ahora = Date.now();
        try {
            const snapshot = await db.collection('despachos_activos').where('expiracion', '<=', ahora).get();
            if (snapshot.empty) return;

            for (const doc of snapshot.docs) {
                const data = doc.id.data();
                const guild = client.guilds.cache.get(data.guildId);
                if (guild && despachoCmd && typeof despachoCmd.finalizarDespacho === 'function') {
                    await despachoCmd.finalizarDespacho(guild, doc.id, data.roleId);
                }
            }
        } catch (e) {
            console.error("❌ Error en revisor de persistencia:", e);
        }
    }, 60000);

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

// --- 🛡️ EVENTO DE SEGURIDAD: INGRESO A NUEVOS SERVIDORES ---
client.on('guildCreate', async (guild) => {
    if (!SERVIDORES_PERMITIDOS.includes(guild.id)) {
        console.log(`🚨 Intento de ingreso no autorizado en: ${guild.name} (${guild.id})`);
        const canalReportes = client.channels.cache.get(CANAL_REPORTES_ID);
        
        if (canalReportes) {
            try {
                const owner = await guild.fetchOwner();
                const membersCount = guild.memberCount;
                const embed = new EmbedBuilder()
                    .setTitle('🚨 INGRESO NO AUTORIZADO DETECTADO')
                    .setColor('#FF0000')
                    .setThumbnail(guild.iconURL({ dynamic: true }))
                    .addFields(
                        { name: '🏰 Servidor', value: `${guild.name}`, inline: true },
                        { name: '🆔 ID', value: `${guild.id}`, inline: true },
                        { name: '👑 Dueño', value: `${owner.user.tag}`, inline: true },
                        { name: '👥 Miembros', value: `${membersCount}`, inline: true }
                    )
                    .setTimestamp();

                await canalReportes.send({ 
                    content: `<@${USER_A_MENCIONAR_ID}> ¡Atención! El bot fue añadido a un servidor no autorizado.`, 
                    embeds: [embed] 
                });
            } catch (err) {
                console.error("Error enviando reporte de seguridad:", err);
            }
        }
        await guild.leave();
    }
});

// --- 💬 MANEJO DE MENSAJES (PREFIX !) ---
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
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msgError).catch(() => {});
            } else {
                await interaction.reply(msgError).catch(() => {});
            }
        }
        return;
    }

    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
        const { customId } = interaction;
        try {
            // --- 🎫 SISTEMA DE TICKETS ---
            if (customId.includes('ticket') || customId.includes('modal_t_') || customId.includes('modal_final_close') || customId.includes('t_')) {
                await handleTicketInteractions(interaction);
                return;
            }

            // --- 🛒 SISTEMAS DE TIENDAS ---
            if (customId === 'comprar_tienda') {
                const cmd = client.commands.get('tienda');
                if (cmd) return await cmd.handleTiendaInteractions(interaction);
            }
            if (customId === 'comprar_blackmarket') {
                const cmd = client.commands.get('blackmarket');
                if (cmd) return await cmd.handleBlackmarketInteractions(interaction);
            }

            // --- 🚗 SISTEMAS DE VEHÍCULOS / MATRÍCULAS ---
            if (customId === 'seleccionar_coche_matricula') {
                const cmd = client.commands.get('cambiarmatricula');
                if (cmd) return await cmd.handleMatriculaInteractions(interaction);
            }
            if (customId.includes('vehiculo') || customId.includes('_veh_') || customId === 'select_tramite_vehiculo' || customId === 'modal_registro_vehiculo') {
                const cmd = client.commands.get('vehiculo');
                if (cmd) {
                    if (customId.includes('_veh_') && interaction.isButton()) return await cmd.handleButtons(interaction);
                    return await cmd.handleVehiculoInteractions(interaction);
                }
            }

            // --- 🪪 DNI Y LICENCIAS ---
            if (customId.includes('dni')) {
                const cmd = client.commands.get('dni');
                if (cmd) return await cmd.handleDNIInteractions(interaction);
            }
            if (customId.includes('licencia') || customId.includes('_lic_')) {
                const cmd = client.commands.get('licencia');
                if (cmd) {
                    if (customId.includes('_lic_')) return await cmd.handleButtons(interaction);
                    return await cmd.handleLicenciaInteractions(interaction);
                }
            }

            // --- 🚀 SISTEMA DE APERTURA (ACTUALIZADO) ---
            if (
                customId.includes('apertura') || 
                customId.includes('confirm_') || 
                customId.includes('abort_') || 
                customId.includes('modal_setup') || 
                customId.includes('modal_resumen')
            ) {
                const cmd = client.commands.get('apertura');
                if (cmd) return await cmd.handleAperturaInteractions(interaction);
            }

            // --- 👮 POLICÍA (MULTAS / DETENCIÓN) ---
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
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) try { await reaction.fetch(); } catch (e) { return; }
    const cmdApertura = client.commands.get('apertura');
    if (cmdApertura && cmdApertura.handleReactions) {
        await cmdApertura.handleReactions(reaction, user);
    }
});

client.login(process.env.DISCORD_TOKEN);