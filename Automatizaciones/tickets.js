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
    Collection
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');

/**
 * 🎫 SISTEMA DE TICKETS ELITE - ANDA RP
 * Lógica: Nombre dinámico (Categoría + ID), Jerarquía de 10 niveles y Logs King.
 * Versión: 6.0.0 (Ultra Detailing + VIP Shop Verification)
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL PRINCIPAL ---
    async sendTicketPanel(channel) {
        try {
            console.log("🛠️ Iniciando envío de panel de tickets...");
            const embed = new EmbedBuilder()
                .setColor('#e1ff00')
                .setTitle('Panel de Tickets - Anda RP')
                .setDescription('Bienvenido al panel de Tickets de Anda RP, aqui podras crear tus tickets basandote en tus requerimientos.\n\n' +
                                '📌 **Categorías disponibles:**\n' +
                                '> 📡 **Soporte General:** Dudas y consultas básicas.\n' +
                                '> 🚫 **Reportes:** Denuncias a usuarios o situaciones.\n' +
                                '> 🤝 **Alianzas:** Consultas sobre convenios.\n' +
                                '> 🎫 **VIP:** Atención prioritaria para miembros exclusivos.')
                .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                .setFooter({ text: 'Anda RP - Sistema de Soporte Automático', iconURL: 'attachment://LogoPFP.png' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_general').setLabel('📡 Soporte General').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('t_reporte').setLabel('🚫 Reportes').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('t_alianza').setLabel('🤝 Alianzas y similares').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('t_vip').setLabel('🎫 [VIP] Atencion Prioritaria').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [embed], 
                components: [row], 
                files: ['./attachment/LogoPFP.png'] 
            });
            console.log("✅ Panel de tickets desplegado sin errores.");
        } catch (e) {
            console.error("❌ Error crítico al enviar el panel:", e);
        }
    },

    // --- 2. MANEJO CENTRALIZADO DE INTERACCIONES ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        const { customId, guild, member, user, channel } = interaction;

        const logChannelId = '1476799509207060551';

        // --- JERARQUÍA DE MODERACIÓN (ORDENADA DE MENOR A MAYOR) ---
        const staffHierarchy = [
            '1476765837825277992', // Helper
            '1476766248242118697', // Mod en pruebas
            '1476766796861149284', // Mod
            '1476767536530849822', // Supervision basica
            '1476767750625038336', // Administrador
            '1482153188856434828', // Equipo de Compras y Similares
            '1476768019496829033', // Supervision Avanzada
            '1476768122915782676', // Manager
            '1476768405037125885', // Community Manager
            '1476768951034970253'  // Fundacion
        ];

        const configs = {
            general: { cat: '1489831086065324093', role: staffHierarchy[0], n: 'Soporte General', prefix: 'soporte', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: staffHierarchy[1], n: 'Reportes', prefix: 'reporte', emoji: '🚫' },
            vip: { cat: '1489831182563672075', role: '1476767461024989326', n: 'VIP Prioritario', prefix: 'vip', emoji: '🎫' },
            alianza: { cat: '1489831357357232218', role: '1476767863636234487', n: 'Alianzas', prefix: 'alianza', emoji: '🤝' }
        };

        // --- A. SOLICITUD DE MODALES CON VALIDACIÓN VIP ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            try {
                const type = customId.replace('t_', '');
                const config = configs[type];

                // --- VALIDACIÓN VIP EPHEMERAL ---
                if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                    const noVipEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🔒 Acceso Denegado')
                        .setDescription(
                            'Esta categoría es exclusiva para ciudadanos con **Rango VIP**.\n\n' +
                            '🛒 **¿Quieres adquirirlo?**\n' +
                            'Visita nuestra tienda para obtener beneficios y atención prioritaria:\n' +
                            '👉 **https://andarp.web.app/tienda.html**'
                        )
                        .setFooter({ text: 'Anda RP - Sistema de Ventas' });

                    const shopBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Ir a la Tienda')
                            .setURL('https://andarp.web.app/tienda.html')
                            .setStyle(ButtonStyle.Link)
                    );

                    return interaction.reply({ embeds: [noVipEmbed], components: [shopBtn], ephemeral: true });
                }

                // --- CREACIÓN DE MODALES SEGÚN CATEGORÍA ---
                const modal = new ModalBuilder()
                    .setCustomId(`modal_t_${type}`)
                    .setTitle(`${config.emoji} Formulario de ${config.n}`);

                // Inputs base
                const input1 = new TextInputBuilder()
                    .setCustomId('f_roblox')
                    .setLabel("Usuario de Roblox")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Tu nombre de usuario...')
                    .setRequired(true);

                const input2 = new TextInputBuilder()
                    .setCustomId('f_motivo')
                    .setLabel("Motivo del Ticket")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Describe detalladamente tu situación...')
                    .setRequired(true);

                // Si es reporte, agregamos campo de pruebas
                if (type === 'reporte') {
                    const input3 = new TextInputBuilder()
                        .setCustomId('f_pruebas')
                        .setLabel("Pruebas (Links)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Imgur, YouTube, Twitch...')
                        .setRequired(false);
                    
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(input1), 
                        new ActionRowBuilder().addComponents(input2),
                        new ActionRowBuilder().addComponents(input3)
                    );
                } else {
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(input1), 
                        new ActionRowBuilder().addComponents(input2)
                    );
                }

                return await interaction.showModal(modal);
            } catch (err) { console.error(err); }
        }

        // --- B. CREACIÓN DEL TICKET (CATEGORIA + ID) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            try {
                const type = customId.replace('modal_t_', '');
                const ticketId = await getNextTicketId();
                const config = configs[type];

                const tChannel = await guild.channels.create({
                    name: `${config.prefix}-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: config.cat,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#e1ff00')
                    .setTitle(`✨ Ticket de Soporte | ${config.n} #${ticketId}`)
                    .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                    .setDescription(`👋 Hola <@${user.id}>, un miembro del equipo de **${config.n}** te atenderá en breve.`)
                    .addFields(
                        { name: '👤 Usuario', value: `\`${user.tag}\``, inline: true },
                        { name: '🆔 ID Usuario', value: `\`${user.id}\``, inline: true }
                    )
                    .setTimestamp();

                // Mapeo dinámico de campos del modal al embed
                interaction.fields.fields.forEach(f => {
                    let label = 'INFORMACIÓN';
                    if (f.customId === 'f_roblox') label = 'USUARIO ROBLOX';
                    if (f.customId === 'f_motivo') label = 'MOTIVO';
                    if (f.customId === 'f_pruebas') label = 'PRUEBAS';
                    
                    welcomeEmbed.addFields({ name: `🔹 ${label}`, value: `\`\`\`${f.value}\`\`\`` });
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `<@${user.id}> | <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [row],
                    files: ['./attachment/LogoPFP.png']
                });

                // --- LOG APERTURA KING ---
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    const openLog = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('Ticket Abierto')
                        .addFields(
                            { name: 'Nombre del Ticket', value: `<#${tChannel.id}>`, inline: true },
                            { name: 'Creado por', value: `<@${user.id}>`, inline: true },
                            { name: 'Opened Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                            { name: 'Ticket Type', value: config.n, inline: false }
                        );
                    await logChan.send({ embeds: [openLog] });
                }

                await interaction.editReply(`✅ **Ticket abierto:** ${tChannel}`);
            } catch (err) { console.error(err); }
        }

        // --- C. BOTÓN: RECLAMAR ---
        if (customId === 'ticket_reclamar' || customId === 'ticket_reclamar_asc') {
            try {
                const claimEmbed = new EmbedBuilder()
                    .setColor('#00ff44')
                    .setAuthor({ name: 'Gestión de Tickets', iconURL: user.displayAvatarURL() })
                    .setDescription(`✅ **¡Ticket Reclamado!**\nEl Staff <@${user.id}> ha tomado el control y te asistirá ahora.`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [claimEmbed] });

                // Log de reclamo
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    logChan.send({ 
                        embeds: [new EmbedBuilder().setColor('#00ff44').setDescription(`📌 **Reclamo:** <@${user.id}> reclamó el ticket <#${channel.id}>`)] 
                    });
                }
            } catch (e) { console.error(e); }
        }

        // --- D. BOTÓN: ASCENDER (JERARQUÍA COMPLETA + BLOQUEO) ---
        if (customId === 'ticket_ascender') {
            try {
                let currentRankIndex = -1;
                for (let i = 0; i < staffHierarchy.length; i++) {
                    if (channel.permissionOverwrites.cache.has(staffHierarchy[i])) {
                        currentRankIndex = i;
                    }
                }

                const nextRankIndex = currentRankIndex + 1;

                if (nextRankIndex >= staffHierarchy.length) {
                    return interaction.reply({ content: '⚠️ El ticket ya alcanzó el rango máximo (**Fundación**).', ephemeral: true });
                }

                const nextRoleId = staffHierarchy[nextRankIndex];
                const prevRoleId = currentRankIndex !== -1 ? staffHierarchy[currentRankIndex] : null;

                // 1. Bloqueo de seguridad
                await channel.permissionOverwrites.edit(user.id, { SendMessages: false });
                if (prevRoleId) await channel.permissionOverwrites.edit(prevRoleId, { SendMessages: false });

                // 2. Dar acceso al siguiente nivel
                await channel.permissionOverwrites.edit(nextRoleId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true 
                });

                const ascEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🚀 TICKET ASCENDIDO A RANGO SUPERIOR')
                    .setDescription(`Se ha escalado el ticket para una revisión de mayor nivel.`)
                    .addFields(
                        { name: '⏫ Ascendido a:', value: `<@&${nextRoleId}>`, inline: true },
                        { name: '👤 Staff solicitante:', value: `<@${user.id}>`, inline: true },
                        { name: '🔒 Seguridad:', value: 'Permisos del rango anterior revocados automáticamente.', inline: false }
                    )
                    .setFooter({ text: `Anda RP - Gestión de Escalamiento (Nivel ${nextRankIndex + 1})` })
                    .setTimestamp();

                const ascRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar_asc').setLabel('Reclamar Ascenso').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender de Nuevo').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ 
                    content: `⚠️ **Atención:** <@&${nextRoleId}>`, 
                    embeds: [ascEmbed], 
                    components: [ascRow] 
                });

                // Log de Ascenso
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    logChan.send({ 
                        embeds: [new EmbedBuilder().setColor('#ff9900').setDescription(`🚀 **Ascenso:** <#${channel.id}> fue escalado a <@&${nextRoleId}> por <@${user.id}>`)] 
                    });
                }

            } catch (err) { console.error(err); }
        }

        // --- E. BOTÓN: CERRAR (MODAL) ---
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_final_close').setTitle('🔒 Cierre de Ticket');
            const input = new TextInputBuilder()
                .setCustomId('razon_txt')
                .setLabel("Razón del cierre")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Explica brevemente la solución o motivo...')
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // --- F. CIERRE DEFINITIVO Y LOGS KING ---
        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply();
            const razon = interaction.fields.getTextInputValue('razon_txt');
            const logChan = guild.channels.cache.get(logChannelId);

            try {
                // Conteo de mensajes (Ticket King Style)
                const messages = await channel.messages.fetch({ limit: 100 });
                const staffMsgs = messages.filter(m => !m.author.bot);
                
                const msgCounts = {};
                staffMsgs.forEach(m => { msgCounts[m.author.id] = (msgCounts[m.author.id] || 0) + 1; });

                const statsFormatted = Object.entries(msgCounts)
                    .map(([id, count]) => `[ ${count} ] - <@${id}>`)
                    .join('\n') || "[ 0 ] - @SinSoporte";

                if (logChan) {
                    const closeLog = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('Ticket Cerrado')
                        .addFields(
                            { name: 'Nombre del Ticket', value: `\`${channel.name}\``, inline: true },
                            { name: 'Cerrado por', value: `<@${user.id}>`, inline: true },
                            { name: 'Fecha de Apertura', value: `\`${channel.createdAt.toLocaleDateString()}\``, inline: true },
                            { name: 'Fecha de Cierre', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                            { name: 'Razón de cierre', value: `\`\`\`${razon}\`\`\`` },
                            { name: 'Mensajes del equipo de soporte', value: statsFormatted }
                        )
                        .setFooter({ text: 'Finalizado • Anda RP Support' })
                        .setTimestamp();
                    await logChan.send({ embeds: [closeLog] });
                }

                await interaction.editReply({ 
                    embeds: [new EmbedBuilder().setColor('#ed4245').setDescription('🔒 **Borrando canal en 5 segundos...**')] 
                });
                
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            } catch (err) { console.error(err); }
        }
    }
};