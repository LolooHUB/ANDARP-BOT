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
 * Lógica: Nombre dinámico (Categoría + ID), Jerarquía de 10 niveles, Derivación a Compras y Transcripción.
 * Estado: Producción Final.
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL PRINCIPAL ---
    async sendTicketPanel(channel) {
        try {
            console.log("🛠️ [SISTEMA] Iniciando envío de panel de tickets en #" + channel.name);
            
            const embed = new EmbedBuilder()
                .setColor('#e1ff00')
                .setTitle('Panel de Tickets - Anda RP')
                .setDescription(
                    'Bienvenido al panel de Soporte de **Anda RP**. Aquí podrás contactar con nuestro equipo según tus necesidades.\n\n' +
                    '📌 **Instrucciones:**\n' +
                    '> 1. Selecciona el botón que coincida con tu caso.\n' +
                    '> 2. Rellena el formulario con información verídica.\n' +
                    '> 3. Espera a que un miembro del Staff tome tu caso.\n\n' +
                    '📡 **Categorías:**\n' +
                    '- **Soporte General:** Dudas, problemas técnicos o consultas rápidas.\n' +
                    '- **Reportes:** Denuncias sobre usuarios o infracciones a la normativa.\n' +
                    '- **Alianzas:** Consultas sobre colaboraciones entre comunidades.\n' +
                    '- **VIP:** Canal prioritario para ciudadanos distinguidos.'
                )
                .setAuthor({ 
                    name: 'Gestión de Soporte Anda RP', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setFooter({ 
                    text: 'Anda RP - Sistema Automatizado de Atención al Ciudadano', 
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
                    .setLabel('🤝 Alianzas y similares')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('t_vip')
                    .setLabel('🎫 [VIP] Atencion Prioritaria')
                    .setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [embed], 
                components: [row], 
                files: ['./attachment/LogoPFP.png'] 
            });
            
            console.log("✅ [SISTEMA] Panel de tickets desplegado correctamente.");
        } catch (e) {
            console.error("❌ [ERROR CRÍTICO] Fallo en sendTicketPanel:", e);
        }
    },

    // --- 2. MANEJO CENTRALIZADO DE INTERACCIONES ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;
        const logChannelId = '1476799509207060551';
        const rolComprasId = '1482153188856434828';
        const logoPath = './attachment/LogoPFP.png';

        // --- JERARQUÍA DE MODERACIÓN (10 NIVELES) ---
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1482153188856434828', // [5] Equipo de Compras y Similares
            '1476768019496829033', // [6] Supervision Avanzada
            '1476768122915782676', // [7] Manager
            '1476768405037125885', // [8] Community Manager
            '1476768951034970253'  // [9] Fundacion
        ];

        const configs = {
            general: { cat: '1489831086065324093', role: staffHierarchy[0], n: 'Soporte General', prefix: 'soporte', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: staffHierarchy[1], n: 'Reportes', prefix: 'reporte', emoji: '🚫' },
            vip: { cat: '1489831182563672075', role: '1476767461024989326', n: 'VIP Prioritario', prefix: 'vip', emoji: '🎫' },
            alianza: { cat: '1489831357357232218', role: staffHierarchy[7], n: 'Alianzas', prefix: 'alianza', emoji: '🤝' }
        };

        // --- A. SOLICITUD DE MODALES CON VALIDACIÓN VIP ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            try {
                const type = customId.replace('t_', '');
                const config = configs[type];

                // Validación de Rango VIP para el botón específico
                if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                    const noVipEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🔒 Acceso Denegado')
                        .setDescription('Esta categoría es exclusiva para ciudadanos con **Rango VIP**.\n\n🛒 **¿Quieres adquirirlo?**\nVisita nuestra tienda oficial para obtener beneficios.')
                        .setFooter({ text: 'Anda RP - Sistema de Ventas' });

                    const shopBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Ir a la Tienda')
                            .setURL('https://andarp.web.app/tienda.html')
                            .setStyle(ButtonStyle.Link)
                    );
                    return interaction.reply({ embeds: [noVipEmbed], components: [shopBtn], ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`modal_t_${type}`)
                    .setTitle(`${config.emoji} Formulario de ${config.n}`);

                // Construcción dinámica de inputs según la categoría
                if (type === 'general' || type === 'vip') {
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('f_roblox')
                                .setLabel("Usuario de Roblox")
                                .setPlaceholder("Ej: JuanRP_22")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('f_motivo')
                                .setLabel("Motivo del Ticket")
                                .setPlaceholder("Explica detalladamente qué necesitas...")
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                        )
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
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_rol').setLabel("Rol del solicitante dentro del servidor").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_desc').setLabel("Descripción del servidor").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_invitacion').setLabel("Link de Invitación").setStyle(TextInputStyle.Short).setRequired(true))
                    );
                }

                return await interaction.showModal(modal);
            } catch (err) { 
                console.error("❌ Error al mostrar modal:", err); 
            }
        }

        // --- B. CREACIÓN DEL TICKET (CATEGORIA + ID) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            
            try {
                const type = customId.replace('modal_t_', '');
                const ticketId = await getNextTicketId();
                const config = configs[type];

                // Crear el canal de texto dentro de la categoría configurada
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
                    .setColor('#e1ff00')
                    .setTitle(`✨ Ticket de Soporte | ${config.n} #${ticketId}`)
                    .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                    .setDescription(`👋 Hola <@${user.id}>, un miembro del equipo de **${config.n}** te atenderá en breve. Por favor, mantén el respeto en todo momento.`)
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Usuario', value: `\`${user.tag}\``, inline: true },
                        { name: '🆔 ID Usuario', value: `\`${user.id}\``, inline: true }
                    )
                    .setFooter({ text: 'Sistema de Gestión Interna • Anda RP' })
                    .setTimestamp();

                // Añadir campos del modal automáticamente al embed
                fields.fields.forEach(f => {
                    const label = f.customId.replace('f_', '').toUpperCase().replace('_', ' ');
                    welcomeEmbed.addFields({ name: `🔹 ${label}`, value: `\`\`\`${f.value}\`\`\`` });
                });

                // Botones de gestión interna del ticket
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_compras').setLabel('Derivar Compras').setEmoji('💰').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `<@${user.id}> | <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [row],
                    files: [logoPath]
                });

                // Log de apertura
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    const openLog = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('🎫 Nuevo Ticket Detectado')
                        .addFields(
                            { name: 'Canal', value: `${tChannel}`, inline: true },
                            { name: 'Creador', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
                            { name: 'Tipo', value: config.n, inline: true },
                            { name: 'Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
                        );
                    await logChan.send({ embeds: [openLog] });
                }

                await interaction.editReply(`✅ **Tu ticket ha sido generado:** ${tChannel}`);
            } catch (err) { 
                console.error("❌ Fallo en creación de ticket:", err);
                await interaction.editReply("Hubo un error al intentar procesar tu solicitud.");
            }
        }

        // --- C. BOTÓN: RECLAMAR ---
        if (customId === 'ticket_reclamar' || customId === 'ticket_reclamar_asc') {
            try {
                const claimEmbed = new EmbedBuilder()
                    .setColor('#00ff44')
                    .setAuthor({ name: 'Gestión de Tickets', iconURL: user.displayAvatarURL() })
                    .setDescription(`✅ **¡Ticket Reclamado!**\nEl Staff <@${user.id}> se ha hecho cargo de tu solicitud y te responderá enseguida.`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [claimEmbed] });

                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    logChan.send({ 
                        embeds: [new EmbedBuilder().setColor('#00ff44').setDescription(`📌 **Reclamo:** <@${user.id}> reclamó el ticket <#${channel.id}>`)] 
                    });
                }
                
                // Renombrar canal opcionalmente para indicar que está atendido
                if (!channel.name.startsWith('atendido-')) {
                    await channel.setName(`atendido-${channel.name}`).catch(() => {});
                }
            } catch (e) { 
                console.error("Error al reclamar:", e); 
            }
        }

        // --- D. BOTÓN: DERIVAR COMPRAS ---
        if (customId === 'ticket_compras') {
            try {
                // Dar permisos al rol de compras
                await channel.permissionOverwrites.edit(rolComprasId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true, 
                    EmbedLinks: true 
                });

                const compEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('💰 Derivación de Departamento')
                    .setDescription(`Este ticket ha sido derivado al equipo de **Compras y Donaciones**.\n\nPor favor, <@${user.id}>, espera a que un encargado de este área revise tu caso.`)
                    .setFooter({ text: 'Traspaso solicitado por ' + user.tag })
                    .setTimestamp();

                await interaction.reply({ 
                    content: `<@&${rolComprasId}>`, 
                    embeds: [compEmbed] 
                });

                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    logChan.send({ 
                        embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`💰 **Traspaso:** El ticket <#${channel.id}> fue movido a Compras por <@${user.id}>`)] 
                    });
                }
            } catch (err) {
                console.error("Error al derivar compras:", err);
            }
        }

        // --- E. BOTÓN: ASCENDER (10 NIVELES) ---
        if (customId === 'ticket_ascender') {
            try {
                let currentRankIndex = -1;
                // Detectar qué rango de la jerarquía tiene acceso actual
                for (let i = 0; i < staffHierarchy.length; i++) {
                    if (channel.permissionOverwrites.cache.has(staffHierarchy[i])) {
                        currentRankIndex = i;
                    }
                }

                // Lógica de salto: Si es menor a 3 (Mod), salta a 3. Si no, sube 1.
                let nextRankIndex = (currentRankIndex >= 0 && currentRankIndex < 3) ? 3 : currentRankIndex + 1;

                if (nextRankIndex >= staffHierarchy.length) {
                    return interaction.reply({ content: '⚠️ Este ticket ya se encuentra en el nivel máximo de supervisión.', ephemeral: true });