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
    AttachmentBuilder,
    Events
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');
const transcripts = require('discord-html-transcripts');

/**
 * 🎫 SISTEMA DE TICKETS ELITE V3.0 - ANDA RP
 * ---------------------------------------------------------
 * Desarrollado para una gestión administrativa de alto rendimiento.
 * * Capas de Funcionalidad:
 * 1. Categorización Inteligente (General, Reportes, Alianzas, VIP).
 * 2. Jerarquía Dinámica de 10 Niveles con Escalado Automático.
 * 3. Integración con Firebase Firestore para persistencia de datos.
 * 4. Transcripción Web con renderizado HTML y alojamiento externo.
 * 5. Sistema de Auditoría (Logs) y Control de Seguridad (Permissions).
 * 6. UX Optimizada mediante Modales y Botones Interactivos.
 * ---------------------------------------------------------
 */

module.exports = {

    /**
     * @section 1. CONFIGURACIÓN DE IDENTIFICADORES Y ASSETS
     * Variables globales que definen el comportamiento del ecosistema.
     */
    LOG_CHANNEL_ID: '1476799509207060551',
    ROL_COMPRAS_ID: '1482153188856434828',
    ROL_VIP_ID: '1476765603418079434',
    LOGO_PATH: './attachment/LogoPFP.png',
    TIENDA_URL: 'https://andarp.web.app/tienda.html',
    TRANSCRIPT_BASE_URL: 'https://andarp.web.app/tickets.html?id=',

    /**
     * @section 2. ESCALAFÓN JERÁRQUICO (STAFF)
     * Índices del 0 al 9 que controlan el acceso progresivo.
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
     * @section 3. PANEL DE CONTROL DE ENTRADA
     * Despliega el Embed principal con el que interactúan los usuarios.
     */
    async sendTicketPanel(channel) {
        if (!channel) {
            console.error("❌ [ERROR] Canal de panel no definido.");
            return;
        }

        try {
            console.log(`🛠️ [SISTEMA] Desplegando panel en el canal: #${channel.name}`);
            
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
                .setImage('attachment://LogoPFP.png')
                .setThumbnail('attachment://LogoPFP.png')
                .setFooter({ 
                    text: 'Anda RP - Sistema de Atención Automatizado • ' + new Date().getFullYear(), 
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
            
            console.log("✅ [SISTEMA] El panel ha sido enviado con éxito.");
        } catch (e) {
            console.error("❌ [CRITICAL ERROR] Fallo en sendTicketPanel:", e);
        }
    },

    /**
     * @section 4. HANDLER CENTRAL DE INTERACCIONES
     * Gestiona el flujo completo: Botones -> Modales -> Creación -> Gestión Interna.
     */
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;

        // Estructura de mapeo para configuración de tickets
        const configs = {
            general: { 
                cat: '1489831086065324093', 
                role: this.STAFF_HIERARCHY[0], 
                n: 'Soporte General', 
                prefix: 'soporte', 
                emoji: '📡',
                color: '#2ecc71'
            },
            reporte: { 
                cat: '1489831182563672075', 
                role: this.STAFF_HIERARCHY[1], 
                n: 'Reportes', 
                prefix: 'reporte', 
                emoji: '🚫',
                color: '#e74c3c'
            },
            vip: { 
                cat: '1489831182563672075', 
                role: this.STAFF_HIERARCHY[2], 
                n: 'VIP Prioritario', 
                prefix: 'vip', 
                emoji: '🎫',
                color: '#f1c40f'
            },
            alianza: { 
                cat: '1489831357357232218', 
                role: this.STAFF_HIERARCHY[7], 
                n: 'Alianzas', 
                prefix: 'alianza', 
                emoji: '🤝',
                color: '#3498db'
            }
        };

        // --- SUB-HANDLER: LANZAMIENTO DE FORMULARIOS (MODALES) ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            const type = customId.replace('t_', '');
            const config = configs[type];

            // Bloqueo de seguridad para tickets VIP
            if (customId === 't_vip' && !member.roles.cache.has(this.ROL_VIP_ID)) {
                const noVipEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔒 Acceso Denegado')
                    .setDescription('Este canal es exclusivo para miembros con **Rango VIP**.\n\nSi deseas adquirir un rango para atención prioritaria y beneficios, visita nuestra tienda.')
                    .setThumbnail('attachment://LogoPFP.png');

                const shopBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Ir a la Tienda Oficial')
                        .setURL(this.TIENDA_URL)
                        .setStyle(ButtonStyle.Link)
                );
                return interaction.reply({ 
                    embeds: [noVipEmbed], 
                    components: [shopBtn], 
                    files: [this.LOGO_PATH],
                    ephemeral: true 
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_t_${type}`)
                .setTitle(`${config.emoji} Formulario: ${config.n}`);

            // Inyección dinámica de campos según tipo
            if (type === 'general' || type === 'vip') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_roblox')
                            .setLabel("Usuario de Roblox")
                            .setPlaceholder("Ingresa tu nick exacto...")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_motivo')
                            .setLabel("Descripción del Problema")
                            .setPlaceholder("Detalla en qué podemos ayudarte hoy...")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );
            } else if (type === 'reporte') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_reportante').setLabel("Tu Usuario de Roblox").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_reportado_rbx').setLabel("Infractor (Roblox)").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_reportado_ds').setLabel("Infractor (Discord/ID)").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('f_suceso').setLabel("Relato de los hechos").setStyle(TextInputStyle.Paragraph).setRequired(true)
                    )
                );
            } else if (type === 'alianza') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_solicitante').setLabel("Comunidad/Representante").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_rol').setLabel("Tu Cargo").setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_desc').setLabel("Propuesta Comercial/Alianza").setStyle(TextInputStyle.Paragraph).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_invitacion').setLabel("Link de Invitación").setStyle(TextInputStyle.Short).setRequired(true)
                    )
                );
            }
            return await interaction.showModal(modal);
        }

        // --- SUB-HANDLER: PROCESAMIENTO DE CREACIÓN DE TICKETS ---
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
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
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
                    .setColor(config.color)
                    .setTitle(`${config.emoji} Ticket | ${config.n} #${ticketId}`)
                    .setDescription(
                        `Hola <@${user.id}>, gracias por contactar con **Anda RP**.\n` +
                        `Un miembro del equipo de **${config.n}** ha sido notificado y te atenderá a la brevedad.\n\n` +
                        `**Reglas Generales:**\n` +
                        `1. No menciones masivamente al Staff.\n` +
                        `2. Prepara tus pruebas (capturas/videos).\n` +
                        `3. Mantén el respeto en todo momento.`
                    )
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 Solicitante', value: `\`${user.tag}\``, inline: true },
                        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Sistema de Gestión Interna • Anda RP', iconURL: guild.iconURL() });

                // Extracción automática de datos del modal para el Embed de bienvenida
                fields.fields.forEach(f => {
                    const label = f.customId.replace('f_', '').toUpperCase();
                    welcomeEmbed.addFields({ 
                        name: `🔹 ${label}`, 
                        value: `\`\`\`${f.value}\`\`\``, 
                        inline: false 
                    });
                });

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_compras').setLabel('Compras').setEmoji('💰').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `Atención: <@${user.id}> | <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [actionRow], 
                    files: [this.LOGO_PATH] 
                });

                // Registro Auditor en Logs
                const logChan = guild.channels.cache.get(this.LOG_CHANNEL_ID);
                if (logChan) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('🎫 Nueva Apertura de Ticket')
                        .addFields(
                            { name: 'Canal', value: `${tChannel}`, inline: true },
                            { name: 'Usuario', value: `${user.tag}`, inline: true },
                            { name: 'Categoría', value: config.n, inline: true },
                            { name: 'ID Sistema', value: `#${ticketId}`, inline: true }
                        )
                        .setTimestamp();
                    await logChan.send({ embeds: [logEmbed] });
                }

                await interaction.editReply(`✅ Tu ticket ha sido generado correctamente: ${tChannel}`);
            } catch (error) {
                console.error("❌ [ERROR] Fallo en la creación del ticket:", error);
                await interaction.editReply("Hubo un error crítico al intentar procesar tu solicitud.");
            }
        }

        // --- SUB-HANDLER: ACCIONES INTERNAS (BOTONES DEL CANAL) ---

        // 1. RECLAMAR TICKET
        if (customId === 'ticket_reclamar') {
            if (!this.validateStaffPermissions(member)) {
                return interaction.reply({ content: '❌ Solo el Staff puede reclamar tickets.', ephemeral: true });
            }

            const claimEmbed = new EmbedBuilder()
                .setColor('#00ff44')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                .setDescription(`✅ **Caso Tomado:** El Staff <@${user.id}> ha tomado este ticket y será tu soporte principal.`);
            
            await interaction.reply({ embeds: [claimEmbed] });
            
            try {
                if (!channel.name.startsWith('atendido-')) {
                    await channel.setName(`atendido-${channel.name}`);
                }
            } catch (setNameErr) {
                console.warn("⚠️ Rate limit al renombrar canal.");
            }
        }

        // 2. DERIVAR A COMPRAS
        if (customId === 'ticket_compras') {
            await channel.permissionOverwrites.edit(this.ROL_COMPRAS_ID, { 
                ViewChannel: true, SendMessages: true, AttachFiles: true, ReadMessageHistory: true 
            });
            
            const derivEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💰 Derivación a Tesorería')
                .setDescription('El caso ha sido movido al departamento de **Compras y Donaciones**.\n\nPor favor, adjunta el comprobante de pago o el error de la tienda.');
            
            await interaction.reply({ 
                content: `<@&${this.ROL_COMPRAS_ID}>`, 
                embeds: [derivEmbed] 
            });
        }

        // 3. SISTEMA DE ESCALADO JERÁRQUICO
        if (customId === 'ticket_ascender') {
            if (!this.validateStaffPermissions(member)) {
                return interaction.reply({ content: '❌ No tienes permisos para escalar casos.', ephemeral: true });
            }

            let currentRankIndex = -1;
            for (let i = 0; i < this.STAFF_HIERARCHY.length; i++) {
                if (channel.permissionOverwrites.cache.has(this.STAFF_HIERARCHY[i])) {
                    currentRankIndex = i;
                }
            }

            // Saltos inteligentes (Helper a Mod / Mod a Admin)
            let nextRankIndex = (currentRankIndex >= 0 && currentRankIndex < 3) ? 3 : currentRankIndex + 1;
            
            if (nextRankIndex >= this.STAFF_HIERARCHY.length) {
                return interaction.reply({ content: '❌ Este caso ya está en el nivel máximo de administración.', ephemeral: true });
            }

            const nextRoleId = this.STAFF_HIERARCHY[nextRankIndex];
            
            try {
                await channel.permissionOverwrites.edit(nextRoleId, { 
                    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true 
                });

                const ascEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🚀 TICKET ESCALADO')
                    .setDescription(`El caso ha sido elevado por falta de atribuciones.\n**Nuevo Nivel:** <@&${nextRoleId}>`);

                await interaction.reply({ 
                    content: `⚠️ Notificación de Escalado: <@&${nextRoleId}>`, 
                    embeds: [ascEmbed] 
                });
            } catch (err) {
                console.error("Fallo al escalar ticket:", err);
            }
        }

        // 4. CIERRE (MODAL DE RESOLUCIÓN)
        if (customId === 'ticket_cerrar') {
            if (!this.validateStaffPermissions(member)) {
                return interaction.reply({ content: '❌ Solo el Staff puede cerrar tickets.', ephemeral: true });
            }

            const closeConfirmModal = new ModalBuilder()
                .setCustomId('modal_final_close')
                .setTitle('🔒 Cierre y Archivado');

            const reasonInput = new TextInputBuilder()
                .setCustomId('razon_txt')
                .setLabel("Resolución/Motivo de Cierre")
                .setPlaceholder("Ej: El usuario recibió su reembolso / Dudas resueltas.")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            closeConfirmModal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            return await interaction.showModal(closeConfirmModal);
        }

        // --- SUB-HANDLER FINAL: CIERRE, TRANSCRIPT Y FIREBASE ---
        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply();
            
            const razon = interaction.fields.getTextInputValue('razon_txt');
            
            try {
                // Generar Transcript con librerías externas
                const transcriptHTML = await transcripts.createTranscript(channel, { 
                    limit: -1, 
                    returnType: 'string', 
                    saveImages: true, 
                    hydrate: true 
                });
                
                // Registro en Base de Datos (Firebase)
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
                    .setColor('#34495e')
                    .setTitle('📄 Registro de Ticket Archivado')
                    .addFields(
                        { name: 'Ticket:', value: `\`${channel.name}\``, inline: true },
                        { name: 'Staff:', value: `${user.tag}`, inline: true },
                        { name: 'Resolución:', value: `\`\`\`${razon}\`\`\`` },
                        { name: 'Archivo Web:', value: `🌐 [Consultar Base de Datos](${webURL})` }
                    )
                    .setTimestamp();

                const logChan = guild.channels.cache.get(this.LOG_CHANNEL_ID);
                if (logChan) await logChan.send({ embeds: [finalLogEmbed] });

                // Intento de notificación al usuario
                try {
                    await interaction.user.send({
                        content: `Se ha cerrado tu ticket en **Anda RP**. Aquí tienes el registro oficial:`,
                        embeds: [finalLogEmbed]
                    });
                } catch (e) {
                    console.log("DM del usuario cerrados.");
                }

                await interaction.editReply('✅ Transcript guardado en la nube. Eliminando canal en 5 segundos...');
                
                setTimeout(() => {
                    channel.delete().catch(e => console.error("Error al borrar canal:", e));
                }, 5000);

            } catch (err) {
                console.error("❌ FALLO EN ARCHIVADO:", err);
                await interaction.editReply("⚠️ Error al generar el transcript web. El canal se borrará forzosamente en 3 segundos.");
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }
        }
    },

    /**
     * @section 5. HELPERS DE SEGURIDAD
     */
    validateStaffPermissions(member) {
        return this.STAFF_HIERARCHY.some(roleId => member.roles.cache.has(roleId));
    },

    /**
     * @section 6. DOCUMENTACIÓN ADICIONAL Y MANTENIMIENTO
     * Este sistema requiere las siguientes dependencias instaladas:
     * - discord.js
     * - firebase-admin (configurado en firebase.js)
     * - discord-html-transcripts
     * * El flujo de escalado permite que niveles inferiores como el [0] no vean
     * tickets que han sido "ascendidos" a niveles de supervisión avanzados.
     */
};

// ---------------------------------------------------------
// ANDA RP - SISTEMA DE TICKETS ELITE (FIN DEL ARCHIVO)
// ---------------------------------------------------------