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
 * LÓGICA DE TICKETS - ANDA RP
 * Sistema robusto con Logs Estilo Ticket King, Ascensos y Gestión de Canales.
 */

module.exports = {
    // --- PANEL INICIAL ---
    async sendTicketPanel(channel) {
        try {
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
                .setTimestamp()
                .setFooter({ text: 'Sistema de Soporte Automático', iconURL: 'attachment://LogoPFP.png' });

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
            console.log("✅ Panel de tickets enviado correctamente.");
        } catch (error) {
            console.error("❌ Error al enviar el panel de tickets:", error);
        }
    },

    // --- MANEJO DE INTERACCIONES ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        const { customId, guild, member, user, channel } = interaction;

        // CONFIGURACIÓN CENTRALIZADA
        const configs = {
            general: { cat: '1489831086065324093', role: '1476800914818859018', name: 'Soporte General', color: '#57f287' },
            reporte: { cat: '1489831182563672075', role: '1476800914818859018', name: 'Reportes', color: '#ed4245' },
            vip: { cat: '1489831182563672075', role: '1476767461024989326', name: 'Atención VIP', color: '#fee75c' },
            alianza: { cat: '1489831357357232218', role: '1476767863636234487', name: 'Alianzas y Similares', color: '#5865f2' }
        };

        const logChannelId = '1476799509207060551';
        const superiorRoleId = '1476767461024989326';

        // 1. GESTIÓN DE APERTURA (MODALES)
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            try {
                // Verificación de Rango VIP
                if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                    return interaction.reply({ 
                        content: '❌ **No tienes el rango VIP necesario.**\nAdquiérelo aquí: https://andarp.web.app/tienda.html', 
                        ephemeral: true 
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`modal_${customId}`)
                    .setTitle('📝 Formulario de Ticket');

                if (customId === 't_reporte') {
                    const r1 = new TextInputBuilder().setCustomId('f_user').setLabel("Usuario a Reportar").setStyle(TextInputStyle.Short).setPlaceholder('Nombre o ID del usuario...').setRequired(true);
                    const r2 = new TextInputBuilder().setCustomId('f_motivo').setLabel("Motivo del Reporte").setStyle(TextInputStyle.Paragraph).setPlaceholder('Explica lo sucedido detalladamente...').setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(r1), new ActionRowBuilder().addComponents(r2));
                } else if (customId === 't_alianza') {
                    const a1 = new TextInputBuilder().setCustomId('f_serv').setLabel("Nombre del Proyecto/Servidor").setStyle(TextInputStyle.Short).setRequired(true);
                    const a2 = new TextInputBuilder().setCustomId('f_motivo').setLabel("Propuesta o Consulta").setStyle(TextInputStyle.Paragraph).setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(a1), new ActionRowBuilder().addComponents(a2));
                } else {
                    const g1 = new TextInputBuilder().setCustomId('f_roblox').setLabel("Tu Usuario de Roblox").setStyle(TextInputStyle.Short).setRequired(true);
                    const g2 = new TextInputBuilder().setCustomId('f_motivo').setLabel("Motivo de Creación").setStyle(TextInputStyle.Paragraph).setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(g1), new ActionRowBuilder().addComponents(g2));
                }

                return await interaction.showModal(modal);
            } catch (err) {
                console.error("Error al abrir modal:", err);
            }
        }

        // 2. PROCESAMIENTO DE CREACIÓN (SUBMIT)
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

            try {
                const type = customId.replace('modal_t_', '');
                const ticketId = await getNextTicketId();
                const config = configs[type];

                // Crear canal de texto
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: config.cat,
                    topic: `Ticket de ${config.name} | Creado por ${user.tag}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                // Embed de Bienvenida dentro del ticket
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#e1ff00')
                    .setTitle(`🎫 Ticket de Soporte #${ticketId}`)
                    .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                    .setDescription(`Hola <@${user.id}>, gracias por contactar con el soporte de **Anda RP**.\nPor favor, espera a que un miembro del Staff te asista.`)
                    .setTimestamp();

                // Añadir campos del modal dinámicamente
                interaction.fields.fields.forEach(field => {
                    const name = field.customId.replace('f_', '').toUpperCase();
                    welcomeEmbed.addFields({ name: `🔹 ${name}`, value: `\`\`\`${field.value}\`\`\`` });
                });

                const actionButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ 
                    content: `<@${user.id}> | <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [actionButtons],
                    files: ['./attachment/LogoPFP.png']
                });

                // --- LOG DE APERTURA (ESTILO IMAGEN) ---
                const logs = guild.channels.cache.get(logChannelId);
                if (logs) {
                    const openLog = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('Ticket Abierto')
                        .addFields(
                            { name: 'Nombre del Ticket', value: `<#${ticketChannel.id}>`, inline: true },
                            { name: 'Creado por', value: `<@${user.id}>`, inline: true },
                            { name: 'Opened Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                            { name: 'Ticket Type', value: config.name, inline: false }
                        );
                    await logs.send({ embeds: [openLog] });
                }

                await interaction.editReply(`✅ **Tu ticket ha sido creado:** ${ticketChannel}`);

            } catch (err) {
                console.error("Error en creación de ticket:", err);
                await interaction.editReply("❌ Hubo un error crítico al intentar crear el canal.");
            }
        }

        // 3. ACCIÓN: RECLAMAR
        if (customId === 'ticket_reclamar') {
            try {
                const claimEmbed = new EmbedBuilder()
                    .setColor('#57f287')
                    .setDescription(`📌 **Ticket reclamado por ${user}**\nEste miembro del Staff se encargará de tu caso.`);
                
                await interaction.reply({ embeds: [claimEmbed] });
                
                // Log de reclamo
                const logs = guild.channels.cache.get(logChannelId);
                if (logs) logs.send({ content: `📌 **${user.tag}** reclamó el ticket \`${channel.name}\`` }).catch(() => {});
            } catch (e) { console.error(e); }
        }

        // 4. ACCIÓN: ASCENDER (DETALLADO)
        if (customId === 'ticket_ascender') {
            try {
                const originalEmbed = interaction.message.embeds[0];
                const fieldsData = originalEmbed.fields.map(f => `**${f.name}:** ${f.value}`).join('\n') || "Sin datos previos.";

                const ascEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🚀 Solicitud de Ascenso de Ticket')
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: '⏫ Ticket Ascendido a:', value: `<@&${superiorRoleId}>`, inline: true },
                        { name: '👤 Persona que solicita:', value: `<@${user.id}>`, inline: true },
                        { name: '📝 Resumen del ticket:', value: fieldsData }
                    )
                    .setFooter({ text: 'Se requiere atención de un rango superior.' })
                    .setTimestamp();

                await interaction.reply({ content: `⚠️ <@&${superiorRoleId}>`, embeds: [ascEmbed] });
            } catch (e) { console.error(e); }
        }

        // 5. ACCIÓN: CERRAR (CON CONTEO DE MENSAJES)
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_close_final').setTitle('🔒 Cierre de Ticket');
            const input = new TextInputBuilder().setCustomId('razon_txt').setLabel("Razón del cierre").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Escribe aquí el motivo del cierre...');
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // 6. PROCESAMIENTO CIERRE FINAL (LOGS ESTILO IMAGEN)
        if (interaction.isModalSubmit() && customId === 'modal_close_final') {
            await interaction.deferReply();
            const razon = interaction.fields.getTextInputValue('razon_txt');
            const logs = guild.channels.cache.get(logChannelId);

            try {
                // Obtener mensajes para el conteo (como en la foto)
                const messages = await channel.messages.fetch({ limit: 100 });
                const staffMessages = messages.filter(m => !m.author.bot && m.member.permissions.has(PermissionFlagsBits.ManageMessages));
                
                // Agrupar mensajes por staff para el conteo
                const stats = {};
                staffMessages.forEach(m => {
                    stats[m.author.id] = (stats[m.author.id] || 0) + 1;
                });

                const statsString = Object.entries(stats)
                    .map(([id, count]) => `[ ${count} ] - <@${id}>`)
                    .join('\n') || "[ 0 ] - Ninguno";

                if (logs) {
                    const closeEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('Ticket Cerrado')
                        .addFields(
                            { name: 'Nombre del Ticket', value: `\`${channel.name}\``, inline: true },
                            { name: 'Autor del Ticket', value: `\`Solicitante\``, inline: true },
                            { name: 'Cerrado por', value: `<@${user.id}>`, inline: true },
                            { name: 'Fecha de Apertura', value: `\`${channel.createdAt.toLocaleDateString()}\``, inline: true },
                            { name: 'Fecha de Cierre', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                            { name: 'Razón de cierre del ticket', value: `\`\`\`${razon}\`\`\`` },
                            { name: 'Número de mensajes del equipo de soporte', value: statsString }
                        )
                        .setFooter({ text: 'Finalizado' });

                    await logs.send({ embeds: [closeEmbed] });
                }

                await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ed4245').setDescription('🔒 **El ticket se eliminará en 10 segundos.**\nSe ha enviado el log correspondiente.')] });
                
                setTimeout(() => channel.delete().catch(() => {}), 10000);

            } catch (err) {
                console.error("Error al cerrar ticket:", err);
                await interaction.editReply("❌ Hubo un error al procesar el cierre.");
            }
        }
    }
};