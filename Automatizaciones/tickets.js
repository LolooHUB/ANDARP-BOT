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
    // Función para enviar el Panel Inicial (Ejecutar una sola vez en el canal de tickets)
    async sendTicketPanel(channel) {
        const embed = new EmbedBuilder()
            .setColor('#e1ff00')
            .setTitle('Panel de Tickets - Anda RP')
            .setDescription('Bienvenido al panel de Tickets de Anda RP, aqui podras crear tus tickets basandote en tus requerimientos.')
            .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
            .setFooter({ text: 'Anda RP - Rol de calidad' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('t_general').setLabel('📡 Soporte General').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('t_reporte').setLabel('🚫 Reportes').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('t_alianza').setLabel('🤝 Alianzas y similares').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('t_vip').setLabel('🎫 [VIP] Atencion Prioritaria').setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ embeds: [embed], components: [row], files: ['./attachment/LogoPFP.png'] });
    },

    async handleTicketInteractions(interaction) {
        const { customId, guild, member, user } = interaction;

        // --- 1. APERTURA DE MODALES ---
        if (customId === 't_general' || customId === 't_vip') {
            if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                return interaction.reply({ content: '❌ **No tienes rango VIP.** Puedes adquirirlo en: https://andarp.web.app/tienda.html', ephemeral: true });
            }

            const modal = new ModalBuilder().setCustomId(`modal_${customId}`).setTitle('Información del Ticket');
            const robloxUser = new TextInputBuilder().setCustomId('roblox_user').setLabel("Usuario de Roblox").setStyle(TextInputStyle.Short).setRequired(true);
            const motivo = new TextInputBuilder().setCustomId('motivo_ticket').setLabel("Motivo de Creacion").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(robloxUser), new ActionRowBuilder().addComponents(motivo));
            return interaction.showModal(modal);
        }

        if (customId === 't_reporte') {
            const modal = new ModalBuilder().setCustomId('modal_t_reporte').setTitle('Formulario de Reporte');
            const reportado = new TextInputBuilder().setCustomId('user_reportado').setLabel("Usuario de Roblox a Reportar").setStyle(TextInputStyle.Short).setRequired(true);
            const reportante = new TextInputBuilder().setCustomId('user_reportante').setLabel("Usuario de Roblox que Reporta").setStyle(TextInputStyle.Short).setRequired(true);
            const motivo = new TextInputBuilder().setCustomId('motivo_reporte').setLabel("Motivo de Reporte").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reportado), new ActionRowBuilder().addComponents(reportante), new ActionRowBuilder().addComponents(motivo));
            return interaction.showModal(modal);
        }

        if (customId === 't_alianza') {
            const modal = new ModalBuilder().setCustomId('modal_t_alianza').setTitle('Solicitud de Alianza');
            const serv = new TextInputBuilder().setCustomId('nom_servidor').setLabel("Nombre de servidor").setStyle(TextInputStyle.Short).setRequired(true);
            const rango = new TextInputBuilder().setCustomId('rango_env').setLabel("Rango del enviante en su servidor").setStyle(TextInputStyle.Short).setRequired(true);
            const motivo = new TextInputBuilder().setCustomId('motivo_ali').setLabel("Motivo de alianza o consulta").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(serv), new ActionRowBuilder().addComponents(rango), new ActionRowBuilder().addComponents(motivo));
            return interaction.showModal(modal);
        }

        // --- 2. PROCESAMIENTO DE MODALES (CREACIÓN) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            const ticketId = await getNextTicketId();
            const type = customId.replace('modal_t_', '');
            
            // Configuración por tipo
            const configs = {
                general: { cat: '1489831086065324093', role: '1476800914818859018' },
                reporte: { cat: '1489831182563672075', role: '1476800914818859018' },
                vip: { cat: '1489831182563672075', role: '1476767461024989326' },
                alianza: { cat: '1489831357357232218', role: '1476767863636234487' }
            };

            const channel = await guild.channels.create({
                name: `${user.username}-${ticketId}`,
                type: ChannelType.GuildText,
                parent: configs[type].cat,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: configs[type].role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            const embedInfo = new EmbedBuilder()
                .setColor('#e1ff00')
                .setTitle(`Ticket de ${type.toUpperCase()} #${ticketId}`)
                .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                .setFooter({ text: 'Anda RP - Rol de calidad' });

            // Agregar campos según el modal
            interaction.fields.fields.forEach(f => embedInfo.addFields({ name: f.customId.replace('_', ' ').toUpperCase(), value: f.value }));

            const rowBtns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `<@${user.id}> | <@&${configs[type].role}>`, embeds: [embedInfo], components: [rowBtns], files: ['./attachment/LogoPFP.png'] });
            
            // Log Apertura
            const logChan = guild.channels.cache.get('1476799509207060551');
            await logChan.send(`📥 **${user.tag}** ABRIÓ EL TICKET #${ticketId}`);
            
            await interaction.editReply(`Ticket creado: ${channel}`);
        }

        // --- 3. ACCIONES DENTRO DEL TICKET ---
        if (customId === 'ticket_reclamar') {
            // Solo staff puede reclamar (Fundadores y Staff Max omiten restricción)
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true, ViewChannel: true });
            // Quitar permisos al rol base del ticket para que solo el que reclamó lo vea
            // (Excepto rangos altos)
            
            await interaction.reply({ content: `✅ Ticket reclamado por ${interaction.user}.` });
            const logChan = guild.channels.cache.get('1476799509207060551');
            await logChan.send(`📌 **${interaction.user.tag}** RECLAMÓ EL TICKET ${interaction.channel.name}`);
        }

        if (customId === 'ticket_ascender') {
            // Lógica de jerarquía: Staff Básico -> Staff Avanzado -> Staff Max
            await interaction.reply({ content: 'Ticket ascendido a un superior. 🚀' });
            // Ping al rol superior... (implementar lógica de roles según origen)
        }

        if (customId === 'ticket_cerrar') {
            const modalC = new ModalBuilder().setCustomId('modal_cerrar_def').setTitle('Cierre de Ticket');
            const motivoC = new TextInputBuilder().setCustomId('motivo_cierre').setLabel("Motivo de cierre").setStyle(TextInputStyle.Short).setRequired(true);
            const suceso = new TextInputBuilder().setCustomId('suceso_cierre').setLabel("¿Que sucedió y como se solucionó?").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modalC.addComponents(new ActionRowBuilder().addComponents(motivoC), new ActionRowBuilder().addComponents(suceso));
            return interaction.showModal(modalC);
        }

        if (customId === 'modal_cerrar_def') {
            const motivo = interaction.fields.getTextInputValue('motivo_cierre');
            const suceso = interaction.fields.getTextInputValue('suceso_cierre');
            
            const logChan = guild.channels.cache.get('1476799509207060551');
            await logChan.send(`🔒 **TICKET CERRADO**\nCanal: ${interaction.channel.name}\nCerrado por: ${user.tag}\nMotivo: ${motivo}\nResolución: ${suceso}`);
            
            await interaction.reply("El ticket se cerrará en breve...");
            setTimeout(() => interaction.channel.delete(), 5000);
        }
    }
};