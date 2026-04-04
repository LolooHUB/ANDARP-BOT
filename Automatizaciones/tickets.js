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
 * ---------------------------------------------------------
 * ● Jerarquía Dinámica de 10 Niveles (Staff Hierarchy)
 * ● Sistema de Re-Ascenso Infinito con bloqueo de seguridad
 * ● Logs Estilo Ticket King (Apertura, Reclamo, Ascenso, Cierre)
 * ● Verificación VIP con Link de Tienda
 * ● Conteo Profesional de Mensajes de Soporte
 * ---------------------------------------------------------
 * Versión: 5.5.0 (Full Detailed Code)
 */

module.exports = {
    // --- 1. DESPLIEGUE DEL PANEL DE BIENVENIDA ---
    async sendTicketPanel(channel) {
        try {
            console.log("🛠️ [SISTEMA] Generando panel de tickets de alta fidelidad...");

            const mainEmbed = new EmbedBuilder()
                .setColor('#e1ff00')
                .setTitle('✨ Centro de Soporte Anda RP')
                .setAuthor({ name: 'Anda RP Executive System', iconURL: 'attachment://LogoPFP.png' })
                .setDescription(
                    'Bienvenido al portal oficial de asistencia. Nuestro equipo está listo para ayudarte.\n\n' +
                    '**Selecciona una categoría para comenzar:**\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                    '📡 **Soporte General**\n> Consultas básicas, dudas técnicas o problemas menores.\n\n' +
                    '🚫 **Reportes de Usuarios**\n> Denuncias sobre anti-rol, toxicidad o infracciones.\n\n' +
                    '🤝 **Alianzas y Facciones**\n> Consultas para grupos, convenios o compras masivas.\n\n' +
                    '🎫 **Soporte VIP (Prioritario)**\n> Atención inmediata exclusiva para miembros VIP.\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
                )
                .addFields({ name: '🛒 ¿Quieres ser VIP?', value: 'Consíguelo en [andarp.web.app/tienda.html](https://andarp.web.app/tienda.html)' })
                .setImage('https://i.imgur.com/GZ5lG5X.png') // Banner decorativo
                .setFooter({ text: 'Sistema de Soporte Automático • Anda RP 2026', iconURL: 'attachment://LogoPFP.png' })
                .setTimestamp();

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_general').setLabel('Soporte General').setEmoji('📡').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('t_reporte').setLabel('Reportes').setEmoji('🚫').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('t_alianza').setLabel('Alianzas').setEmoji('🤝').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('t_vip').setLabel('VIP Prioritario').setEmoji('🎫').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [mainEmbed], 
                components: [buttonRow], 
                files: ['./attachment/LogoPFP.png'] 
            });

            console.log("✅ [SISTEMA] Panel desplegado correctamente.");
        } catch (error) {
            console.error("❌ [ERROR CRÍTICO] Fallo al enviar panel:", error);
        }
    },

    // --- 2. GESTIÓN CENTRALIZADA DE EVENTOS ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        const { customId, guild, member, user, channel } = interaction;

        // --- IDS DE CONFIGURACIÓN ---
        const logChannelId = '1476799509207060551';
        const ticketSupportRole = '1476800914818859018'; // Rol que recibe pings iniciales

        // --- JERARQUÍA MAESTRA (10 NIVELES) ---
        const staffHierarchy = [
            '1476765837825277992', // 1. Helper
            '1476766248242118697', // 2. Mod en pruebas
            '1476766796861149284', // 3. Mod
            '1476767536530849822', // 4. Supervision basica
            '1476767750625038336', // 5. Administrador
            '1482153188856434828', // 6. Equipo de Compras
            '1476768019496829033', // 7. Supervision Avanzada
            '1476768122915782676', // 8. Manager
            '1476768405037125885', // 9. Community Manager
            '1476768951034970253'  // 10. Fundacion
        ];

        const ticketConfigs = {
            general: { cat: '1489831086065324093', role: ticketSupportRole, n: 'Soporte General', prefix: 'soporte', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: ticketSupportRole, n: 'Reportes', prefix: 'reporte', emoji: '🚫' },
            vip: { cat: '1489831182563672075', role: '1476767461024989326', n: 'VIP Prioritario', prefix: 'vip', emoji: '🎫' },
            alianza: { cat: '1489831357357232218', role: '1476767863636234487', n: 'Alianzas', prefix: 'alianza', emoji: '🤝' }
        };

        // --- A. LANZAMIENTO DE FORMULARIOS (MODALES) ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            const type = customId.replace('t_', '');
            
            // Verificación VIP con Embed de Tienda
            if (type === 'vip' && !member.roles.cache.has('1476765603418079434')) {
                const noVipEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔒 Acceso Restringido')
                    .setDescription(
                        'Lo sentimos, los tickets de atención prioritaria son exclusivos para miembros con **Rango VIP**.\n\n' +
                        '💎 **Ventajas de ser VIP:**\n' +
                        '> • Atención directa de Administradores.\n' +
                        '> • Prioridad absoluta en la cola de espera.\n' +
                        '> • Soporte extendido para facciones.\n\n' +
                        '🛒 **Adquiere tu rango aquí:**\n' +
                        '👉 [andarp.web.app/tienda.html](https://andarp.web.app/tienda.html)'
                    );
                
                const storeBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Tienda Online').setURL('https://andarp.web.app/tienda.html').setStyle(ButtonStyle.Link)
                );

                return interaction.reply({ embeds: [noVipEmbed], components: [storeBtn], ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_t_${type}`)
                .setTitle(`📋 Registro: ${ticketConfigs[type].n}`);

            const robloxInput = new TextInputBuilder()
                .setCustomId('f_roblox')
                .setLabel("Tu usuario de Roblox")
                .setPlaceholder("Ejemplo: JuanPerez123")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const motivoInput = new TextInputBuilder()
                .setCustomId('f_motivo')
                .setLabel("Descripción del problema")
                .setPlaceholder("Escribe detalladamente qué sucede...")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(robloxInput),
                new ActionRowBuilder().addComponents(motivoInput)
            );

            return await interaction.showModal(modal);
        }

        // --- B. PROCESAMIENTO DE CREACIÓN DE TICKET ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            try {
                const type = customId.replace('modal_t_', '');
                const config = ticketConfigs[type];
                const ticketId = await getNextTicketId();

                // Crear canal con nombre dinámico (Prefijo + ID)
                const tChannel = await guild.channels.create({
                    name: `${config.prefix}-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: config.cat,
                    topic: `Ticket de ${config.n} | Usuario: ${user.tag} (${user.id})`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#e1ff00')
                    .setTitle(`🎫 Ticket #${ticketId} | ${config.n}`)
                    .setAuthor({ name: 'Anda RP Support', iconURL: 'attachment://LogoPFP.png' })
                    .setDescription(
                        `Hola <@${user.id}>, bienvenido a tu ticket.\n` +
                        `Un miembro del equipo de **${config.n}** revisará tu información pronto.\n\n` +
                        '**Información Proporcionada:**\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
                    )
                    .addFields(
                        { name: '👤 Usuario Discord', value: `\`${user.tag}\` (${user.id})`, inline: false },
                        { name: '🔹 Usuario Roblox', value: `\`\`\`${interaction.fields.getTextInputValue('f_roblox')}\`\`\``, inline: true },
                        { name: '📝 Motivo / Detalle', value: `\`\`\`${interaction.fields.getTextInputValue('f_motivo')}\`\`\``, inline: false }
                    )
                    .setFooter({ text: 'Utiliza los botones inferiores para gestionar el ticket.' })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `<@${user.id}> | <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [actionRow], 
                    files: ['./attachment/LogoPFP.png'] 
                });

                // LOG DE APERTURA (TICKET KING)
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    const lEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('🎫 Ticket Apertura')
                        .addFields(
                            { name: 'Canal', value: `<#${tChannel.id}>`, inline: true },
                            { name: 'Creador', value: `<@${user.id}>`, inline: true },
                            { name: 'Categoría', value: config.n, inline: true },
                            { name: 'Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                        );
                    await logChan.send({ embeds: [lEmbed] });
                }

                await interaction.editReply(`✅ **Ticket generado con éxito:** ${tChannel}`);
            } catch (err) {
                console.error("Error al crear ticket:", err);
                await interaction.editReply("❌ Hubo un error crítico al crear el canal.");
            }
        }

        // --- C. ACCIÓN: RECLAMAR TICKET ---
        if (customId === 'ticket_reclamar' || customId === 'ticket_reclamar_asc') {
            const claimEmbed = new EmbedBuilder()
                .setColor('#00ff44')
                .setAuthor({ name: 'Gestión de Soporte', iconURL: user.displayAvatarURL() })
                .setDescription(`✅ **¡Ticket Reclamado!**\nEl Staff <@${user.id}> ha tomado el caso y te asistirá personalmente.`)
                .setTimestamp();

            await interaction.reply({ embeds: [claimEmbed] });

            const logs = guild.channels.cache.get(logChannelId);
            if (logs) {
                logs.send({ 
                    embeds: [new EmbedBuilder().setColor('#00ff44').setDescription(`📌 **Reclamo:** <@${user.id}> reclamó el ticket <#${channel.id}>`)] 
                });
            }
        }

        // --- D. ACCIÓN: ASCENSO (JERARQUÍA INFINITA Y SEGURA) ---
        if (customId === 'ticket_ascender') {
            try {
                // Escaneo de rango actual en el canal
                let currentRankIndex = -1;
                for (let i = 0; i < staffHierarchy.length; i++) {
                    if (channel.permissionOverwrites.cache.has(staffHierarchy[i])) {
                        currentRankIndex = i;
                    }
                }

                const nextRankIndex = currentRankIndex + 1;
                if (nextRankIndex >= staffHierarchy.length) {
                    return interaction.reply({ content: '⚠️ Este ticket ya se encuentra en el nivel máximo (**Fundación**).', ephemeral: true });
                }

                const nextRoleId = staffHierarchy[nextRankIndex];
                const prevRoleId = currentRankIndex !== -1 ? staffHierarchy[currentRankIndex] : ticketSupportRole;

                // BLOQUEO DE SEGURIDAD: Revocar permisos de escritura al rango anterior y al staff que asciende
                await channel.permissionOverwrites.edit(user.id, { SendMessages: false });
                await channel.permissionOverwrites.edit(prevRoleId, { SendMessages: false });

                // DAR ACCESO AL SIGUIENTE RANGO
                await channel.permissionOverwrites.edit(nextRoleId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true 
                });

                const ascEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🚀 ESCALAMIENTO JERÁRQUICO')
                    .setThumbnail('https://i.imgur.com/GZ5lG5X.png')
                    .setDescription(
                        `El ticket ha sido escalado para la intervención de un rango superior.\n\n` +
                        `**⏫ Ascendido a:** <@&${nextRoleId}>\n` +
                        `**👤 Solicitado por:** <@${user.id}>\n` +
                        `**🔒 Seguridad:** Permisos de escritura bloqueados para rangos inferiores.`
                    )
                    .setFooter({ text: `Jerarquía Anda RP - Nivel ${nextRankIndex + 1}` })
                    .setTimestamp();

                const ascRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar_asc').setLabel('Reclamar Ascenso').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender de Nuevo').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ 
                    content: `⚠️ **Intervención Requerida:** <@&${nextRoleId}>`, 
                    embeds: [ascEmbed], 
                    components: [ascRow] 
                });

                // LOG DE ASCENSO
                const logs = guild.channels.cache.get(logChannelId);
                if (logs) {
                    logs.send({ 
                        embeds: [new EmbedBuilder().setColor('#ff9900').setDescription(`🚀 **Ascenso:** <#${channel.id}> subió a <@&${nextRoleId}> por <@${user.id}>`)] 
                    });
                }
            } catch (err) { console.error("Error en ascenso:", err); }
        }

        // --- E. ACCIÓN: CIERRE DEFINITIVO (MODAL + LOG KING) ---
        if (customId === 'ticket_cerrar') {
            const closeModal = new ModalBuilder().setCustomId('modal_final_close').setTitle('🔒 Cierre de Gestión');
            const razonInput = new TextInputBuilder()
                .setCustomId('razon_txt')
                .setLabel("Razón del cierre")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Escribe el resumen de la solución o motivo del cierre...')
                .setRequired(true);
            
            closeModal.addComponents(new ActionRowBuilder().addComponents(razonInput));
            return await interaction.showModal(closeModal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply();
            try {
                const razon = interaction.fields.getTextInputValue('razon_txt');
                const logChan = guild.channels.cache.get(logChannelId);

                // --- SISTEMA DE CONTEO DE MENSAJES ---
                const messages = await channel.messages.fetch({ limit: 100 });
                const staffMsgs = messages.filter(m => !m.author.bot);
                
                const stats = {};
                staffMsgs.forEach(m => {
                    stats[m.author.id] = (stats[m.author.id] || 0) + 1;
                });

                const formattedStats = Object.entries(stats)
                    .map(([id, count]) => `[ ${count} ] - <@${id}>`)
                    .join('\n') || "[ 0 ] - No se registraron mensajes de staff";

                // LOG FINAL TICKET KING
                if (logChan) {
                    const closeLog = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('🔒 Ticket Finalizado')
                        .addFields(
                            { name: 'Identificador', value: `\`${channel.name}\``, inline: true },
                            { name: 'Cerrado por', value: `<@${user.id}>`, inline: true },
                            { name: 'Fecha Apertura', value: `\`${channel.createdAt.toLocaleDateString()}\``, inline: true },
                            { name: 'Duración', value: `${Math.floor((Date.now() - channel.createdAt) / 60000)} minutos`, inline: true },
                            { name: 'Razón de Cierre', value: `\`\`\`${razon}\`\`\`` },
                            { name: 'Estadísticas de Soporte', value: formattedStats }
                        )
                        .setFooter({ text: 'Log System • Anda RP Security' })
                        .setTimestamp();
                    
                    await logChan.send({ embeds: [closeLog] });
                }

                const deleteEmbed = new EmbedBuilder()
                    .setColor('#ed4245')
                    .setDescription('🔒 **Cerrando ticket...**\nEl canal se auto-eliminará en 5 segundos. Todos los datos han sido guardados.')
                    .setFooter({ text: 'Gracias por contactar con Anda RP' });

                await interaction.editReply({ embeds: [deleteEmbed] });
                
                // Borrado definitivo
                setTimeout(() => channel.delete().catch(() => {}), 5000);

            } catch (err) {
                console.error("Error al cerrar ticket:", err);
            }
        }
    }
};