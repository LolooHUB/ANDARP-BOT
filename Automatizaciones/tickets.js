const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');

module.exports = {
    async sendTicketPanel(channel) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#e1ff00')
                .setTitle('✨ Panel de Tickets - Anda RP')
                .setDescription('>>> Bienvenido al sistema de soporte. Selecciona una categoría debajo para recibir asistencia personalizada.')
                .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                .setImage('attachment://LogoPFP.png') // Opcional: Para hacerlo más largo
                .setFooter({ text: 'Anda RP - Rol de calidad • 2026', iconURL: 'attachment://LogoPFP.png' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_general').setLabel('Soporte General').setEmoji('📡').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('t_reporte').setLabel('Reportes').setEmoji('🚫').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('t_alianza').setLabel('Alianzas').setEmoji('🤝').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('t_vip').setLabel('VIP Prioridad').setEmoji('🎫').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ embeds: [embed], components: [row], files: ['./attachment/LogoPFP.png'] });
        } catch (e) { console.error("Error panel:", e); }
    },

    async handleTicketInteractions(interaction) {
        const { customId, guild, member, user } = interaction;

        // --- 1. MODALES ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                return interaction.reply({ content: '❌ **No tienes rango VIP.** Consíguelo en: https://andarp.web.app/tienda.html', ephemeral: true });
            }

            const modal = new ModalBuilder().setCustomId(`modal_${customId}`).setTitle('📝 Formulario de Soporte');
            
            if (customId === 't_reporte') {
                const reportado = new TextInputBuilder().setCustomId('user_reportado').setLabel("Usuario a Reportar").setStyle(TextInputStyle.Short).setPlaceholder('Ej: Juanito123').setRequired(true);
                const motivo = new TextInputBuilder().setCustomId('motivo_reporte').setLabel("Motivo de Reporte").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(reportado), new ActionRowBuilder().addComponents(motivo));
            } else {
                const robloxUser = new TextInputBuilder().setCustomId('roblox_user').setLabel("Tu Usuario de Roblox").setStyle(TextInputStyle.Short).setRequired(true);
                const motivo = new TextInputBuilder().setCustomId('motivo_ticket').setLabel("Detalles de tu consulta").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(robloxUser), new ActionRowBuilder().addComponents(motivo));
            }
            return await interaction.showModal(modal);
        }

        // --- 2. CREACIÓN (LOGS ESTILO TICKET KING) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            try {
                const ticketId = await getNextTicketId();
                const type = customId.replace('modal_t_', '');
                const configs = {
                    general: { cat: '1489831086065324093', role: '1476800914818859018', name: 'Soporte General' },
                    reporte: { cat: '1489831182563672075', role: '1476800914818859018', name: 'Reporte' },
                    vip: { cat: '1489831182563672075', role: '1476767461024989326', name: 'Atención VIP' },
                    alianza: { cat: '1489831357357232218', role: '1476767863636234487', name: 'Alianza' }
                };

                const channel = await guild.channels.create({
                    name: `ticket-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: configs[type].cat,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                        { id: configs[type].role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                // Embed dentro del ticket
                const ticketEmbed = new EmbedBuilder()
                    .setColor('#e1ff00')
                    .setTitle('🎫 Nuevo Ticket Abierto')
                    .setAuthor({ name: 'Anda RP - Soporte', iconURL: 'attachment://LogoPFP.png' })
                    .addFields(
                        { name: '👤 Usuario', value: `<@${user.id}>`, inline: true },
                        { name: '📂 Categoría', value: configs[type].name, inline: true },
                        { name: '🆔 ID Ticket', value: `#${ticketId}`, inline: true }
                    );

                interaction.fields.fields.forEach(f => {
                    ticketEmbed.addFields({ name: `🔹 ${f.customId.replace('modal_', '').toUpperCase()}`, value: `\`\`\`${f.value}\`\`\`` });
                });

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await channel.send({ content: `<@${user.id}> | <@&${configs[type].role}>`, embeds: [ticketEmbed], components: [btns], files: ['./attachment/LogoPFP.png'] });

                // --- LOG DE APERTURA (ESTILO IMAGEN) ---
                const logChan = guild.channels.cache.get('1476799509207060551');
                if (logChan) {
                    const openLog = new EmbedBuilder()
                        .setColor('#00ff44')
                        .setTitle('✨ Ticket Abierto')
                        .addFields(
                            { name: 'Nombre del Ticket', value: `${channel.name}`, inline: true },
                            { name: 'Creado por', value: `<@${user.id}>`, inline: true },
                            { name: 'Opened Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                            { name: 'Ticket Type', value: configs[type].name, inline: false }
                        );
                    await logChan.send({ embeds: [openLog] });
                }

                await interaction.editReply(`✅ Ticket creado: ${channel}`);
            } catch (error) { await interaction.editReply(`❌ Error: ${error.message}`); }
        }

        // --- 3. ACCIONES ---
        if (customId === 'ticket_reclamar') {
            await interaction.channel.permissionOverwrites.edit(user.id, { SendMessages: true, ViewChannel: true });
            const embed = new EmbedBuilder().setColor('#00ff44').setDescription(`👋 **Ticket reclamado por ${user}.** En breve serás atendido.`);
            await interaction.reply({ embeds: [embed] });
        }

        if (customId === 'ticket_ascender') {
            const highStaff = '1476767461024989326'; // ID de Staff Superior
            const fields = interaction.message.embeds[0].fields;
            const userTicket = fields.find(f => f.name === '👤 Usuario')?.value || 'Desconocido';
            const motivo = fields.find(f => f.name.includes('MOTIVO'))?.value || 'Sin detalles';

            const embedAscenso = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🚀 Ticket Ascendido')
                .addFields(
                    { name: '⏫ Ticket Ascendido a:', value: `<@&${highStaff}>` },
                    { name: '👤 Persona que solicita:', value: `<@${user.id}>` },
                    { name: '📝 Resumen del ticket:', value: `Usuario: ${userTicket}\nMotivo: ${motivo}` }
                )
                .setTimestamp();

            await interaction.reply({ content: `<@&${highStaff}>`, embeds: [embedAscenso] });
        }

        if (customId === 'ticket_cerrar') {
            const modalC = new ModalBuilder().setCustomId('modal_cerrar_def').setTitle('🔒 Cierre de Ticket');
            const mot = new TextInputBuilder().setCustomId('m_c').setLabel("Razón del cierre").setStyle(TextInputStyle.Short).setRequired(true);
            modalC.addComponents(new ActionRowBuilder().addComponents(mot));
            return interaction.showModal(modalC);
        }

        if (customId === 'modal_cerrar_def') {
            const razon = interaction.fields.getTextInputValue('m_c');
            const logChan = guild.channels.cache.get('1476799509207060551');

            if (logChan) {
                const closeLog = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔒 Ticket Cerrado')
                    .addFields(
                        { name: 'Nombre del Ticket', value: `\`${interaction.channel.name}\``, inline: true },
                        { name: 'Autor del Ticket', value: `\`N/A\``, inline: true }, // Aquí podrías jalar la data de la DB si guardas el autor
                        { name: 'Cerrado por', value: `<@${user.id}>`, inline: true },
                        { name: 'Razón de cierre', value: `\`\`\`${razon}\`\`\`` }
                    )
                    .setFooter({ text: `Finalizado • ${interaction.channel.name}` })
                    .setTimestamp();
                await logChan.send({ embeds: [closeLog] });
            }

            await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('⌛ El ticket se cerrará en 5 segundos...')] });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }
};