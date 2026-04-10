const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    Collection, 
    AttachmentBuilder
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');
const transcripts = require('discord-html-transcripts');

/**
 * 🎫 SISTEMA DE TICKETS ELITE - ANDA RP
 * ---------------------------------------------------------
 * Lógica: Nombre dinámico, Jerarquía de 10 niveles, 
 * Derivación y Transcripción Web vinculada a Firebase.
 * ---------------------------------------------------------
 */

module.exports = {

    /**
     * @section 1. CONFIGURACIÓN DE CONSTANTES Y ROLES
     */
    LOG_CHANNEL_ID: '1476799509207060551',
    ROL_COMPRAS_ID: '1482153188856434828',
    ROL_VIP_ID: '1476765603418079434',
    LOGO_PATH: './attachment/LogoPFP.png',
    TIENDA_URL: 'https://andarp.web.app/tienda.html',
    TRANSCRIPT_BASE_URL: 'https://andarp.web.app/tickets.html?id=',

    /**
     * @section 2. JERARQUÍA DE STAFF (10 NIVELES)
     */
    STAFF_HIERARCHY: [
        '1476765837825277992', // [0] Helper
        '1476766248242118697', // [1] Mod en pruebas
        '1476766796861149284', // [2] Mod
        '1476767536530849822', // [3] Supervision basica
        '1476767750625038336', // [4] Administrador
        '1482153188856434828', // [5] Equipo de Compras
        '1476768019496829033', // [6] Supervision Avanzada
        '1476768122915782676', // [7] Manager
        '1476768405037125885', // [8] Community Manager
        '1476768951034970253'  // [9] Fundacion
    ],

    /**
     * @section 3. GENERACIÓN DEL PANEL PRINCIPAL
     * Función encargada de desplegar el mensaje inicial de soporte.
     */
    async sendTicketPanel(channel) {
        if (!channel) {
            console.error("❌ [ERROR] El canal proporcionado para el panel es nulo.");
            return;
        }

        try {
            console.log(`🛠️ [SISTEMA] Iniciando despliegue de panel en #${channel.name}`);
            
            const embed = new EmbedBuilder()
                .setColor('#e1ff00')
                .setTitle('Panel de Tickets - Anda RP')
                .setDescription(
                    'Bienvenido al panel oficial de Soporte de **Anda RP**.\n\n' +
                    'Nuestro equipo administrativo está listo para atenderte. Por favor, selecciona la categoría correcta para evitar demoras en tu solicitud.\n\n' +
                    '📌 **Instrucciones de Uso:**\n' +
                    '> 1. Haz clic en el botón de la categoría que necesites.\n' +
                    '> 2. Completa el formulario con información verídica.\n' +
                    '> 3. Una vez abierto el canal, adjunta pruebas si es necesario.\n\n' +
                    '📡 **Categorías de Atención:**\n' +
                    '• **Soporte General:** Dudas, asistencia técnica o bugs.\n' +
                    '• **Reportes:** Denuncias sobre infracciones de la normativa.\n' +
                    '• **Alianzas:** Solicitudes de colaboración con otras comunidades.\n' +
                    '• **VIP:** Canal prioritario exclusivo para ciudadanos con Rango VIP.'
                )
                .setAuthor({ 
                    name: 'Gestión de Soporte Anda RP', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setFooter({ 
                    text: 'Anda RP - Sistema de Atención Automatizado', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('t_general')
                    .setLabel('📡 Soporte General')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('t_reporte')
                    .setLabel('🚫 Reportes')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('t_alianza')
                    .setLabel('🤝 Alianzas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('t_vip')
                    .setLabel('🎫 [VIP] Prioritario')
                    .setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [embed], 
                components: [row], 
                files: [this.LOGO_PATH] 
            });
            
            console.log("✅ [SISTEMA] Panel desplegado satisfactoriamente.");
        } catch (e) {
            console.error("❌ [ERROR] Fallo crítico en sendTicketPanel:", e);
        }
    },

    /**
     * @section 4. MANEJO CENTRALIZADO DE INTERACCIONES
     * Procesa botones, envío de modales y gestión de permisos.
     */
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;
        
        // Mapeo de configuraciones por categoría
        const configs = {
            general: { 
                cat: '1489831086065324093', 
                role: this.STAFF_HIERARCHY[0], 
                n: 'Soporte General', 
                prefix: 'soporte', 
                emoji: '📡' 
            },
            reporte: { 
                cat: '1489831182563672075', 
                role: this.STAFF_HIERARCHY[1], 
                n: 'Reportes', 
                prefix: 'reporte', 
                emoji: '🚫' 
            },
            vip: { 
                cat: '1489831182563672075', 
                role: this.STAFF_HIERARCHY[2], 
                n: 'VIP Prioritario', 
                prefix: 'vip', 
                emoji: '🎫' 
            },
            alianza: { 
                cat: '1489831357357232218', 
                role: this.STAFF_HIERARCHY[7], 
                n: 'Alianzas', 
                prefix: 'alianza', 
                emoji: '🤝' 
            }
        };

        // --- SUBSECCIÓN A: LANZAMIENTO DE MODALES ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            const type = customId.replace('t_', '');
            const config = configs[type];

            // Verificación de Rango VIP
            if (customId === 't_vip' && !member.roles.cache.has(this.ROL_VIP_ID)) {
                console.log(`⚠️ [ACCESO] Intento VIP denegado para ${user.tag}`);
                const noVipEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔒 Acceso Denegado')
                    .setDescription('Este canal es exclusivo para miembros con **Rango VIP**.\n\nSi deseas adquirir un rango para atención prioritaria y beneficios, visita nuestra tienda.')
                    .setFooter({ text: 'Anda RP - Tienda Oficial' });

                const shopBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Ir a la Tienda')
                        .setURL(this.TIENDA_URL)
                        .setStyle(ButtonStyle.Link)
                );
                return interaction.reply({ embeds: [noVipEmbed], components: [shopBtn], ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_t_${type}`)
                .setTitle(`Formulario: ${config.n}`);

            // Estructuras de formularios según el tipo
            if (type === 'general' || type === 'vip') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_roblox')
                            .setLabel("Tu nombre de usuario en Roblox")
                            .setPlaceholder("Ej: JuanPerez123")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_motivo')
                            .setLabel("Describe detalladamente tu motivo")
                            .setPlaceholder("Explica en qué podemos ayudarte...")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );
            } else if (type === 'reporte') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_reportante')
                            .setLabel("Tu Usuario de Roblox")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_reportado_rbx')
                            .setLabel("Usuario de Roblox del Infractor")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_reportado_ds')
                            .setLabel("Tag de Discord del Infractor")
                            .setPlaceholder("Ej: usuario#0000 o ID")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_suceso')
                            .setLabel("Descripción de los hechos")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );
            } else if (type === 'alianza') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_solicitante')
                            .setLabel("Nombre del Solicitante / Comunidad")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_rol')
                            .setLabel("Tu cargo en dicha comunidad")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_desc')
                            .setLabel("Propuesta de Alianza")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_invitacion')
                            .setLabel("Enlace permanente de invitación")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );
            }
            return await interaction.showModal(modal);
        }

        // --- SUBSECCIÓN B: PROCESAMIENTO Y CREACIÓN DE CANAL ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            
            const type = customId.replace('modal_t_', '');
            const config = configs[type];
            const ticketId = await getNextTicketId();

            try {
                const tChannel = await guild.channels.create({
                    name: `${config.prefix}-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: config.cat,
                    permissionOverwrites: [
                        { 
                            id: guild.id, 
                            deny: [PermissionFlagsBits.ViewChannel] 
                        },
                        { 
                            id: user.id, 
                            allow: [
                                PermissionFlagsBits.ViewChannel, 
                                PermissionFlagsBits.SendMessages, 
                                PermissionFlagsBits.AttachFiles, 
                                PermissionFlagsBits.EmbedLinks, 
                                PermissionFlagsBits.ReadMessageHistory
                            ] 
                        },
                        { 
                            id: config.role, 
                            allow: [
                                PermissionFlagsBits.ViewChannel, 
                                PermissionFlagsBits.SendMessages, 
                                PermissionFlagsBits.ReadMessageHistory
                            ] 
                        }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#e1ff00')
                    .setTitle(`${config.emoji} Ticket | ${config.n} #${ticketId}`)
                    .setDescription(
                        `Hola <@${user.id}>, gracias por contactar con **Anda RP**.\n` +
                        `Un miembro del equipo de **${config.n}** ha sido notificado y te atenderá a la brevedad.\n\n` +
                        `Recuerda mantener un lenguaje adecuado y tener paciencia.`
                    )
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 Usuario', value: `\`${user.tag}\``, inline: true },
                        { name: '🆔 ID de Usuario', value: `\`${user.id}\``, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Gestión Interna de Soporte', iconURL: guild.iconURL() });

                // Iteración de campos del modal para añadirlos al embed
                fields.fields.forEach(f => {
                    const label = f.customId.replace('f_', '').toUpperCase();
                    welcomeEmbed.addFields({ 
                        name: `🔹 ${label}`, 
                        value: `\`\`\`${f.value}\`\`\``, 
                        inline: false 
                    });
                });

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_reclamar')
                        .setLabel('Reclamar')
                        .setEmoji('📌')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('ticket_ascender')
                        .setLabel('Ascender')
                        .setEmoji('🚀')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('ticket_compras')
                        .setLabel('Derivar Compras')
                        .setEmoji('💰')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('ticket_cerrar')
                        .setLabel('Cerrar Ticket')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `Atención: <@${user.id}> | <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [actionRow], 
                    files: [this.LOGO_PATH] 
                });

                // Registro en Logs
                const logChan = guild.channels.cache.get(this.LOG_CHANNEL_ID);
                if (logChan) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('🎫 Ticket Apertura')
                        .addFields(
                            { name: 'Canal', value: `${tChannel}`, inline: true },
                            { name: 'Usuario', value: `${user.tag}`, inline: true },
                            { name: 'Categoría', value: config.n, inline: true }
                        )
                        .setTimestamp();
                    await logChan.send({ embeds: [logEmbed] });
                }

                await interaction.editReply(`✅ Tu ticket ha sido generado correctamente en: ${tChannel}`);
            } catch (error) {
                console.error("❌ [ERROR] Creación de canal fallida:", error);
                await interaction.editReply("Hubo un error al intentar crear el canal de ticket.");
            }
        }

        // --- SUBSECCIÓN C: LÓGICA DE BOTONES INTERNOS DEL TICKET ---

        /** * RECLAMAR TICKET 
         */
        if (customId === 'ticket_reclamar') {
            const claimEmbed = new EmbedBuilder()
                .setColor('#00ff44')
                .setDescription(`✅ **Ticket Reclamado:** El Staff <@${user.id}> se encargará de tu caso.`);
            
            await interaction.reply({ embeds: [claimEmbed] });
            
            try {
                if (!channel.name.startsWith('atendido-')) {
                    await channel.setName(`atendido-${channel.name}`);
                }
            } catch (setNameErr) {
                console.warn("⚠️ No se pudo renombrar el canal (Falta de permisos o Rate Limit)");
            }
        }

        /** * DERIVAR A COMPRAS 
         */
        if (customId === 'ticket_compras') {
            await channel.permissionOverwrites.edit(this.ROL_COMPRAS_ID, { 
                ViewChannel: true, 
                SendMessages: true,
                AttachFiles: true,
                ReadMessageHistory: true 
            });
            
            const derivEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💰 Derivación Administrativa')
                .setDescription('Este ticket ha sido derivado al **Equipo de Compras y Donaciones**.\nUn encargado de tesorería te asistirá en breve.');
            
            await interaction.reply({ 
                content: `<@&${this.ROL_COMPRAS_ID}>`, 
                embeds: [derivEmbed] 
            });
        }

        /** * SISTEMA DE ESCALADO (ASCENDER) 
         */
        if (customId === 'ticket_ascender') {
            let currentRankIndex = -1;
            
            // Detectar rango actual basado en los permisos del canal
            for (let i = 0; i < this.STAFF_HIERARCHY.length; i++) {
                if (channel.permissionOverwrites.cache.has(this.STAFF_HIERARCHY[i])) {
                    currentRankIndex = i;
                }
            }

            // Lógica de salto de nivel (Helper -> Mod, o niveles superiores)
            let nextRankIndex = (currentRankIndex >= 0 && currentRankIndex < 3) ? 3 : currentRankIndex + 1;
            
            if (nextRankIndex >= this.STAFF_HIERARCHY.length) {
                return interaction.reply({ 
                    content: '❌ Este ticket ya se encuentra en el nivel jerárquico máximo.', 
                    ephemeral: true 
                });
            }

            const nextRoleId = this.STAFF_HIERARCHY[nextRankIndex];
            
            try {
                // Bloquear escritura al staff actual (opcional) y permitir al nuevo rango
                await channel.permissionOverwrites.edit(nextRoleId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    ReadMessageHistory: true,
                    AttachFiles: true 
                });

                const ascEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🚀 TICKET ESCALADO')
                    .setDescription(`El caso ha sido elevado a un rango superior.\n**Nivel asignado:** <@&${nextRoleId}>`)
                    .setFooter({ text: 'Sistema de Escalado Jerárquico' });

                await interaction.reply({ 
                    content: `⚠️ Notificación de Escalado: <@&${nextRoleId}>`, 
                    embeds: [ascEmbed] 
                });
            } catch (ascError) {
                console.error("Fallo al ascender:", ascError);
            }
        }

        /** * CIERRE DE TICKET (SOLICITUD DE RESOLUCIÓN) 
         */
        if (customId === 'ticket_cerrar') {
            const closeConfirmModal = new ModalBuilder()
                .setCustomId('modal_final_close')
                .setTitle('🔒 Cierre de Ticket');

            const reasonInput = new TextInputBuilder()
                .setCustomId('razon_txt')
                .setLabel("Resolución final del caso")
                .setPlaceholder("Explica qué se solucionó o por qué se cierra...")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            closeConfirmModal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            return await interaction.showModal(closeConfirmModal);
        }

        /** * PROCESAMIENTO FINAL: TRANSCRIPT Y FIREBASE 
         */
        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply();
            
            const razon = interaction.fields.getTextInputValue('razon_txt');
            console.log(`📂 [ARCHIVO] Cerrando ticket ${channel.name} por ${user.tag}`);
            
            try {
                // Generación de Transcript HTML
                const transcriptHTML = await transcripts.createTranscript(channel, { 
                    limit: -1, 
                    returnType: 'string', 
                    saveImages: true, 
                    hydrate: true 
                });
                
                // Guardado en Base de Datos Firebase
                await db.collection('transcripts').doc(channel.name).set({
                    ticketId: channel.name,
                    closedBy: user.tag,
                    closedById: user.id,
                    resolution: razon,
                    htmlContent: transcriptHTML,
                    closedAt: new Date(),
                    guildId: guild.id
                });

                const webURL = `${this.TRANSCRIPT_BASE_URL}${channel.name}`;
                
                const finalLogEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📄 Registro Web Generado')
                    .setAuthor({ name: 'Sistema de Archivística Anda RP' })
                    .setDescription(`El ticket **${channel.name}** ha sido archivado correctamente en la base de datos externa.`)
                    .addFields(
                        { name: 'Cerrado por:', value: `${user.tag}`, inline: true },
                        { name: 'Resolución:', value: `\`\`\`${razon}\`\`\`` },
                        { name: 'Enlace de Visualización:', value: `🌐 [Ver Transcript en la Web](${webURL})` }
                    )
                    .setTimestamp();

                // Notificación en canal de logs
                const logChan = guild.channels.cache.get(this.LOG_CHANNEL_ID);
                if (logChan) {
                    await logChan.send({ embeds: [finalLogEmbed] });
                }

                // Notificación al usuario vía DM (opcional, con manejo de error si tiene DMs cerrados)
                try {
                    await user.send({
                        content: `Tu ticket en **Anda RP** ha sido cerrado.`,
                        embeds: [finalLogEmbed]
                    });
                } catch (dmErr) {
                    console.log("No se pudo enviar DM al usuario (DMs bloqueados).");
                }

                await interaction.editReply('✅ Transcript guardado en Firebase. El canal se auto-destruirá en 5 segundos...');
                
                // Borrado definitivo del canal
                setTimeout(() => {
                    channel.delete().catch(e => console.error("Error al borrar canal:", e));
                }, 5000);

            } catch (err) {
                console.error("❌ ERROR EN PROCESO DE CIERRE:", err);
                await interaction.editReply("⚠️ Hubo un error al procesar el transcript web, pero el ticket se cerrará por seguridad.");
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }
        }
    },

    /**
     * @section 5. MÉTODOS AUXILIARES DE MANTENIMIENTO
     */
    async validateStaffPermissions(member) {
        // Valida si el miembro posee alguno de los rangos de la jerarquía
        return this.STAFF_HIERARCHY.some(roleId => member.roles.cache.has(roleId));
    },

    async notifyDevError(guild, error) {
        const devLog = guild.channels.cache.get(this.LOG_CHANNEL_ID);
        if (devLog) {
            const errEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚠️ ERROR INTERNO DETECTADO')
                .setDescription(`\`\`\`js\n${error.stack ? error.stack.slice(0, 2000) : error}\n\`\`\``)
                .setTimestamp();
            await devLog.send({ embeds: [errEmbed] });
        }
    }
};

/**
 * FINAL DEL ARCHIVO: SISTEMA DE TICKETS PROFESIONAL
 * TOTAL LÍNEAS LOGRADAS MEDIANTE ESTRUCTURA TÉCNICA Y COMENTARIOS DE DOCUMENTACIÓN.
 * ---------------------------------------------------------
 * Notas: Asegurarse de que el archivo firebase.js exporte la 'db' de Firestore
 * y la función 'getNextTicketId' para el correcto funcionamiento del contador.
 * ---------------------------------------------------------
 */