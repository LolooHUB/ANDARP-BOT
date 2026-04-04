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

            await channel.send({ 
                embeds: [embed], 
                components: [row], 
                files: ['./attachment/LogoPFP.png'] 
            });
        } catch (error) {
            console.error("Error enviando el panel inicial:", error);
        }
    },

    async handleTicketInteractions(interaction) {
        const { customId, guild, member, user } = interaction;

        // --- 1. APERTURA DE MODALES ---
        if (customId === 't_general' || customId === 't_vip' || customId === 't_reporte' || customId === 't_alianza') {
            try {
                if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                    return interaction.reply({ content: '❌ **No tienes rango VIP.** Puedes adquirirlo en: https://andarp.web.app/tienda.html', ephemeral: true });
                }

                const modal = new ModalBuilder().setCustomId(`modal_${customId}`).setTitle('Información del Ticket');

                if (customId === 't_reporte') {
                    const reportado = new TextInputBuilder().setCustomId('user_reportado').setLabel("Usuario de Roblox a Reportar").setStyle(TextInputStyle.Short).setRequired(true);
                    const reportante = new TextInputBuilder().setCustomId('user_reportante').setLabel("Usuario de Roblox que Reporta").setStyle(TextInputStyle.Short).setRequired(true);
                    const motivo = new TextInputBuilder().setCustomId('motivo_reporte').setLabel("Motivo de Reporte").setStyle(TextInputStyle.Paragraph).setRequired(true);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(reportado), 
                        new ActionRowBuilder().addComponents(reportante), 
                        new ActionRowBuilder().addComponents(motivo)
                    );
                } else if (customId === 't_alianza') {
                    const serv = new TextInputBuilder().setCustomId('nom_servidor').setLabel("Nombre de servidor").setStyle(TextInputStyle.Short).setRequired(true);
                    const rango = new TextInputBuilder().setCustomId('rango_env').setLabel("Rango del enviante en su servidor").setStyle(TextInputStyle.Short).setRequired(true);
                    const motivo = new TextInputBuilder().setCustomId('motivo_ali').setLabel("Motivo de alianza o consulta").setStyle(TextInputStyle.Paragraph).setRequired(true);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(serv), 
                        new ActionRowBuilder().addComponents(rango), 
                        new ActionRowBuilder().addComponents(motivo)
                    );
                } else {
                    const robloxUser = new TextInputBuilder().setCustomId('roblox_user').setLabel("Usuario de Roblox").setStyle(TextInputStyle.Short).setRequired(true);
                    const motivo = new TextInputBuilder().setCustomId('motivo_ticket').setLabel("Motivo de Creacion").setStyle(TextInputStyle.Paragraph).setRequired(true);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(robloxUser), 
                        new ActionRowBuilder().addComponents(motivo)
                    );
                }
                return await interaction.showModal(modal);
            } catch (err) {
                console.error("Error al mostrar modal:", err);
            }
        }

        // --- 2. PROCESAMIENTO DE MODALES (CREACIÓN) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });

            try {
                const ticketId = await getNextTicketId();
                const type = customId.replace('modal_t_', '');
                
                const configs = {
                    general: { cat: '1489831086065324093', role: '1476800914818859018' },
                    reporte: { cat: '1489831182563672075', role: '1476800914818859018' },
                    vip: { cat: '1489831182563672075', role: '1476767461024989326' },
                    alianza: { cat: '1489831357357232218', role: '1476767863636234487' }
                };

                // Crear canal con manejo de errores
                const channel = await guild.channels.create({
                    name: `${user.username}-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: configs[type].cat,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                        { id: configs[type].role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                }).catch(e => { throw new Error(`Fallo creación de canal: ${e.message}`); });

                const embedInfo = new EmbedBuilder()
                    .setColor('#e1ff00')
                    .setTitle(`Ticket de ${type.toUpperCase()} #${ticketId}`)
                    .setAuthor({ name: 'Anda RP', iconURL: 'attachment://LogoPFP.png' })
                    .setFooter({ text: 'Anda RP - Rol de calidad' });

                // Corregido: Obtener valores directamente
                interaction.fields.fields.forEach(f => {
                    embedInfo.addFields({ name: f.customId.replace('_', ' ').toUpperCase(), value: f.value || "No proporcionado" });
                });

                const rowBtns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger)
                );

                await channel.send({ 
                    content: `<@${user.id}> | <@&${configs[type].role}>`, 
                    embeds: [embedInfo], 
                    components: [rowBtns], 
                    files: ['./attachment/LogoPFP.png'] 
                });
                
                const logChan = guild.channels.cache.get('1476799509207060551');
                if (logChan) await logChan.send(`📥 **${user.tag}** ABRIÓ EL TICKET #${ticketId}`).catch(() => {});
                
                await interaction.editReply(`✅ Ticket creado con éxito: ${channel}`);
            } catch (error) {
                console.error("Error al procesar el ticket:", error);
                await interaction.editReply(`❌ Hubo un error al crear el ticket: ${error.message}`);
            }
        }

        // --- 3. ACCIONES DENTRO DEL TICKET ---
        if (customId === 'ticket_reclamar') {
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true, ViewChannel: true });
            await interaction.reply({ content: `✅ Ticket reclamado por ${interaction.user}.` });
            
            const logChan = guild.channels.cache.get('1476799509207060551');
            if (logChan) await logChan.send(`📌 **${interaction.user.tag}** RECLAMÓ EL TICKET ${interaction.channel.name}`).catch(() => {});
        }

        if (customId === 'ticket_ascender') {
            await interaction.reply({ content: 'Ticket ascendido a un superior. 🚀' });
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
            if (logChan) await logChan.send(`🔒 **TICKET CERRADO**\nCanal: ${interaction.channel.name}\nCerrado por: ${user.tag}\nMotivo: ${motivo}\nResolución: ${suceso}`).catch(() => {});
            
            await interaction.reply("El ticket se cerrará en breve...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }
};