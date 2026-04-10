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
 * Lógica: Nombre dinámico, Jerarquía de 10 niveles, Derivación a Compras/Facciones y Transcripción Web.
 * Estado: Producción Final (Full Logic).
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL PRINCIPAL ---
    async sendTicketPanel(channel) {
        try {
            console.log("🛠️ [SISTEMA] Desplegando panel de tickets premium en #" + channel.name);
            
            const mainEmbed = new EmbedBuilder()
                .setColor('#0a0a0a') // Negro absoluto para elegancia
                .setTitle('🏛️ Centro de Atención al Ciudadano - Anda RP')
                .setDescription(
                    'Bienvenido al sistema de soporte centralizado. Para una atención eficiente, selecciona la categoría que mejor describa tu necesidad.\n\n' +
                    '📡 **Soporte General:** Consultas sobre el servidor, bugs menores o dudas básicas.\n' +
                    '🚫 **Reportes:** Denuncias por faltas a la normativa o comportamiento indebido.\n' +
                    '🤝 **Alianzas:** Consultas sobre convenios, colaboraciones y publicidad mutua.\n' +
                    '👨‍⚖️ **Facciones:** Gestión directa con supervisión para temas legales e ilegales.\n' +
                    '🎫 **VIP:** Canal prioritario con tiempos de respuesta reducidos para donadores.\n\n' +
                    '⚠️ **Nota:** El mal uso de este sistema resultará en una sanción administrativa.'
                )
                .setAuthor({ 
                    name: 'Gestión Administrativa Anda RP', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setImage('https://i.imgur.com/Tu7Gz2T.png') // Banner opcional si tienes uno
                .setFooter({ 
                    text: 'Anda RP - Innovación y Realismo en Roleplay', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setTimestamp();

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_general').setLabel('Soporte').setEmoji('📡').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('t_reporte').setLabel('Reportes').setEmoji('🚫').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('t_alianza').setLabel('Alianzas').setEmoji('🤝').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('t_facciones').setLabel('Facciones').setEmoji('👨‍⚖️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_vip').setLabel('VIP').setEmoji('🎫').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [mainEmbed], 
                components: [buttonRow], 
                files: ['./attachment/LogoPFP.png'] 
            });
            
            console.log("✅ [SISTEMA] Panel enviado con éxito.");
        } catch (e) {
            console.error("❌ [ERROR] Fallo crítico en sendTicketPanel:", e);
        }
    },

    // --- 2. MANEJO CENTRALIZADO DE INTERACCIONES ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;
        
        // IDs de Configuración Estática
        const logChannelId = '1476799509207060551';
        const rolComprasId = '1482153188856434828';
        const catComprasId = '1491985711765782640';
        const pingAperturaId = '1476800914818859018';
        const logoPath = './attachment/LogoPFP.png';

        // JERARQUÍA COMPLETA (10 NIVELES)
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1482153188856434828', // [5] Compras
            '1476768019496829033', // [6] Supervision Avanzada
            '1476768122915782676', // [7] Manager
            '1476768405037125885', // [8] Community Manager
            '1476768951034970253'  // [9] Fundacion
        ];

        const configs = {
            general: { cat: '1489831086065324093', role: staffHierarchy[0], n: 'Soporte General', prefix: 'soporte', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: staffHierarchy[1], n: 'Reportes', prefix: 'reporte', emoji: '🚫' },
            vip: { cat: '1489831182563672075', role: staffHierarchy[2], n: 'VIP Prioritario', prefix: 'vip', emoji: '🎫' },
            alianza: { cat: '1489831357357232218', role: staffHierarchy[7], n: 'Alianzas', prefix: 'alianza', emoji: '🤝' },
            facciones: { cat: '1489831086065324093', role: staffHierarchy[6], n: 'Facciones', prefix: 'facciones', emoji: '👨‍⚖️' }
        };

        // --- A. SOLICITUD DE MODALES CON VALIDACIONES ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza', 't_facciones'].includes(customId)) {
            const type = customId.replace('t_', '');
            const config = configs[type];

            // Validación VIP
            if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                return interaction.reply({ 
                    content: '🔒 **Acceso Denegado:** Esta categoría requiere el rango VIP en nuestra tienda.', 
                    ephemeral: true 
                });
            }

            // Validación Facciones (Supervisión Avanzada+)
            if (customId === 't_facciones') {
                const canAccess = staffHierarchy.slice(6).some(id => member.roles.cache.has(id)) || member.permissions.has(PermissionFlagsBits.Administrator);
                if (!canAccess) {
                    return interaction.reply({ 
                        content: '🚫 **Error:** Solo miembros de la **Supervisión Avanzada** o superiores pueden abrir tickets en esta categoría.', 
                        ephemeral: true 
                    });
                }
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_t_${type}`)
                .setTitle(`${config.emoji} Formulario: ${config.n}`);

            if (type === 'general' || type === 'vip' || type === 'facciones') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_roblox').setLabel("Usuario de Roblox").setPlaceholder("Ej: JuanRP_22").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_motivo').setLabel("¿En qué podemos ayudarte?").setPlaceholder("Explica tu duda o solicitud aquí...").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (type === 'reporte') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_reportado').setLabel("Usuario / ID a Reportar").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_suceso').setLabel("Descripción de los hechos").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_pruebas').setLabel("Links de Pruebas (Opcional)").setStyle(TextInputStyle.Short).setRequired(false))
                );
            } else if (type === 'alianza') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_solicitante').setLabel("Nombre del Servidor / Comunidad").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_desc').setLabel("Propuesta de Alianza").setPlaceholder("Detalla qué ofreces y qué buscas...").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_link').setLabel("Enlace de Invitación").setStyle(TextInputStyle.Short).setRequired(true))
                );
            }

            return await interaction.showModal(modal);
        }

        // --- B. LÓGICA DE CREACIÓN DE CANAL ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ ephemeral: true });
            
            try {
                const type = customId.replace('modal_t_', '');
                const config = configs[type];
                const ticketId = await getNextTicketId();

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

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#050505')
                    .setTitle(`${config.emoji} Ticket de ${config.n} | ID: #${ticketId}`)
                    .setAuthor({ name: 'Anda Roleplay - Sistema de Soporte', iconURL: 'attachment://LogoPFP.png' })
                    .setDescription(`Estimado <@${user.id}>, gracias por contactarnos. Un responsable del departamento de **${config.n}** revisará tu caso a la brevedad.\n\n` + 
                                   '📜 **Información del Formulario:**')
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Seguridad y Privacidad Garantizada • Anda RP' })
                    .setTimestamp();

                fields.fields.forEach(f => {
                    const label = f.customId.replace('f_', '').toUpperCase();
                    welcomeEmbed.addFields({ name: `📌 ${label}`, value: `\`\`\`${f.value}\`\`\`` });
                });

                const rowActions = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_compras').setLabel('Derivar Compras').setEmoji('💰').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `<@${user.id}> | <@&${pingAperturaId}>`, 
                    embeds: [welcomeEmbed], 
                    components: [rowActions], 
                    files: [logoPath] 
                });

                // Log de Apertura
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    await logChan.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle('🎫 Ticket Abierto')
                            .addFields(
                                { name: 'Usuario:', value: `<@${user.id}>`, inline: true },
                                { name: 'Canal:', value: `${tChannel}`, inline: true },
                                { name: 'Categoría:', value: config.n, inline: true }
                            )]
                    });
                }

                await interaction.editReply(`✅ Tu ticket ha sido creado exitosamente en ${tChannel}`);
            } catch (err) {
                console.error("❌ Fallo en creación:", err);
                await interaction.editReply("Hubo un error al generar tu canal. Contacta a un administrador.");
            }
        }

        // --- C. BOTÓN: RECLAMAR (CON PING) ---
        if (customId === 'ticket_reclamar') {
            const ticketOwner = channel.permissionOverwrites.cache.find(p => p.type === 1 && !staffHierarchy.includes(p.id) && p.id !== guild.id && p.id !== interaction.client.user.id);
            
            const claimEmbed = new EmbedBuilder()
                .setColor('#1a1a1a')
                .setAuthor({ name: 'Ticket Atendido', iconURL: user.displayAvatarURL() })
                .setDescription(`El Staff <@${user.id}> ha tomado el control de este ticket y te ayudará ahora mismo.\n\n` + 
                               `👤 **Atendido por:** \`${user.tag}\``)
                .setTimestamp();
            
            await interaction.reply({ 
                content: ticketOwner ? `<@${ticketOwner.id}>` : null, 
                embeds: [claimEmbed] 
            });
            
            await channel.setName(`atendido-${channel.name}`).catch(() => {});
        }

        // --- D. BOTÓN: DERIVAR A COMPRAS ---
        if (customId === 'ticket_compras') {
            try {
                await channel.setParent(catComprasId, { lockPermissions: false });
                await channel.permissionOverwrites.edit(rolComprasId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true, 
                    EmbedLinks: true 
                });

                const compEmbed = new EmbedBuilder()
                    .setColor('#1a1a1a')
                    .setTitle('💰 Traslado a Departamento de Compras')
                    .setDescription(`Este ticket ha sido movido a la sección de **Donaciones y Compras**.\n\nPor favor <@${user.id}>, ten a mano tus comprobantes de pago si es necesario.`)
                    .setFooter({ text: 'Acción realizada por ' + user.tag });

                await interaction.reply({ content: `<@&${rolComprasId}>`, embeds: [compEmbed] });
            } catch (e) {
                console.error("Error derivando a compras:", e);
            }
        }

        // --- E. BOTÓN: ASCENDER (JERARQUÍA DINÁMICA) ---
        if (customId === 'ticket_ascender') {
            let currentIdx = -1;
            for (let i = 0; i < staffHierarchy.length; i++) {
                if (channel.permissionOverwrites.cache.has(staffHierarchy[i])) currentIdx = i;
            }

            let nextIdx = (currentIdx >= 0 && currentIdx < 3) ? 3 : currentIdx + 1;
            if (nextIdx >= staffHierarchy.length) return interaction.reply({ content: '⚠️ Este ticket ya está bajo la supervisión de la **Fundación**.', ephemeral: true });

            const nextRole = staffHierarchy[nextIdx];
            const prevRole = currentIdx !== -1 ? staffHierarchy[currentIdx] : null;

            // QUITAR PERMISOS AL ANTERIOR
            if (prevRole) await channel.permissionOverwrites.edit(prevRole, { SendMessages: false });
            await channel.permissionOverwrites.edit(user.id, { SendMessages: false });
            
            // DAR ACCESO AL SUPERIOR
            await channel.permissionOverwrites.edit(nextRole, { 
                ViewChannel: true, 
                SendMessages: true, 
                ReadMessageHistory: true, 
                AttachFiles: true 
            });

            const ascEmbed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('🚀 Protocolo de Ascenso Activado')
                .setDescription(`El caso ha sido escalado para una revisión más profunda.\n\n` +
                               `⏫ **Nuevo Nivel:** <@&${nextRole}>\n` +
                               `📉 **Estado Previo:** Los rangos anteriores han sido bloqueados para evitar interferencias.`)
                .setTimestamp();

            await interaction.reply({ content: `<@&${nextRole}>`, embeds: [ascEmbed] });
        }

        // --- F. CIERRE Y TRANSCRIPCIÓN WEB ---
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_final_close').setTitle('Finalizar Atención');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('razon_txt')
                        .setLabel("Resolución y Conclusión")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder("Escribe el desenlace del caso...")
                        .setRequired(true)
                )
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply();
            
            const razon = fields.getTextInputValue('razon_txt');
            
            try {
                const transcriptHTML = await transcripts.createTranscript(channel, { 
                    limit: -1, 
                    returnType: 'string',
                    saveImages: true,
                    poweredBy: false 
                });

                await db.collection('transcripts').doc(channel.name).set({
                    ticketId: channel.name,
                    closedBy: user.tag,
                    resolution: razon,
                    htmlContent: transcriptHTML,
                    closedAt: new Date()
                });

                const webURL = `https://andarp.web.app/tickets.html?id=${channel.name}`;
                
                const logEmbed = new EmbedBuilder()
                    .setColor('#1a1a1a')
                    .setTitle('📄 Registro Histórico Generado')
                    .setDescription(`El ticket **${channel.name}** ha sido clausurado y archivado.`)
                    .addFields(
                        { name: '👤 Cerrado por:', value: user.tag, inline: true },
                        { name: '✅ Resolución:', value: razon },
                        { name: '🌐 Expediente Web:', value: `[Acceder a la Transcripción](${webURL})` }
                    )
                    .setTimestamp();

                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) await logChan.send({ embeds: [logEmbed] });

                await interaction.editReply('✅ **Expediente guardado.** El canal se autodestruirá en 5 segundos.');
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            } catch (err) {
                console.error("Error en cierre:", err);
                await interaction.editReply("⚠️ Error al generar transcripción, borrando canal...");
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }
        }
    }
};