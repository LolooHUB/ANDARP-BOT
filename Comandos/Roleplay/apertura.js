const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits,
    AttachmentBuilder,
    Events
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');
const path = require('path');

/**
 * 🚀 SISTEMA INTEGRAL DE APERTURAS Y SSU (SUPER SESIÓN UNITARIA)
 * -------------------------------------------------------------
 * Versión Final Optimizada - Anda RP.
 * Solución al problema de latencia (pensando...) mediante Deferred Responses.
 */

// --- ⚙️ CONFIGURACIÓN DE CANALES Y CONSTANTES ---
const CANAL_ESTADO_ID = '1493197563934019685';
const CANAL_CODIGO_ID = '1493197387081191434';
const CANAL_SESIONES_ID = '1489830006979956787';
const CANAL_LOGS_ID = '1482565635715109015';
const CODIGO_SERVER = 'TwjxC';

// --- 🎨 EMOJIS PERSONALIZADOS ---
const EMOJI_RELOJ = '<:Reloj:1493238390336917637>';
const EMOJI_ABIERTO = '<:Abierto2:1493238594259779604>';
const EMOJI_CERRADO = '<:Cerrado2:1493238535270957116>';

// --- 🛡️ ROLES DE STAFF AUTORIZADOS ---
const ROLES_STAFF = [
    '1476768122915782676',
    '1476768019496829033',
    '1476767750625038336',
    '1476767536530849822'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Sistema integral de gestión de sesiones y control de canales de estado.'),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { member, guild, user } = interaction;

        // --- 1. VALIDACIÓN DE JERARQUÍA ---
        const tienePermiso = member.roles.cache.some(role => ROLES_STAFF.includes(role.id));
        if (!tienePermiso) {
            return interaction.reply({
                content: '❌ **ACCESO DENEGADO:** No cuentas con la jerarquía administrativa necesaria.',
                ephemeral: true
            });
        }

        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            const data = stateDoc.exists ? stateDoc.data() : { open: false, voting: false };

            // --- 2. GESTIÓN DE ESTADOS (VOTACIÓN ACTIVA) ---
            if (data.voting) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_bypass_vote').setLabel('Forzar SSU (Bypass)').setStyle(ButtonStyle.Success).setEmoji('⚡'),
                    new ButtonBuilder().setCustomId('confirm_cancel_vote').setLabel('Anular Votación').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Volver').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: `${EMOJI_RELOJ} **SISTEMA EN ESPERA:** Existe una convocatoria activa. ¿Qué acción deseas realizar?`,
                    components: [row],
                    ephemeral: true
                });
            }

            // --- 3. GESTIÓN DE ESTADOS (SERVIDOR YA ABIERTO) ---
            if (data.open) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_open_modal_cierre').setLabel('Finalizar Sesión').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Mantener Abierto').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: `${EMOJI_ABIERTO} **ESTADO ACTUAL: ABIERTO.** El servidor ya se encuentra operativo. ¿Proceder al cierre?`,
                    components: [row],
                    ephemeral: true
                });
            }

            // --- 4. FORMULARIO DE APERTURA (MODAL) ---
            const modal = new ModalBuilder().setCustomId('modal_setup_rol').setTitle('Configuración de Nueva Sesión');
            
            const inputHora = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('hora_rol')
                    .setLabel("⏰ Hora de Inicio Programada")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ej: 22:30 ESP / 18:30 ARG")
                    .setRequired(true)
            );

            const inputVotos = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('min_gente')
                    .setLabel("👥 Votos Mínimos Requeridos")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Cantidad necesaria (Ej: 15)")
                    .setMaxLength(2)
                    .setRequired(true)
            );

            modal.addComponents(inputHora, inputVotos);
            await interaction.showModal(modal);

        } catch (error) {
            console.error("❌ ERROR EN APERTURA_EXECUTE:", error);
            await this.registrarError(guild, "Comando Ejecutar", error);
        }
    },

    /**
     * @param {import('discord.js').Interaction} interaction 
     */
    async handleAperturaInteractions(interaction) {
        const { customId, fields, guild, user } = interaction;
        const docRef = db.collection('server_state').doc('current');
        
        const canalEstado = guild.channels.cache.get(CANAL_ESTADO_ID);
        const canalCodigo = guild.channels.cache.get(CANAL_CODIGO_ID);
        const canalSesiones = guild.channels.cache.get(CANAL_SESIONES_ID);
        const canalLogs = guild.channels.cache.get(CANAL_LOGS_ID);

        // --- ACCIONES DE RESPUESTA INMEDIATA PARA EVITAR TIMEOUT ---

        if (customId === 'abort_action') {
            return interaction.update({ content: '✅ Operación cancelada por el usuario.', components: [], ephemeral: true });
        }

        // --- BYPASS: FORZAR APERTURA ---
        if (customId === 'confirm_bypass_vote') {
            // Se usa deferUpdate para que Discord sepa que el bot está procesando
            await interaction.deferUpdate(); 
            const stateDoc = await docRef.get();
            const stateData = stateDoc.data();
            
            const msgVotacion = await canalSesiones.messages.fetch(stateData.messageId).catch(() => null);
            await this.activarServidor(guild, user, "Staff Bypass (Forzado)", docRef, msgVotacion);
            return; 
        }

        // --- ANULAR VOTACIÓN ---
        if (customId === 'confirm_cancel_vote') {
            await interaction.deferUpdate();
            await docRef.update({ voting: false, messageId: null, current_votes: 0 });
            if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ❌`).catch(() => {});
            if (canalCodigo) await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
            
            await interaction.editReply({ content: `${EMOJI_CERRADO} **Votación anulada.** Canales restablecidos.`, components: [] });
            return;
        }

        // --- MODAL SETUP ROL (PUBLICAR) ---
        if (customId === 'modal_setup_rol') {
            await interaction.deferReply({ ephemeral: true });

            const hora = fields.getTextInputValue('hora_rol');
            const minGente = parseInt(fields.getTextInputValue('min_gente'));

            if (isNaN(minGente)) return interaction.editReply({ content: "❌ Error: La meta de votos debe ser un número." });

            const bannerVotacion = new AttachmentBuilder('./attachments/BannerVotacionAbierta.png');
            const embedVotacion = new EmbedBuilder()
                .setTitle(`${EMOJI_RELOJ} CONVOCATORIA DE DISPONIBILIDAD`)
                .setDescription(`Se ha propuesto una nueva sesión de rol para Anda RP.\n\n**Detalles Técnicos:**\n⏰ Hora: **${hora}**\n👥 Requisito: **${minGente} votos ✅**\n\n*Al votar positivamente, te comprometes a participar en la sesión.*`)
                .setImage('attachment://BannerVotacionAbierta.png')
                .setColor(0xF1C40F)
                .setFooter({ text: "Sistema de Apertura Automática | Anda RP 2026", iconURL: guild.iconURL() });

            const msg = await canalSesiones.send({ content: "@everyone", embeds: [embedVotacion], files: [bannerVotacion] });
            await msg.react('✅'); await msg.react('❌');

            await docRef.set({
                open: false,
                voting: true,
                target_votes: minGente,
                messageId: msg.id,
                host: user.id,
                hora_propuesta: hora,
                timestamp: Date.now()
            });

            if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : 🔰`);
            if (canalCodigo) await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });

            return interaction.editReply({ content: `✅ Votación publicada en <#${CANAL_SESIONES_ID}>.` });
        }

        // --- MODAL RESUMEN CIERRE ---
        if (customId === 'confirm_open_modal_cierre') {
            const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('Resumen de Finalización');
            modalCierre.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('resumen_final').setLabel("📝 Resumen de la sesión").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10)
            ));
            return await interaction.showModal(modalCierre);
        }

        if (customId === 'modal_resumen_cierre') {
            await interaction.deferReply({ ephemeral: true });
            const resumen = fields.getTextInputValue('resumen_final');
            const horaCierre = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

            await docRef.set({ open: false, voting: false, messageId: null, current_votes: 0 });

            if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : Cerrado`);
            if (canalCodigo) {
                await canalCodigo.setName('〔🔐〕Codigo : Oculto');
                await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
            }

            const bannerCerrado = new AttachmentBuilder('./attachments/BannerServidorCerrado.png');
            const embedPublico = new EmbedBuilder()
                .setTitle(`${EMOJI_CERRADO} SESIÓN FINALIZADA`)
                .setDescription("El servidor ha cerrado sus puertas. Gracias por participar en Anda RP.")
                .setImage('attachment://BannerServidorCerrado.png')
                .setColor(0xE74C3C);

            await canalSesiones.send({ content: "@everyone", embeds: [embedPublico], files: [bannerCerrado] });

            const embedLog = new EmbedBuilder()
                .setTitle("📝 LOG DE ACTIVIDAD ADMINISTRATIVA")
                .addFields(
                    { name: "👤 Responsable", value: `<@${user.id}>`, inline: true },
                    { name: "📅 Fecha/Hora", value: horaCierre, inline: true },
                    { name: "📝 Resumen", value: resumen }
                )
                .setColor(0x2B2D31)
                .setThumbnail(user.displayAvatarURL());

            if (canalLogs) await canalLogs.send({ embeds: [embedLog] });

            return interaction.editReply({ content: "✅ Sesión finalizada y logs archivados correctamente." });
        }
    },

    /**
     * FUNCIÓN CENTRAL DE ACTIVACIÓN DE SERVIDOR
     */
    async activarServidor(guild, hostUser, metodo, docRef, msgVotacion = null) {
        let usuariosObligados = [];
        
        // --- 1. RASTREO DE VOTANTES ---
        if (msgVotacion) {
            try {
                const reaction = msgVotacion.reactions.cache.get('✅');
                if (reaction) {
                    const reactUsers = await reaction.users.fetch();
                    usuariosObligados = reactUsers.filter(u => !u.bot).map(u => `<@${u.id}>`);
                }
            } catch (err) { console.error("Error al obtener votantes:", err); }
        }

        await docRef.update({ open: true, voting: false });

        const canalEstado = guild.channels.cache.get(CANAL_ESTADO_ID);
        const canalCodigo = guild.channels.cache.get(CANAL_CODIGO_ID);
        const canalSesiones = guild.channels.cache.get(CANAL_SESIONES_ID);

        // Actualizar nombres y permisos
        if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ✅`).catch(console.error);
        if (canalCodigo) {
            await canalCodigo.setName(`〔🔐〕Codigo : ${CODIGO_SERVER}`).catch(console.error);
            await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }).catch(console.error);
        }

        const bannerAbierto = new AttachmentBuilder('./attachments/BannerServidorAbierto.png');
        const embedAbierto = new EmbedBuilder()
            .setTitle(`${EMOJI_ABIERTO} ¡SERVIDOR ABIERTO!`)
            .setDescription(`La sesión ha iniciado oficialmente. Prepárate para el rol.\n\n**Acceso Directo:**\n🔑 Código: \`${CODIGO_SERVER}\`\n👤 Host: <@${hostUser.id || hostUser}>\n🛠️ Método: **${metodo}**`)
            .setImage('attachment://BannerServidorAbierto.png')
            .setColor(0x2ECC71)
            .setFooter({ text: "Anda RP | Compromiso con la simulación" });

        await canalSesiones.send({ content: "@everyone", embeds: [embedAbierto], files: [bannerAbierto] });

        // --- 2. NOTIFICACIÓN DE OBLIGATORIEDAD Y PINGS ---
        if (usuariosObligados.length > 0) {
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("⚠️ AVISO DE INCORPORACIÓN OBLIGATORIA")
                .setDescription(`Los siguientes usuarios votaron positivamente y deben unirse de inmediato para evitar sanciones administrativas:\n\n${usuariosObligados.join(', ')}`)
                .setFooter({ text: "El incumplimiento será reportado a Administración." });

            await canalSesiones.send({ 
                content: `🚨 **ATENCIÓN:** ${usuariosObligados.join(' ')} deberán unirse a menos que quieran afrontar sanciones.`, 
                embeds: [warningEmbed] 
            });
        }
    },

    /**
     * MANEJADOR DE REACCIONES AUTOMÁTICO
     */
    async handleReactions(reaction, user) {
        if (user.bot) return;

        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            if (!stateDoc.exists) return;

            const state = stateDoc.data();
            if (!state.voting || reaction.message.id !== state.messageId || reaction.emoji.name !== '✅') return;

            const votosActuales = reaction.count - 1;

            if (votosActuales >= state.target_votes) {
                // Ejecutar apertura automática al llegar a la meta
                await this.activarServidor(reaction.message.guild, state.host, "Votos Alcanzados", docRef, reaction.message);
                
                const embedDM = new EmbedBuilder()
                    .setTitle(`${EMOJI_ABIERTO} ¡SESIÓN INICIADA!`)
                    .setDescription(`El servidor de **Anda RP** ya está abierto.\n🔑 Código: \`${CODIGO_SERVER}\` (Votaste ✅, ¡Corre!)`)
                    .setColor(0x2ECC71);
                
                const usuarios = await reaction.users.fetch();
                usuarios.forEach(u => { if (!u.bot) u.send({ embeds: [embedDM] }).catch(() => {}); });
            }
        } catch (error) {
            console.error("❌ ERROR EN REACCIONES:", error);
        }
    },

    /**
     * SISTEMA DE LOGS DE ERRORES INTERNOS
     */
    async registrarError(guild, modulo, error) {
        const canalLogs = guild.channels.cache.get(CANAL_LOGS_ID);
        if (!canalLogs) return;

        const errorEmbed = new EmbedBuilder()
            .setTitle("⚠️ ERROR CRÍTICO DETECTADO")
            .setColor(0xFF0000)
            .addFields(
                { name: "Módulo", value: modulo, inline: true },
                { name: "Mensaje", value: `\`\`\`${error.message}\`\`\`` }
            )
            .setTimestamp();

        await canalLogs.send({ embeds: [errorEmbed] });
    }
};

/**
 * -------------------------------------------------------------
 * 📊 NOTAS TÉCNICAS (SÓLO PARA DESARROLLADORES)
 * -------------------------------------------------------------
 * - Optimización: Se agregó await interaction.deferUpdate() en Bypass y Cancel.
 * - Optimización: Se agregó await interaction.deferReply() en Setup y Cierre.
 * - Sanciones: El ping a los votantes incluye el texto de advertencia solicitado.
 * -------------------------------------------------------------
 */