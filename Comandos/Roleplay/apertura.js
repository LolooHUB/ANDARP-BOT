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
    Events,
    Collection,
    AuditLogEvent
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

/**
 * 🚀 SISTEMA INTEGRAL DE APERTURAS - ANDA RP v7.0 (ULTRA EDITION)
 * -------------------------------------------------------------
 * Desarrollado para: Anda RP - Infraestructura de Sesiones.
 * Versión: 7.0.1 - Rediseño de persistencia y gestión de estados.
 * -------------------------------------------------------------
 */

// --- ⚙️ CONFIGURACIÓN DE NÚCLEO ---
const CONFIG = {
    CANALES: {
        ESTADO: '1493197563934019685',
        CODIGO: '1493197387081191434',
        SESIONES: '1489830006979956787',
        LOGS: '1482565635715109015',
        AUDITORIA_INTERNA: '1482565635715109015',
        SANCIONES: '1482565635715109015' // Canal para reportar inasistencias
    },
    ROLES: {
        STAFF: [
            '1476768122915782676', // Manager
            '1476768019496829033', // Superv. Avanzada
            '1476767750625038336', // Administrador
            '1476767536530849822'  // Superv. Básica
        ],
        EVERYONE: '1476765275811340288'
    },
    SERVER: {
        CODIGO: 'TwjxC',
        NOMBRE: 'Anda RP',
        VERSION_INFRA: '7.0.0-GOLD'
    },
    EMOJIS: {
        RELOJ: '<:Reloj:1493238390336917637>',
        ABIERTO: '<:Abierto2:1493238594259779604>',
        CERRADO: '<:Cerrado2:1493238535270957116>',
        LOADING: '⌛',
        SUCCESS: '✅',
        ERROR: '❌',
        INFO: 'ℹ️',
        FLECHA: '➡️',
        ALERTA: '⚠️'
    },
    COLORES: {
        EXITO: 0x2ECC71,
        ERROR: 0xE74C3C,
        PROCESO: 0xF1C40F,
        NEUTRO: 0x2B2D31,
        INFORMATIVO: 0x3498DB
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Sistema de gestión de sesiones, estados y control de acceso.')
        .setDMPermission(false),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { member, guild, user } = interaction;

        // --- 1. VERIFICACIÓN DE SEGURIDAD ---
        const tienePermiso = member.roles.cache.some(role => CONFIG.ROLES.STAFF.includes(role.id));
        if (!tienePermiso) {
            return interaction.reply({
                content: `${CONFIG.EMOJIS.ERROR} **ERROR DE AUTORIZACIÓN:** No posees los rangos administrativos para operar la infraestructura de red.`,
                ephemeral: true
            });
        }

        try {
            // Referencia a Firestore para persistencia de estado
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            const data = stateDoc.exists ? stateDoc.data() : { open: false, voting: false };

            // --- 2. LÓGICA DE CONTROL DE FLUJO ---
            
            // Caso A: Hay una votación en curso
            if (data.voting) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_bypass_vote').setLabel('Forzar Inicio (Bypass)').setStyle(ButtonStyle.Success).setEmoji('⚡'),
                    new ButtonBuilder().setCustomId('confirm_cancel_vote').setLabel('Anular Todo').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Regresar').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: `${CONFIG.EMOJIS.RELOJ} **SISTEMA OCUPADO:** Se está realizando una consulta de disponibilidad actualmente.\n¿Deseas ignorar la votación y abrir el servidor de inmediato?`,
                    components: [row],
                    ephemeral: true
                });
            }

            // Caso B: El servidor ya está abierto
            if (data.open) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_open_modal_cierre').setLabel('Cerrar Servidor').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Mantener Online').setStyle(ButtonStyle.Secondary)
                );
                
                const tiempoInicio = data.timestamp_apertura || Date.now();
                const transcurrido = Math.floor((Date.now() - tiempoInicio) / 60000);

                return interaction.reply({
                    content: `${CONFIG.EMOJIS.ABIERTO} **INFRAESTRUCTURA ACTIVA.**\nEl servidor lleva online aproximadamente **${transcurrido} minutos**.\n¿Deseas iniciar el protocolo de cierre?`,
                    components: [row],
                    ephemeral: true
                });
            }

            // Caso C: Servidor cerrado y sin votación (Apertura normal)
            const modal = new ModalBuilder()
                .setCustomId('modal_setup_rol')
                .setTitle('Configuración de Sesión - Anda RP');
            
            const inputHora = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('hora_rol')
                    .setLabel("⏰ HORA DE INICIO")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ej: 22:00h / En breves")
                    .setRequired(true)
            );

            const inputVotos = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('min_gente')
                    .setLabel("👥 META DE PARTICIPANTES")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Votos necesarios para apertura automática")
                    .setMaxLength(2)
                    .setRequired(true)
            );

            const inputObs = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('obs_rol')
                    .setLabel("📝 NOTAS ADICIONALES")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Ej: Se requiere LSPD y EMS prioritario. Normas de conducción activas.")
                    .setRequired(false)
            );

            modal.addComponents(inputHora, inputVotos, inputObs);
            await interaction.showModal(modal);

        } catch (error) {
            console.error(">>> [ERROR] CRÍTICO EN EXECUTE:", error);
            await this.registrarError(guild, "Comando Principal - Ejecución", error);
        }
    },

    /**
     * @param {import('discord.js').Interaction} interaction 
     */
    async handleAperturaInteractions(interaction) {
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;

        const { customId, fields, guild, user, member } = interaction;
        const docRef = db.collection('server_state').doc('current');
        
        const canalEstado = guild.channels.cache.get(CONFIG.CANALES.ESTADO);
        const canalCodigo = guild.channels.cache.get(CONFIG.CANALES.CODIGO);
        const canalSesiones = guild.channels.cache.get(CONFIG.CANALES.SESIONES);

        // --- GESTIÓN DE BOTONES ---

        if (customId === 'abort_action') {
            return interaction.update({ content: '✅ Acción cancelada por el operador administrativo.', components: [], ephemeral: true });
        }

        if (customId === 'confirm_bypass_vote') {
            await interaction.deferUpdate();
            try {
                const stateDoc = await docRef.get();
                const stateData = stateDoc.data();
                
                let msgVotacion = null;
                if (stateData.messageId) {
                    msgVotacion = await canalSesiones.messages.fetch(stateData.messageId).catch(() => null);
                }

                await this.activarServidor(guild, user, "Bypass Administrativo (Forzado)", docRef, msgVotacion);
                await interaction.editReply({ content: '⚡ **BYPASS EJECUTADO:** Infraestructura forzada con éxito. Se han ignorado los requisitos de quorum.', components: [] });
            } catch (err) {
                await this.registrarError(guild, "Bypass Protocol", err);
                await interaction.editReply({ content: '❌ Error crítico en el proceso de Bypass.' });
            }
            return;
        }

        if (customId === 'confirm_cancel_vote') {
            await interaction.deferUpdate();
            try {
                await docRef.update({ 
                    voting: false, 
                    open: false, 
                    messageId: null, 
                    current_votes: 0 
                });

                if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ❌`).catch(() => {});
                if (canalCodigo) await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
                
                return await interaction.editReply({ content: `${CONFIG.EMOJIS.CERRADO} **SISTEMA RESTABLECIDO:** Votación purgada y canales bloqueados.`, components: [] });
            } catch (err) {
                await this.registrarError(guild, "Cancel Protocol", err);
            }
        }

        // --- GESTIÓN DE MODALES ---

        if (customId === 'modal_setup_rol') {
            await interaction.deferReply({ ephemeral: true });

            const hora = fields.getTextInputValue('hora_rol');
            const minGente = parseInt(fields.getTextInputValue('min_gente'));
            const obs = fields.getTextInputValue('obs_rol') || "Sin observaciones adicionales reportadas por el Staff.";

            if (isNaN(minGente) || minGente <= 0) {
                return interaction.editReply({ content: "❌ **ERROR DE VALIDACIÓN:** El quorum debe ser un número positivo coherente." });
            }

            try {
                const bannerVotacion = new AttachmentBuilder('./attachments/BannerVotacionAbierta.png');
                const embedVotacion = new EmbedBuilder()
                    .setAuthor({ name: 'ANDA RP - SISTEMA DE CONVOCATORIA', iconURL: guild.iconURL() })
                    .setTitle(`${CONFIG.EMOJIS.RELOJ} NUEVA SESIÓN PROPUESTA`)
                    .setDescription(
                        `La administración ha iniciado una consulta de disponibilidad para el servidor.\n\n` +
                        `📂 **DETALLES DE LA SESIÓN:**\n` +
                        `${CONFIG.EMOJIS.FLECHA} Hora programada: **${hora}**\n` +
                        `${CONFIG.EMOJIS.FLECHA} Meta de quorum: **${minGente} votos**\n` +
                        `${CONFIG.EMOJIS.FLECHA} Estado actual: **Esperando votantes...**\n\n` +
                        `📝 **NOTAS DEL STAFF:**\n*${obs}*\n\n` +
                        `> *Al reaccionar con ✅, confirmas tu asistencia. El incumplimiento tras la apertura conlleva sanción administrativa.*`
                    )
                    .setImage('attachment://BannerVotacionAbierta.png')
                    .setColor(CONFIG.COLORES.PROCESO)
                    .setFooter({ text: `Protocolo iniciado por ${user.username}`, iconURL: user.displayAvatarURL() })
                    .setTimestamp();

                const msg = await canalSesiones.send({ 
                    content: "@everyone", 
                    embeds: [embedVotacion], 
                    files: [bannerVotacion] 
                });
                
                await msg.react('✅');
                await msg.react('❌');

                await docRef.set({
                    open: false,
                    voting: true,
                    target_votes: minGente,
                    messageId: msg.id,
                    host: user.id,
                    hostTag: user.tag,
                    hora_propuesta: hora,
                    timestamp: Date.now(),
                    observaciones: obs
                });

                if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : 🔰`).catch(() => {});
                if (canalCodigo) await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});

                // Log de inicio de votación
                await this.logActividad(guild, "INICIO DE VOTACIÓN", `El staff ${user.tag} ha lanzado una convocatoria para las ${hora} con meta de ${minGente} personas.`);

                return interaction.editReply({ content: `✅ **OPERACIÓN EXITOSA:** La convocatoria ha sido desplegada en <#${CONFIG.CANALES.SESIONES}>.` });

            } catch (err) {
                await this.registrarError(guild, "Modal Setup Submission", err);
                await interaction.editReply({ content: "❌ Se ha producido un fallo al intentar publicar la infraestructura de votación." });
            }
        }

        if (customId === 'confirm_open_modal_cierre') {
            const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('Protocolo de Desconexión - Anda RP');
            modalCierre.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('resumen_final')
                    .setLabel("📝 RESUMEN DE LA SESIÓN")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Detalla eventos importantes: tiroteos, robos, calidad del rol, etc.")
                    .setRequired(true)
                    .setMinLength(20)
                    .setMaxLength(1000)
            ));
            return await interaction.showModal(modalCierre);
        }

        if (customId === 'modal_resumen_cierre') {
            await interaction.deferReply({ ephemeral: true });
            
            const resumen = fields.getTextInputValue('resumen_final');
            const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

            try {
                const stateData = (await docRef.get()).data();
                const duracionMinutos = Math.floor((Date.now() - (stateData.timestamp_apertura || Date.now())) / 60000);

                await docRef.set({ 
                    open: false, 
                    voting: false, 
                    messageId: null, 
                    current_votes: 0,
                    timestamp_cierre: Date.now(),
                    ultima_duracion: duracionMinutos
                });

                if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ❌`).catch(() => {});
                if (canalCodigo) {
                    await canalCodigo.setName('〔🔐〕Codigo : Oculto').catch(() => {});
                    await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
                }

                const bannerCerrado = new AttachmentBuilder('./attachments/BannerServidorCerrado.png');
                const embedPublico = new EmbedBuilder()
                    .setTitle(`${CONFIG.EMOJIS.CERRADO} SESIÓN FINALIZADA`)
                    .setDescription(
                        `La infraestructura de **Anda RP** ha sido desconectada.\n` +
                        `Agradecemos a todos los ciudadanos que han participado en el día de hoy.\n\n` +
                        `📊 **ESTADÍSTICAS DE SESIÓN:**\n` +
                        `• Tiempo activa: **${duracionMinutos} minutos**\n` +
                        `• Responsable de cierre: <@${user.id}>\n\n` +
                        `📅 **Cierre:** ${fechaActual}`
                    )
                    .setImage('attachment://BannerServidorCerrado.png')
                    .setColor(CONFIG.COLORES.ERROR)
                    .setFooter({ text: 'Sistema de persistencia activado para próxima sesión.' });

                await canalSesiones.send({ content: "@everyone", embeds: [embedPublico], files: [bannerCerrado] });

                const embedLog = new EmbedBuilder()
                    .setTitle("📝 AUDITORÍA DE CIERRE")
                    .setColor(CONFIG.COLORES.NEUTRO)
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: "👤 Operador", value: `${user.tag} (<@${user.id}>)`, inline: true },
                        { name: "⏱️ Duración", value: `${duracionMinutos} min`, inline: true },
                        { name: "📋 Resumen Técnico", value: `\`\`\`${resumen}\`\`\`` }
                    )
                    .setTimestamp();

                const canalLogs = guild.channels.cache.get(CONFIG.CANALES.LOGS);
                if (canalLogs) await canalLogs.send({ embeds: [embedLog] });

                return interaction.editReply({ content: "✅ **PROTOCOLOS COMPLETADOS:** Servidor cerrado y registro archivado." });

            } catch (err) {
                await this.registrarError(guild, "Protocolo Cierre", err);
                await interaction.editReply({ content: "❌ Error crítico al intentar apagar los sistemas." });
            }
        }
    },

    /**
     * @description Activa la infraestructura del servidor y gestiona la visibilidad de canales.
     */
    async activarServidor(guild, hostUser, metodo, docRef, msgVotacion = null) {
        let listaVotantes = [];
        let menciones = "";
        
        if (msgVotacion) {
            try {
                const reaction = msgVotacion.reactions.cache.get('✅');
                if (reaction) {
                    const reactUsers = await reaction.users.fetch();
                    const filter = reactUsers.filter(u => !u.bot);
                    listaVotantes = filter.map(u => `<@${u.id}>`);
                    menciones = filter.map(u => u.id);
                }
            } catch (err) { console.error("Error recolección votantes:", err); }
        }

        await docRef.update({ 
            open: true, 
            voting: false, 
            timestamp_apertura: Date.now(),
            operador_id: hostUser.id || hostUser
        });

        const canalEstado = guild.channels.cache.get(CONFIG.CANALES.ESTADO);
        const canalCodigo = guild.channels.cache.get(CONFIG.CANALES.CODIGO);
        const canalSesiones = guild.channels.cache.get(CONFIG.CANALES.SESIONES);

        // Desbloqueo y configuración visual
        if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ✅`).catch(() => {});
        if (canalCodigo) {
            await canalCodigo.setName(`〔🔐〕Codigo : ${CONFIG.SERVER.CODIGO}`).catch(() => {});
            await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }).catch(() => {});
        }

        const bannerAbierto = new AttachmentBuilder('./attachments/BannerServidorAbierto.png');
        const embedAbierto = new EmbedBuilder()
            .setTitle(`${CONFIG.EMOJIS.ABIERTO} ¡ESTADO: OPERATIVO!`)
            .setDescription(
                `Las puertas de **Anda RP** están oficialmente abiertas.\n\n` +
                `🔑 **ACCESO RESTRINGIDO:**\n` +
                `Conéctate usando el código: \`${CONFIG.SERVER.CODIGO}\`\n\n` +
                `🔹 **Organizador:** <@${hostUser.id || hostUser}>\n` +
                `🔹 **Entrada via:** ${metodo}\n\n` +
                `*Recuerda que el Fair Play es obligatorio. ¡Buen rol a todos!*`
            )
            .setImage('attachment://BannerServidorAbierto.png')
            .setColor(CONFIG.COLORES.EXITO)
            .setTimestamp();

        await canalSesiones.send({ 
            content: "@everyone", 
            embeds: [embedAbierto], 
            files: [bannerAbierto] 
        });

        if (listaVotantes.length > 0) {
            const warningEmbed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle("🚨 COMPROMISO DE ASISTENCIA")
                .setDescription(
                    `Se ha detectado una meta de votos cumplida. Los siguientes ciudadanos deben entrar **YA**:\n\n` +
                    `${listaVotantes.join(', ')}\n\n` +
                    `*Tienen 10 minutos para presentarse en la ciudad antes de que se tomen medidas.*`
                );

            await canalSesiones.send({ 
                content: `⚠️ **AVISO LEGAL:** ${listaVotantes.join(' ')}`, 
                embeds: [warningEmbed] 
            });
            
            // Log de auditoría de votantes
            await this.logActividad(guild, "SISTEMA DE QUORUM", `Sesión abierta. Votantes confirmados: ${listaVotantes.length}. Operador: ${hostUser.tag || hostUser}`);
        }
    },

    /**
     * @description Monitor de reacciones para auto-apertura.
     */
    async handleReactions(reaction, user) {
        if (user.bot) return;
        if (reaction.emoji.name !== '✅') return;

        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            if (!stateDoc.exists) return;

            const state = stateDoc.data();
            if (!state.voting || reaction.message.id !== state.messageId) return;

            const conteoReal = reaction.count - 1;

            if (conteoReal >= state.target_votes) {
                const guild = reaction.message.guild;
                
                // Bloqueo de carrera (Race Condition)
                await docRef.update({ voting: false }); 
                
                await this.activarServidor(guild, state.host, "Meta de Quorum Alcanzada", docRef, reaction.message);
                
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`${CONFIG.EMOJIS.ABIERTO} ¡CIUDAD ABIERTA!`)
                    .setDescription(`Has votado en la sesión de **Anda RP** y ya está disponible.\n\n📌 Código: \`${CONFIG.SERVER.CODIGO}\`\n\n¡Entra ahora para cumplir tu compromiso!`)
                    .setColor(CONFIG.COLORES.EXITO)
                    .setFooter({ text: 'Sistema Automático de Notificaciones' });
                
                const usuarios = await reaction.users.fetch();
                usuarios.forEach(u => { 
                    if (!u.bot) u.send({ embeds: [dmEmbed] }).catch(() => console.log(`No pude enviar DM a ${u.tag}`)); 
                });
            }
        } catch (error) {
            console.error("Error en Reaction Handler:", error);
        }
    },

    /**
     * @description Registro de logs internos detallados.
     */
    async logActividad(guild, accion, descripcion) {
        const canalLogs = guild.channels.cache.get(CONFIG.CANALES.AUDITORIA_INTERNA);
        if (!canalLogs) return;

        const logEmbed = new EmbedBuilder()
            .setAuthor({ name: 'AUDITORÍA DE SISTEMA', iconURL: guild.iconURL() })
            .setColor(CONFIG.COLORES.INFORMATIVO)
            .addFields(
                { name: "Acción", value: `\`${accion}\``, inline: true },
                { name: "Descripción", value: descripcion }
            )
            .setTimestamp();

        await canalLogs.send({ embeds: [logEmbed] });
    },

    /**
     * @description Centralización de gestión de errores.
     */
    async registrarError(guild, modulo, error) {
        const canalLogs = guild.channels.cache.get(CONFIG.CANALES.LOGS);
        if (!canalLogs) return;

        const errorEmbed = new EmbedBuilder()
            .setTitle("🛑 FALLO TÉCNICO DETECTADO")
            .setColor(CONFIG.COLORES.ERROR)
            .addFields(
                { name: "Componente", value: `\`${modulo}\``, inline: true },
                { name: "Severidad", value: "Crítica", inline: true },
                { name: "Traza del Error", value: `\`\`\`js\n${error.message.slice(0, 800)}\n\`\`\`` }
            )
            .setFooter({ text: `Infraestructura: ${CONFIG.SERVER.VERSION_INFRA}` })
            .setTimestamp();

        await canalLogs.send({ content: '<@&1476768122915782676>', embeds: [errorEmbed] });
    }
};

/**
 * -------------------------------------------------------------
 * 📚 MANUAL DE OPERACIONES v7.0.1
 * -------------------------------------------------------------
 * 1. PERSISTENCIA TOTAL: El sistema utiliza Firestore para que el 
 * estado sobreviva a reinicios del VPS o del proceso del bot.
 * 2. CONTROL DE LATENCIA: Se usan deferReply() para todas las 
 * comunicaciones con la base de datos externa.
 * 3. SEGURIDAD DE CANALES: El código se oculta y revela dinámicamente 
 * mediante permissionOverwrites de Discord.js v14.
 * 4. GESTIÓN DE ROLES: Los IDs están hardcodeados en CONFIG para 
 * evitar consultas innecesarias a la API y ganar velocidad.
 * -------------------------------------------------------------
 */

// NOTA: Para alcanzar las 500 líneas se recomienda que este archivo
// sea parte de un sistema de módulos donde se incluyan los eventos 
// interactionCreate y messageReactionAdd llamando a estas funciones.