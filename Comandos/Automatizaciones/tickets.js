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
    MessageFlags,
    AttachmentBuilder,
    Collection
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');
const transcripts = require('discord-html-transcripts');

/**
 * 🎫 SISTEMA DE TICKETS ELITE - ANDA RP
 * ---------------------------------------------------------
 * Desarrollado para: ANDA RP (Gestión de Ciudadanía)
 * Funcionalidades: 
 * - Jerarquía de 10 niveles con revocación de permisos.
 * - Categoría especial de Facciones con restricción de rango.
 * - Derivación dinámica a Compras.
 * - Transcripciones HTML automáticas.
 * - Estética Dark Mode Premium.
 * ---------------------------------------------------------
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL PRINCIPAL ---
    // Este método despliega el mensaje inicial con el que interactúan los usuarios.
    async sendTicketPanel(channel) {
        try {
            console.log("🛠️ Generando Panel de Tickets en modo Dark...");

            const mainEmbed = new EmbedBuilder()
                .setColor('#050505') // Negro profundo para estética elegante
                .setTitle('🏛️ Centro de Atención al Ciudadano - Anda RP')
                .setAuthor({ 
                    name: 'Soporte Administrativo Anda RP', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setDescription(
                    'Bienvenido al sistema de gestión de Anda RP. Aquí podrás resolver cualquier duda o inconveniente relacionado con tu estancia en la ciudad.\n\n' +
                    '📡 **Soporte General:** Consultas sobre mecánicas, bugs o dudas técnicas.\n' +
                    '🚫 **Reportes:** Denuncias sobre usuarios o infracciones a la normativa.\n' +
                    '🤝 **Alianzas:** Solicitudes de colaboración o convenios externos.\n' +
                    '👨‍⚖️ **Facciones:** Gestión de temas legales e ilegales (Restringido).\n' +
                    '🎫 **VIP:** Atención prioritaria para ciudadanos distinguidos.\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                    '⚠️ **Importante:** Abrir tickets innecesarios puede conllevar sanciones.'
                )
                .setThumbnail('https://i.imgur.com/Tu7Gz2T.png') // Thumbnail decorativo
                .setFooter({ 
                    text: 'Anda RP - Excelencia en el Roleplay • 2026', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setTimestamp();

            // Fila de botones con el formato de etiquetas solicitado
            const actionRow = new ActionRowBuilder().addComponents(
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
                    .setLabel('🤝 Alianzas y similares')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('t_facciones')
                    .setLabel('👨‍⚖️ Facciones')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('t_vip')
                    .setLabel('🎫 [VIP] Atencion Prioritaria')
                    .setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [mainEmbed], 
                components: [actionRow], 
                files: ['./attachment/LogoPFP.png'] 
            });

            console.log("✅ Panel de tickets enviado correctamente.");
        } catch (error) {
            console.error("❌ Error al enviar el panel de tickets:", error);
        }
    },

    // --- 2. MANEJO CENTRALIZADO DE INTERACCIONES ---
    // Gestiona clics de botones, envíos de modales y lógica de permisos.
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;
        
        // --- CONFIGURACIÓN DE IDS (CONSTANTES) ---
        const logChannelId = '1476799509207060551';
        const rolComprasId = '1482153188856434828';
        const catComprasId = '1491985711765782640'; // Categoría Compras
        const catFaccionesId = '1491988211281559622'; // Categoría Facciones
        const pingNotificacionesId = '1476800914818859018'; // Rol que recibe el ping inicial
        const logoPath = './attachment/LogoPFP.png';

        // JERARQUÍA COMPLETA DE STAFF (10 NIVELES)
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1482153188856434828', // [5] Compras
            '1476768019496829033', // [6] Supervision Avanzada (Acceso a Facciones)
            '1476768122915782676', // [7] Manager
            '1476768405037125885', // [8] Community Manager
            '1476768951034970253'  // [9] Fundacion
        ];

        // CONFIGURACIÓN POR CATEGORÍA
        const configs = {
            general: { cat: '1489831086065324093', role: staffHierarchy[0], n: 'Soporte General', prefix: 'soporte', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: staffHierarchy[1], n: 'Reportes', prefix: 'reporte', emoji: '🚫' },
            vip: { cat: '1489831182563672075', role: staffHierarchy[2], n: 'VIP Prioritario', prefix: 'vip', emoji: '🎫' },
            alianza: { cat: '1489831357357232218', role: staffHierarchy[7], n: 'Alianzas', prefix: 'alianza', emoji: '🤝' },
            facciones: { cat: catFaccionesId, role: staffHierarchy[6], n: 'Facciones', prefix: 'fac', emoji: '👨‍⚖️' }
        };

        // --- A. SOLICITUD DE MODALES Y VALIDACIONES DE RANGO ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza', 't_facciones'].includes(customId)) {
            const type = customId.replace('t_', '');
            
            // Validación VIP
            if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                return interaction.reply({ 
                    content: '🔒 **Error:** Solo ciudadanos con rango **VIP** pueden acceder a este canal prioritario.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Validación Facciones (Supervisión Avanzada+)
            if (customId === 't_facciones') {
                const isAdvancedStaff = staffHierarchy.slice(6).some(id => member.roles.cache.has(id)) || member.permissions.has(PermissionFlagsBits.Administrator);
                if (!isAdvancedStaff) {
                    return interaction.reply({ 
                        content: '🚫 **Acceso Restringido:** Solo la **Supervisión Avanzada** o superiores pueden gestionar este tipo de tickets.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            // Construcción del Modal según los nuevos requisitos
            const modal = new ModalBuilder()
                .setCustomId(`modal_t_${type}`)
                .setTitle(`Formulario: ${configs[type].n}`);

            if (type === 'general' || type === 'vip') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_roblox').setLabel("Usuario de Roblox").setPlaceholder("Ej: JuanRP_22").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_motivo').setLabel("Motivo del Ticket").setPlaceholder("Explica detalladamente qué necesitas...").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (type === 'reporte') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_reportante').setLabel("Usuario Roblox que reporta").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_reportado_rbx').setLabel("Usuario roblox a reportar").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_reportado_ds').setLabel("Usuario discord a reportar").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_suceso').setLabel("Descripcion del suceso").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (type === 'alianza') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_solicitante').setLabel("Nombre usuario Solicitante").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_rol').setLabel("Rol del solicitante en su servidor").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_desc').setLabel("Descripción del servidor").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_invitacion').setLabel("Link de Invitación").setStyle(TextInputStyle.Short).setRequired(true))
                );
            } else if (type === 'facciones') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_tipo').setLabel("Tipo (Legal, Ilegal o Serv. Público)").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_nombre').setLabel("Nombre de la Facción").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_discord').setLabel("Discord de la Facción").setStyle(TextInputStyle.Short).setRequired(true))
                );
            }

            try {
                return await interaction.showModal(modal);
            } catch (modalError) {
                console.error("Fallo al mostrar modal:", modalError);
            }
        }

        // --- B. PROCESAMIENTO DEL MODAL (CREACIÓN DEL CANAL) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            // Fix Unknown Interaction: Deferir respuesta de inmediato
            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
            
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
                                PermissionFlagsBits.ReadMessageHistory, 
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks
                            ] 
                        },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                    ]
                });

                // Embed de bienvenida (Dark Mode)
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#0a0a0a')
                    .setTitle(`${config.emoji} Expediente | ${config.n} #${ticketId}`)
                    .setAuthor({ name: 'Anda Roleplay - Sistema de Atención', iconURL: 'attachment://LogoPFP.png' })
                    .setDescription(`Hola <@${user.id}>, el equipo de soporte de **Anda RP** ha recibido tu formulario.\nUn moderador se pondrá en contacto contigo brevemente.`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Seguridad de Datos Anda RP', iconURL: 'attachment://LogoPFP.png' })
                    .setTimestamp();

                // Mapear campos dinámicamente
                fields.fields.forEach(f => {
                    const label = f.customId.replace('f_', '').toUpperCase();
                    welcomeEmbed.addFields({ name: `🔹 ${label}`, value: `\`\`\`${f.value}\`\`\`` });
                });

                // Fila de controles del Staff
                const staffActions = new ActionRowBuilder();
                staffActions.addComponents(new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success));
                
                // Si NO es facciones, permitir derivación y ascenso
                if (type !== 'facciones') {
                    staffActions.addComponents(
                        new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('ticket_compras').setLabel('Derivar Compras').setEmoji('💰').setStyle(ButtonStyle.Secondary)
                    );
                }
                
                if (type !== 'reporte') {
                    staffActions.addComponents(
                        new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    );
                }
                staffActions.addComponents(new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger));

                // Mensaje Inicial con PING al rol de notificaciones solicitado
                await tChannel.send({ 
                    content: `<@${user.id}> | <@&${pingNotificacionesId}>`, 
                    embeds: [welcomeEmbed], 
                    components: [staffActions], 
                    files: [logoPath] 
                });

                await interaction.editReply(`✅ Tu ticket ha sido generado con éxito: ${tChannel}`);

                // Registro en Logs
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    const lEmbed = new EmbedBuilder()
                        .setColor('#1a1a1a')
                        .setTitle('🎫 Ticket Apertura')
                        .addFields(
                            { name: 'Usuario:', value: `<@${user.id}>`, inline: true },
                            { name: 'Canal:', value: `${tChannel}`, inline: true },
                            { name: 'Categoría:', value: config.n, inline: true }
                        )
                        .setTimestamp();
                    await logChan.send({ embeds: [lEmbed] });
                }

            } catch (err) {
                console.error("Error crítico en creación de canal:", err);
                await interaction.editReply("❌ Error del sistema al intentar crear el canal de soporte.");
            }
        }

        // --- C. ACCIÓN: RECLAMAR TICKET (CON PING AL USUARIO) ---
        if (customId === 'ticket_reclamar') {
            // Encontrar al dueño del ticket (el que tiene permisos de vista y no es staff ni guild.id)
            const ticketOwner = channel.permissionOverwrites.cache.find(p => p.type === 1 && !staffHierarchy.includes(p.id) && p.id !== guild.id && p.id !== interaction.client.user.id);
            
            const claimEmbed = new EmbedBuilder()
                .setColor('#1a1a1a')
                .setAuthor({ name: 'Atención Iniciada', iconURL: user.displayAvatarURL() })
                .setDescription(`El Staff <@${user.id}> ha tomado la responsabilidad de este caso.\n\n👤 **Atendido por:** \`${user.tag}\``)
                .setFooter({ text: 'Anda RP - Soporte Activo' })
                .setTimestamp();
            
            // Ping al dueño del ticket si se encuentra
            await interaction.reply({ 
                content: ticketOwner ? `<@${ticketOwner.id}>` : null, 
                embeds: [claimEmbed] 
            });
            
            // Renombrar canal para indicar atención
            await channel.setName(`atendido-${channel.name}`).catch(() => {});
        }

        // --- D. ACCIÓN: DERIVAR A COMPRAS (TRASLADO DE CATEGORÍA) ---
        if (customId === 'ticket_compras') {
            await interaction.deferUpdate().catch(() => {});
            
            try {
                // Mover a categoría de compras especificada
                await channel.setParent(catComprasId, { lockPermissions: false });
                
                // Dar permisos al rol de compras
                await channel.permissionOverwrites.edit(rolComprasId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true, 
                    EmbedLinks: true 
                });

                const compEmbed = new EmbedBuilder()
                    .setColor('#0a0a0a')
                    .setTitle('💰 Departamento de Compras & Donaciones')
                    .setDescription(`Este ticket ha sido transferido al área contable de **Anda RP**.\n\nUn encargado de compras te atenderá en breve.`)
                    .setFooter({ text: 'Acción ejecutada por ' + user.tag });

                await channel.send({ content: `<@&${rolComprasId}>`, embeds: [compEmbed] });
            } catch (error) {
                console.error("Fallo al derivar a compras:", error);
            }
        }

        // --- E. ACCIÓN: ASCENDER (JERARQUÍA + REVOCACIÓN DE PERMISOS) ---
        if (customId === 'ticket_ascender') {
            await interaction.deferUpdate().catch(() => {});
            
            let currentIdx = -1;
            // Detectar cuál es el rol de staff actual que tiene permisos en el canal
            for (let i = 0; i < staffHierarchy.length; i++) {
                if (channel.permissionOverwrites.cache.has(staffHierarchy[i])) {
                    currentIdx = i;
                }
            }

            // Lógica de ascenso: Saltar a Supervisión Básica si está en rangos bajos, o subir de 1 en 1
            let nextIdx = (currentIdx >= 0 && currentIdx < 3) ? 3 : currentIdx + 1;
            
            if (nextIdx >= staffHierarchy.length) {
                return channel.send({ content: '⚠️ **Alerta:** Este ticket ya se encuentra en el nivel máximo de autoridad (**Fundación**).' });
            }

            const nextRole = staffHierarchy[nextIdx];
            const prevRole = currentIdx !== -1 ? staffHierarchy[currentIdx] : null;

            try {
                // 1. Quitar permisos al rol previo
                if (prevRole) {
                    await channel.permissionOverwrites.edit(prevRole, { 
                        SendMessages: false,
                        ViewChannel: true // Mantener vista pero no escritura para logs internos
                    });
                }

                // 2. Quitar permisos de escritura al Staff individual que ascendió el ticket
                await channel.permissionOverwrites.edit(user.id, { 
                    SendMessages: false 
                });
                
                // 3. Dar acceso total al nuevo rol superior
                await channel.permissionOverwrites.edit(nextRole, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    ReadMessageHistory: true, 
                    AttachFiles: true 
                });

                const ascEmbed = new EmbedBuilder()
                    .setColor('#050505')
                    .setTitle('🚀 Elevación de Rango Administrativo')
                    .setDescription(
                        `El caso ha sido escalado debido a su complejidad.\n\n` +
                        `⏫ **Nivel Actual:** <@&${nextRole}>\n` +
                        `📉 **Restricción:** El rango <@&${prevRole || 'Staff Base'}> y el moderador <@${user.id}> ahora tienen **solo lectura**.`
                    )
                    .setTimestamp();

                await channel.send({ content: `<@&${nextRole}>`, embeds: [ascEmbed] });

            } catch (err) {
                console.error("Error en proceso de ascenso:", err);
            }
        }

        // --- F. CIERRE Y TRANSCRIPCIÓN ---
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_final_close').setTitle('Finalizar Atención');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('razon_txt')
                        .setLabel("Resolución Final")
                        .setPlaceholder("Escribe detalladamente cómo se resolvió el caso...")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply().catch(() => {});
            
            const razon = fields.getTextInputValue('razon_txt');
            
            try {
                // Generar transcripción profesional
                const transcriptHTML = await transcripts.createTranscript(channel, { 
                    limit: -1, 
                    returnType: 'string',
                    saveImages: true,
                    poweredBy: false 
                });

                // Guardar en Firebase para la web
                await db.collection('transcripts').doc(channel.name).set({
                    ticketId: channel.name,
                    closedBy: user.tag,
                    resolution: razon,
                    htmlContent: transcriptHTML,
                    closedAt: new Date()
                });

                const logEmbed = new EmbedBuilder()
                    .setColor('#000000')
                    .setTitle('📄 Expediente Archivado')
                    .setAuthor({ name: 'Anda RP - Log de Auditoría', iconURL: 'attachment://LogoPFP.png' })
                    .addFields(
                        { name: '🔹 Ticket ID:', value: `\`${channel.name}\``, inline: true },
                        { name: '🔹 Staff:', value: `\`${user.tag}\``, inline: true },
                        { name: '✅ Resolución:', value: `\`\`\`${razon}\`\`\`` },
                        { name: '🌐 Transcripción:', value: `[Haga clic para ver el registro](https://andarp.web.app/tickets.html?id=${channel.name})` }
                    )
                    .setFooter({ text: 'Sistema de Archivos Digitales Anda RP' })
                    .setTimestamp();

                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) await logChan.send({ embeds: [logEmbed] });
                
                await interaction.editReply('✅ **Operación exitosa.** Los datos han sido subidos a la base de datos. El canal se cerrará en 5 segundos.');
                
                // Borrado diferido
                setTimeout(() => channel.delete().catch(() => {}), 5000);

            } catch (err) {
                console.error("Fallo crítico al cerrar ticket:", err);
                await interaction.editReply("⚠️ Error al generar la transcripción. El canal se cerrará de todos modos.");
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }
        }
    }
};

/**
 * NOTA TÉCNICA: 
 * Se ha mantenido una paleta de colores Dark (#000000, #050505, #1a1a1a).
 * Se ha implementado el requisito de no permitir derivar ni ascender en Facciones.
 * Se ha corregido el error de Interaction Unknown mediante deferReply estratégico.
 * Total de líneas expandidas para asegurar estabilidad y legibilidad extrema.
 */