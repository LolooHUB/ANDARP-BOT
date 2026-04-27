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
    Collection
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

/**
 * 🚀 SISTEMA INTEGRAL DE APERTURAS - ANDA RP v7.0 (ULTRA EDITION)
 * -------------------------------------------------------------
 * Desarrollado para: Anda RP - Infraestructura de Sesiones.
 * Solución definitiva a latencia y gestión de estados persistentes.
 * -------------------------------------------------------------
 */

// --- ⚙️ CONFIGURACIÓN DE CANALES ---
const CONFIG = {
    CANALES: {
        ESTADO: '1493197563934019685',
        CODIGO: '1493197387081191434',
        SESIONES: '1489830006979956787',
        LOGS: '1482565635715109015',
        AUDITORIA_INTERNA: '1482565635715109015'
    },
    ROLES: {
        STAFF: [
            '1476768122915782676', // Manager
            '1476768019496829033', // Superv. Avanzada
            '1476767750625038336', // Administrador
            '1476767536530849822'  // Superv. Básica
        ],
        EVERYONE: '1476765275811340288' // ID @everyone si es necesario
    },
    SERVER: {
        CODIGO: 'TwjxC',
        NOMBRE: 'Anda RP'
    },
    EMOJIS: {
        RELOJ: '<:Reloj:1493238390336917637>',
        ABIERTO: '<:Abierto2:1493238594259779604>',
        CERRADO: '<:Cerrado2:1493238535270957116>',
        LOADING: '⌛',
        SUCCESS: '✅',
        ERROR: '❌'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Sistema de gestión de sesiones, estados y control de acceso.'),

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
                    new ButtonBuilder().setCustomId('confirm_cancel_vote').setLabel('Anular Todo').setStyle(ButtonStyle.Danger),
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
                
                // Cálculo de tiempo transcurrido si existe el timestamp
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
                    .setPlaceholder("Ej: Se requiere LSPD y EMS prioritario.")
                    .setRequired(false)
            );

            modal.addComponents(inputHora, inputVotos, inputObs);
            await interaction.showModal(modal);

        } catch (error) {
            console.error(">>> [ERROR] CRÍTICO EN EXECUTE:", error);
            await this.registrarError(guild, "Comando Principal", error);
        }
    },

    /**
     * @param {import('discord.js').Interaction} interaction 
     */
    async handleAperturaInteractions(interaction) {
        const { customId, fields, guild, user, member } = interaction;
        const docRef = db.collection('server_state').doc('current');
        
        // Caché de canales
        const canalEstado = guild.channels.cache.get(CONFIG.CANALES.ESTADO);
        const canalCodigo = guild.channels.cache.get(CONFIG.CANALES.CODIGO);
        const canalSesiones = guild.channels.cache.get(CONFIG.CANALES.SESIONES);

        // --- 1. GESTIÓN DE BOTONES ---

        if (customId === 'abort_action') {
            return interaction.update({ content: '✅ Acción cancelada por el operador.', components: [], ephemeral: true });
        }

        // PROTOCOLO BYPASS (SOLUCIÓN LATENCIA: DEFER UPDATE)
        if (customId === 'confirm_bypass_vote') {
            await interaction.deferUpdate(); // Esto quita el "pensando..." de inmediato
            
            try {
                const stateDoc = await docRef.get();
                const stateData = stateDoc.data();
                
                // Obtener mensaje de votación para recolectar reaccionantes
                let msgVotacion = null;
                if (stateData.messageId) {
                    msgVotacion = await canalSesiones.messages.fetch(stateData.messageId).catch(() => null);
                }

                await this.activarServidor(guild, user, "Bypass Administrativo", docRef, msgVotacion);
                await interaction.editReply({ content: '⚡ **BYPASS EJECUTADO:** Infraestructura forzada con éxito.', components: [] });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: '❌ Error en Bypass.' });
            }
            return;
        }

        // PROTOCOLO ANULACIÓN (SOLUCIÓN LATENCIA: DEFER UPDATE)
        if (customId === 'confirm_cancel_vote') {
            await interaction.deferUpdate();
            
            await docRef.update({ 
                voting: false, 
                open: false, 
                messageId: null, 
                current_votes: 0 
            });

            if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ❌`).catch(() => {});
            if (canalCodigo) await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
            
            return await interaction.editReply({ content: `${CONFIG.EMOJIS.CERRADO} **SISTEMA RESTABLECIDO:** Votación purgada.`, components: [] });
        }

        // --- 2. GESTIÓN DE MODALES (RECEPCIÓN DE DATOS) ---

        // PROCESO DE PUBLICAR VOTACIÓN
        if (customId === 'modal_setup_rol') {
            // REGLA DE ORO: DeferReply inmediato para evitar timeout de 3s
            await interaction.deferReply({ ephemeral: true });

            const hora = fields.getTextInputValue('hora_rol');
            const minGente = parseInt(fields.getTextInputValue('min_gente'));
            const obs = fields.getTextInputValue('obs_rol') || "Sin observaciones adicionales.";

            if (isNaN(minGente)) {
                return interaction.editReply({ content: "❌ **ERROR:** La meta de votos debe ser un valor numérico." });
            }

            try {
                const bannerVotacion = new AttachmentBuilder('./attachments/BannerVotacionAbierta.png');
                const embedVotacion = new EmbedBuilder()
                    .setAuthor({ name: 'ANDA RP - SISTEMA DE CONVOCATORIA', iconURL: guild.iconURL() })
                    .setTitle(`${CONFIG.EMOJIS.RELOJ} NUEVA SESIÓN PROPUESTA`)
                    .setDescription(
                        `Se ha iniciado una consulta para verificar la disponibilidad del servidor.\n\n` +
                        `📂 **DETALLES DEL ROL:**\n` +
                        `• Hora programada: **${hora}**\n` +
                        `• Requisito: **${minGente} votos afirmativos**\n` +
                        `• Estado: **Esperando quorum...**\n\n` +
                        `📝 **NOTAS DEL STAFF:**\n*${obs}*\n\n` +
                        `> *Al reaccionar con ✅, confirmas tu asistencia obligatoria.*`
                    )
                    .setImage('attachment://BannerVotacionAbierta.png')
                    .setColor(0xF1C40F)
                    .setFooter({ text: `Iniciado por ${user.username}`, iconURL: user.displayAvatarURL() })
                    .setTimestamp();

                const msg = await canalSesiones.send({ 
                    content: "@everyone", 
                    embeds: [embedVotacion], 
                    files: [bannerVotacion] 
                });
                
                await msg.react('✅');
                await msg.react('❌');

                // Guardar estado en base de datos
                await docRef.set({
                    open: false,
                    voting: true,
                    target_votes: minGente,
                    messageId: msg.id,
                    host: user.id,
                    hora_propuesta: hora,
                    timestamp: Date.now(),
                    observaciones: obs
                });

                // Actualizar visual de canales
                if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : 🔰`).catch(() => {});
                if (canalCodigo) await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});

                return interaction.editReply({ content: `✅ **ÉXITO:** Convocatoria enviada a <#${CONFIG.CANALES.SESIONES}>.` });

            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "❌ Error al publicar la votación." });
            }
        }

        // PROCESO DE CIERRE
        if (customId === 'confirm_open_modal_cierre') {
            const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('Finalización de Sesión');
            modalCierre.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('resumen_final')
                    .setLabel("📝 RESUMEN DE ACTIVIDAD")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Describe lo ocurrido (tiros, robos, situaciones de rol, etc.)")
                    .setRequired(true)
                    .setMinLength(15)
            ));
            return await interaction.showModal(modalCierre);
        }

        if (customId === 'modal_resumen_cierre') {
            await interaction.deferReply({ ephemeral: true });
            
            const resumen = fields.getTextInputValue('resumen_final');
            const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

            try {
                // Limpiar base de datos
                await docRef.set({ 
                    open: false, 
                    voting: false, 
                    messageId: null, 
                    current_votes: 0,
                    timestamp_cierre: Date.now()
                });

                // Restablecer Canales
                if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ❌`).catch(() => {});
                if (canalCodigo) {
                    await canalCodigo.setName('〔🔐〕Codigo : Oculto').catch(() => {});
                    await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
                }

                // Publicar Banner de Cierre
                const bannerCerrado = new AttachmentBuilder('./attachments/BannerServidorCerrado.png');
                const embedPublico = new EmbedBuilder()
                    .setTitle(`${CONFIG.EMOJIS.CERRADO} SESIÓN FINALIZADA`)
                    .setDescription(
                        `El servidor de **Anda RP** ha cerrado sus puertas.\n` +
                        `Esperamos que hayan disfrutado de la sesión.\n\n` +
                        `📅 **Fecha de cierre:** ${fechaActual}`
                    )
                    .setImage('attachment://BannerServidorCerrado.png')
                    .setColor(0xE74C3C)
                    .setFooter({ text: 'Gracias por formar parte de nuestra comunidad.' });

                await canalSesiones.send({ content: "@everyone", embeds: [embedPublico], files: [bannerCerrado] });

                // Log Administrativo
                const embedLog = new EmbedBuilder()
                    .setTitle("📝 REGISTRO DE CIERRE DE SESIÓN")
                    .setColor(0x2B2D31)
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: "👤 Operador", value: `${user.tag} (<@${user.id}>)`, inline: true },
                        { name: "📅 Hora de Registro", value: fechaActual, inline: true },
                        { name: "📋 Resumen Técnico", value: `\`\`\`${resumen}\`\`\`` }
                    )
                    .setTimestamp();

                const canalLogs = guild.channels.cache.get(CONFIG.CANALES.LOGS);
                if (canalLogs) await canalLogs.send({ embeds: [embedLog] });

                return interaction.editReply({ content: "✅ **SISTEMA:** Sesión finalizada y archivada correctamente." });

            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "❌ Error durante el protocolo de cierre." });
            }
        }
    },

    /**
     * LÓGICA DE ACTIVACIÓN DE INFRAESTRUCTURA
     */
    async activarServidor(guild, hostUser, metodo, docRef, msgVotacion = null) {
        let listaVotantes = [];
        
        // 1. RECOLECCIÓN DE DATOS DE REACCIÓN
        if (msgVotacion) {
            try {
                const reaction = msgVotacion.reactions.cache.get('✅');
                if (reaction) {
                    const reactUsers = await reaction.users.fetch();
                    listaVotantes = reactUsers.filter(u => !u.bot).map(u => `<@${u.id}>`);
                }
            } catch (err) { console.error("Error al recolectar votantes:", err); }
        }

        // 2. ACTUALIZAR DB
        await docRef.update({ 
            open: true, 
            voting: false, 
            timestamp_apertura: Date.now(),
            operador_id: hostUser.id 
        });

        const canalEstado = guild.channels.cache.get(CONFIG.CANALES.ESTADO);
        const canalCodigo = guild.channels.cache.get(CONFIG.CANALES.CODIGO);
        const canalSesiones = guild.channels.cache.get(CONFIG.CANALES.SESIONES);

        // 3. DESBLOQUEO DE CANALES
        if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ✅`).catch(() => {});
        if (canalCodigo) {
            await canalCodigo.setName(`〔🔐〕Codigo : ${CONFIG.SERVER.CODIGO}`).catch(() => {});
            await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }).catch(() => {});
        }

        // 4. ANUNCIO DE APERTURA
        const bannerAbierto = new AttachmentBuilder('./attachments/BannerServidorAbierto.png');
        const embedAbierto = new EmbedBuilder()
            .setTitle(`${CONFIG.EMOJIS.ABIERTO} ¡ESTADO: OPERATIVO!`)
            .setDescription(
                `La ciudad de **Anda RP** ha abierto sus fronteras.\n\n` +
                `🔑 **ACCESO:**\n` +
                `Código de Conexión: \`${CONFIG.SERVER.CODIGO}\`\n\n` +
                `🔹 **Host del Rol:** <@${hostUser.id || hostUser}>\n` +
                `🔹 **Método de Entrada:** ${metodo}\n\n` +
                `*Recuerda respetar las normativas de rol y mantener una conducta ejemplar.*`
            )
            .setImage('attachment://BannerServidorAbierto.png')
            .setColor(0x2ECC71)
            .setTimestamp();

        await canalSesiones.send({ 
            content: "@everyone", 
            embeds: [embedAbierto], 
            files: [bannerAbierto] 
        });

        // 5. PINGS Y ADVERTENCIAS
        if (listaVotantes.length > 0) {
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle("🚨 ALERTA DE COMPROMISO")
                .setDescription(
                    `Los siguientes usuarios confirmaron su asistencia y deben incorporarse al servidor en los próximos **10 minutos** para evitar sanciones:\n\n` +
                    `${listaVotantes.join(', ')}`
                );

            await canalSesiones.send({ 
                content: `⚠️ **ATENCIÓN VOTANTES:** ${listaVotantes.join(' ')}`, 
                embeds: [warningEmbed] 
            });
        }
    },

    /**
     * MANEJADOR DINÁMICO DE REACCIONES (AUTO-APERTURA)
     */
    async handleReactions(reaction, user) {
        if (user.bot) return;

        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            if (!stateDoc.exists) return;

            const state = stateDoc.data();
            
            // Verificar si es el mensaje de votación y la reacción correcta
            if (!state.voting || reaction.message.id !== state.messageId || reaction.emoji.name !== '✅') return;

            const conteoReal = reaction.count - 1; // Restar el bot

            // SI SE LLEGA A LA META
            if (conteoReal >= state.target_votes) {
                const guild = reaction.message.guild;
                
                // Evitar doble ejecución por latencia
                await docRef.update({ voting: false }); 
                
                await this.activarServidor(guild, state.host, "Meta de Votos Alcanzada", docRef, reaction.message);
                
                // DM de cortesía a los que votaron
                const usuarios = await reaction.users.fetch();
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`${CONFIG.EMOJIS.ABIERTO} SERVIDOR ABIERTO`)
                    .setDescription(`¡La meta de votos se ha cumplido!\nEl código es: \`${CONFIG.SERVER.CODIGO}\`. ¡Te esperamos!`)
                    .setColor(0x2ECC71);
                
                usuarios.forEach(u => { 
                    if (!u.bot) u.send({ embeds: [dmEmbed] }).catch(() => {}); 
                });
            }
        } catch (error) {
            console.error(">>> [ERROR] EN SISTEMA DE REACCIONES:", error);
        }
    },

    /**
     * REGISTRO TÉCNICO DE ERRORES
     */
    async registrarError(guild, modulo, error) {
        const canalLogs = guild.channels.cache.get(CONFIG.CANALES.LOGS);
        if (!canalLogs) return;

        const errorEmbed = new EmbedBuilder()
            .setTitle("🛑 ERROR EN INFRAESTRUCTURA")
            .setColor(0xFF0000)
            .addFields(
                { name: "Módulo", value: modulo, inline: true },
                { name: "Detalle", value: `\`\`\`js\n${error.message.slice(0, 1000)}\n\`\`\`` }
            )
            .setTimestamp();

        await canalLogs.send({ embeds: [errorEmbed] });
    }
};

/**
 * -------------------------------------------------------------
 * 📚 MANUAL DE OPERACIONES v7.0
 * -------------------------------------------------------------
 * 1. LATENCIA: Se ha integrado 'deferReply' y 'deferUpdate' en todos los puntos 
 * donde el bot interactúa con Firebase o canales, asegurando que Discord 
 * no cierre la sesión por tiempo de espera.
 * 2. SEGURIDAD: Solo los roles definidos en CONFIG.ROLES.STAFF pueden 
 * ejecutar el comando o presionar los botones críticos.
 * 3. PERSISTENCIA: El estado del servidor se guarda en la nube. Si el bot se 
 * reinicia, seguirá sabiendo si el servidor está abierto o en votación.
 * -------------------------------------------------------------
 */