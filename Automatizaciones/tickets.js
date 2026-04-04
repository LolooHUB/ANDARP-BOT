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
 * Lógica avanzada de permisos, ascensos con bloqueo de seguridad y logs estilo Ticket King.
 * Versión: 3.0.1 (Full Detailing)
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

        // IDs DE CONFIGURACIÓN (Actualiza según tus necesidades)
        const logChannelId = '1476799509207060551';
        const highStaffRoleId = '1476767461024989326'; 

        const configs = {
            general: { cat: '1489831086065324093', role: '1476800914818859018', n: 'Soporte General', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: '1476800914818859018', n: 'Reportes', emoji: '🚫' },
            vip: { cat: '1489831182563672075', role: '1476767461024989326', n: 'VIP Prioritario', emoji: '🎫' },
            alianza: { cat: '1489831357357232218', role: '1476767863636234487', n: 'Alianzas', emoji: '🤝' }
        };

        // --- A. SOLICITUD DE MODALES ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            try {
                if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                    return interaction.reply({ content: '❌ **Acceso Denegado:** Este canal es exclusivo para miembros con rango VIP.', ephemeral: true });
                }

                const config = configs[customId.replace('t_', '')];
                const modal = new ModalBuilder()
                    .setCustomId(`modal_${customId}`)
                    .setTitle(`${config.emoji} Formulario de ${config.n}`);

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

                modal.addComponents(
                    new ActionRowBuilder().addComponents(input1),
                    new ActionRowBuilder().addComponents(input2)
                );

                return await interaction.showModal(modal);
            } catch (err) {
                console.error("Error abriendo modal:", err);
            }
        }

        // --- B. CREACIÓN DEL TICKET (SUBMIT) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            try {
                const type = customId.replace('modal_t_', '');
                const ticketId = await getNextTicketId();
                const config = configs[type];

                const tChannel = await guild.channels.create({
                    name: `ticket-${ticketId}`,
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
                    .setTitle(`✨ Ticket de Soporte #${ticketId}`)
                    .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                    .setDescription(`👋 Hola <@${user.id}>, has abierto un ticket de **${config.n}**.\nUn miembro del equipo staff te atenderá en breve.`)
                    .addFields(
                        { name: '👤 Usuario', value: `\`${user.tag}\``, inline: true },
                        { name: '🆔 ID Usuario', value: `\`${user.id}\``, inline: true }
                    )
                    .setTimestamp();

                interaction.fields.fields.forEach(f => {
                    const label = f.customId === 'f_roblox' ? 'USUARIO ROBLOX' : 'MOTIVO';
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

                // --- LOG DE APERTURA (TICKET KING STYLE) ---
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

                await interaction.editReply(`✅ **Ticket abierto con éxito:** ${tChannel}`);
            } catch (err) {
                console.error("Error creando ticket:", err);
                await interaction.editReply("❌ Hubo un error al procesar tu solicitud.");
            }
        }

        // --- C. BOTÓN: RECLAMAR ---
        if (customId === 'ticket_reclamar' || customId === 'ticket_reclamar_asc') {
            try {
                const claimEmbed = new EmbedBuilder()
                    .setColor('#00ff44')
                    .setAuthor({ name: 'Gestión de Tickets', iconURL: user.displayAvatarURL() })
                    .setDescription(`✅ **¡Ticket Reclamado!**\nEl Staff <@${user.id}> ha tomado el control del ticket y te asistirá ahora mismo.`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [claimEmbed] });
            } catch (e) { console.error(e); }
        }

        // --- D. BOTÓN: ASCENDER (DETALLADO Y SEGURO) ---
        if (customId === 'ticket_ascender') {
            try {
                // 1. Bloquear permisos de escritura para el staff actual y el que apretó el botón
                await channel.permissionOverwrites.edit(user.id, { SendMessages: false });
                
                // Intentar detectar el rol de staff inicial desde la mención del mensaje anterior
                const staffMention = interaction.message.content.match(/&(\d+)>/);
                if (staffMention) {
                    const oldRoleId = staffMention[1];
                    if (oldRoleId !== highStaffRoleId) {
                        await channel.permissionOverwrites.edit(oldRoleId, { SendMessages: false });
                    }
                }

                // 2. Dar acceso total al Staff Superior
                await channel.permissionOverwrites.edit(highStaffRoleId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true 
                });

                // 3. Crear Embed de Ascenso
                const originalFields = interaction.message.embeds[0].fields;
                const resume = originalFields.map(f => `**${f.name}:** ${f.value}`).join('\n');

                const ascEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🚀 TICKET ASCENDIDO A RANGO SUPERIOR')
                    .setDescription('Se ha solicitado la intervención de la administración.')
                    .addFields(
                        { name: '⏫ Ticket Ascendido a:', value: `<@&${highStaffRoleId}>`, inline: true },
                        { name: '👤 Persona que solicita:', value: `<@${user.id}>`, inline: true },
                        { name: '🔒 Seguridad:', value: 'Permisos del staff anterior revocados.', inline: false },
                        { name: '📝 Resumen ticket:', value: resume || "No se pudo recuperar el resumen." }
                    )
                    .setFooter({ text: 'Sistema de Gestión de Jerarquías - Anda RP' })
                    .setTimestamp();

                const ascRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar_asc').setLabel('Reclamar Ascenso').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ 
                    content: `⚠️ **Atención:** <@&${highStaffRoleId}>`, 
                    embeds: [ascEmbed], 
                    components: [ascRow] 
                });

            } catch (err) {
                console.error("Error en ascenso:", err);
                await interaction.reply({ content: "❌ Error al intentar ascender el ticket.", ephemeral: true });
            }
        }

        // --- E. BOTÓN: CERRAR (PREPARACIÓN) ---
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_final_close').setTitle('🔒 Cierre Definitivo');
            const input = new TextInputBuilder()
                .setCustomId('razon_txt')
                .setLabel("Razón del cierre")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Escribe el motivo por el cual se cierra este ticket...')
                .setRequired(true);
            
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // --- F. CIERRE DEFINITIVO Y LOGS (TICKET KING STYLE) ---
        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply();
            const razon = interaction.fields.getTextInputValue('razon_txt');
            const logChan = guild.channels.cache.get(logChannelId);

            try {
                // Conteo de mensajes profesional
                const messages = await channel.messages.fetch({ limit: 100 });
                const staffMsgs = messages.filter(m => !m.author.bot);
                
                const msgCounts = {};
                staffMsgs.forEach(m => {
                    msgCounts[m.author.id] = (msgCounts[m.author.id] || 0) + 1;
                });

                const statsFormatted = Object.entries(msgCounts)
                    .map(([id, count]) => `[ ${count} ] - <@${id}>`)
                    .join('\n') || "[ 0 ] - @SinDatos";

                if (logChan) {
                    const closeLog = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('Ticket Cerrado')
                        .addFields(
                            { name: 'Nombre del Ticket', value: `\`${channel.name}\``, inline: true },
                            { name: 'Autor del Ticket', value: `\`Solicitante\``, inline: true },
                            { name: 'Cerrado por', value: `<@${user.id}>`, inline: true },
                            { name: 'Fecha de Apertura', value: `\`${channel.createdAt.toLocaleDateString()}\``, inline: true },
                            { name: 'Fecha de Cierre', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                            { name: 'Razón de cierre del ticket', value: `\`\`\`${razon}\`\`\`` },
                            { name: 'Número de mensajes del equipo de soporte', value: statsFormatted }
                        )
                        .setFooter({ text: 'Finalizado • Anda RP Support' })
                        .setTimestamp();
                    
                    await logChan.send({ embeds: [closeLog] });
                }

                const deleteEmbed = new EmbedBuilder()
                    .setColor('#ed4245')
                    .setDescription('🔒 **Finalizando Soporte...**\nEl canal será eliminado en 5 segundos. Se han guardado los logs correspondientes.')
                    .setFooter({ text: 'Gracias por contactar con Anda RP' });

                await interaction.editReply({ embeds: [deleteEmbed] });
                setTimeout(() => channel.delete().catch(() => {}), 5000);

            } catch (err) {
                console.error("Error cerrando ticket:", err);
            }
        }
    }
};