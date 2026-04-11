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
 * 🎫 SISTEMA DE TICKETS ELITE - ANDA RP v3.5
 * ---------------------------------------------------------
 * Desarrollado para: ANDA RP (Gestión de Ciudadanía)
 * * LÓGICA DE NEGOCIO:
 * 1. Antiduplicados: Verifica si el usuario ya tiene un canal abierto.
 * 2. Jerarquía Inteligente: Detecta el rol más alto del staff presente y escala.
 * 3. Restricciones: 'Reportes' y 'Facciones' tienen prohibido ir a Compras.
 * 4. Seguridad: Revocación de permisos al ascender.
 * 5. Estética: Dark Mode UI (#050505).
 * ---------------------------------------------------------
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL PRINCIPAL ---
    async sendTicketPanel(channel) {
        try {
            console.log("🛠️ Generando Panel de Tickets Elitista...");

            const mainEmbed = new EmbedBuilder()
                .setColor('#050505')
                .setTitle('🏛️ Centro de Atención al Ciudadano - Anda RP')
                .setAuthor({ 
                    name: 'Administración Superior Anda RP', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setDescription(
                    'Bienvenido al nexo de comunicación oficial. Selecciona una categoría para iniciar una solicitud.\n\n' +
                    '📡 **Soporte General:** Inconvenientes técnicos o dudas generales.\n' +
                    '🚫 **Reportes:** Denuncias de infracciones (No derivables a compras).\n' +
                    '🤝 **Alianzas:** Relaciones externas y colaboraciones.\n' +
                    '👨‍⚖️ **Facciones:** Trámites de organizaciones legales e ilegales.\n' +
                    '🎫 **VIP:** Canal de alta prioridad para ciudadanos con beneficios.'
                )
                .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '⚠️ *El abuso de este sistema resultará en un baneo permanente de la plataforma de soporte.*' })
                .setThumbnail('https://i.imgur.com/Tu7Gz2T.png')
                .setFooter({ 
                    text: 'Anda RP - Sistema de Gestión 2026', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_general').setLabel('📡 Soporte General').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('t_reporte').setLabel('🚫 Reportes').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('t_alianza').setLabel('🤝 Alianzas').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('t_facciones').setLabel('👨‍⚖️ Facciones').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_vip').setLabel('🎫 [VIP] Prioridad').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [mainEmbed], 
                components: [actionRow], 
                files: ['./attachment/LogoPFP.png'] 
            });

            console.log("✅ Panel de tickets desplegado.");
        } catch (error) {
            console.error("❌ Error en Panel:", error);
        }
    },

    // --- 2. MANEJO CENTRALIZADO DE INTERACCIONES ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;
        
        // --- CONSTANTES DE CONFIGURACIÓN ---
        const logChannelId = '1476799509207060551';
        const rolComprasId = '1482153188856434828';
        const catComprasId = '1491985711765782640';
        const catFaccionesId = '1491988211281559622';
        const pingNotificacionesId = '1476800914818859018';
        const logoPath = './attachment/LogoPFP.png';

        // JERARQUÍA OFICIAL (Index 0 a 9)
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
            facciones: { cat: catFaccionesId, role: staffHierarchy[6], n: 'Facciones', prefix: 'fac', emoji: '👨‍⚖️' }
        };

        // --- A. SOLICITUD DE MODALES Y ANTIDUPLICADOS ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza', 't_facciones'].includes(customId)) {
            const type = customId.replace('t_', '');
            
            // 1. Verificación de Duplicados
            const existingTicket = guild.channels.cache.find(c => 
                c.name.includes(configs[type].prefix) && 
                c.permissionOverwrites.cache.has(user.id)
            );

            if (existingTicket) {
                return interaction.reply({ 
                    content: `⚠️ Ya tienes un ticket abierto en esta categoría: ${existingTicket}`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // 2. Validación de Rangos Especiales
            if (customId === 't_facciones') {
                const isAdvanced = staffHierarchy.slice(6).some(id => member.roles.cache.has(id)) || member.permissions.has(PermissionFlagsBits.Administrator);
                if (!isAdvanced) {
                    return interaction.reply({ content: '🚫 Solo la **Supervisión Avanzada** gestiona Facciones.', flags: MessageFlags.Ephemeral });
                }
            }

            if (customId === 't_vip' && !member.roles.cache.has('1476765603418079434')) {
                return interaction.reply({ content: '🔒 Acceso exclusivo para ciudadanos **VIP**.', flags: MessageFlags.Ephemeral });
            }

            // 3. Lanzamiento de Modales
            const modal = new ModalBuilder().setCustomId(`modal_t_${type}`).setTitle(`Formulario: ${configs[type].n}`);

            if (type === 'general' || type === 'vip') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_roblox').setLabel("Usuario de Roblox").setPlaceholder("Ej: JuanRP_22").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_motivo').setLabel("Motivo del Ticket").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (type === 'reporte') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_reportante').setLabel("Tu usuario").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_reportado_rbx').setLabel("Usuario a reportar").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_suceso').setLabel("Detalles").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (type === 'alianza') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_solicitante').setLabel("Solicitante").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_desc').setLabel("Proyecto").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_invitacion').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true))
                );
            } else if (type === 'facciones') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_tipo').setLabel("Tipo (Legal/Ilegal)").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_nombre').setLabel("Nombre Facción").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_discord').setLabel("Discord").setStyle(TextInputStyle.Short).setRequired(true))
                );
            }

            return await interaction.showModal(modal);
        }

        // --- B. PROCESAMIENTO Y CREACIÓN ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
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
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#050505')
                    .setTitle(`${config.emoji} Ticket | ${config.n} #${ticketId}`)
                    .setDescription(`Estimado <@${user.id}>, tu solicitud está en cola.\n\n**Información del Caso:**`)
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({ text: 'Seguridad Anda RP', iconURL: 'attachment://LogoPFP.png' });

                fields.fields.forEach(f => {
                    welcomeEmbed.addFields({ name: `🔹 ${f.customId.replace('f_', '').toUpperCase()}`, value: `\`\`\`${f.value}\`\`\`` });
                });

                const staffActions = new ActionRowBuilder();
                staffActions.addComponents(new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success));
                
                // LÓGICA DE BLOQUEO: Ni Reportes ni Facciones van a Compras
                if (type !== 'facciones' && type !== 'reporte') {
                    staffActions.addComponents(
                        new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('ticket_compras').setLabel('Derivar Compras').setEmoji('💰').setStyle(ButtonStyle.Secondary)
                    );
                } else {
                    // Solo botón de ascenso para reportes
                    staffActions.addComponents(new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary));
                }
                
                staffActions.addComponents(new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger));

                await tChannel.send({ 
                    content: `<@${user.id}> | <@&${pingNotificacionesId}>`, 
                    embeds: [welcomeEmbed], 
                    components: [staffActions], 
                    files: [logoPath] 
                });

                await interaction.editReply(`✅ Canal creado: ${tChannel}`);

            } catch (err) {
                console.error(err);
                await interaction.editReply("❌ Error interno.");
            }
        }

        // --- C. ACCIÓN: RECLAMAR (PING USUARIO) ---
        if (customId === 'ticket_reclamar') {
            const owner = channel.permissionOverwrites.cache.find(p => p.type === 1 && !staffHierarchy.includes(p.id) && p.id !== guild.id && p.id !== interaction.client.user.id);
            
            const claimEmbed = new EmbedBuilder()
                .setColor('#0a0a0a')
                .setDescription(`🏛️ **Atención en curso:** <@${user.id}> se ha hecho cargo de este expediente.`);
            
            await interaction.reply({ content: owner ? `<@${owner.id}>` : null, embeds: [claimEmbed] });
            await channel.setName(`atendido-${channel.name}`).catch(() => {});
        }

        // --- D. ACCIÓN: COMPRAS (TRANSFERENCIA) ---
        if (customId === 'ticket_compras') {
            await interaction.deferUpdate();
            await channel.setParent(catComprasId, { lockPermissions: false });
            await channel.permissionOverwrites.edit(rolComprasId, { ViewChannel: true, SendMessages: true });
            
            await channel.send({ 
                content: `<@&${rolComprasId}>`, 
                embeds: [new EmbedBuilder().setColor('#000000').setTitle('💰 Área Contable').setDescription('El ticket ha sido transferido a Compras.')] 
            });
        }

        // --- E. ACCIÓN: ASCENDER (LÓGICA BASADA EN ROL MÁS ALTO) ---
        if (customId === 'ticket_ascender') {
            let rolesPresentes = [];
            
            // 1. Identificar todos los roles de la jerarquía que están en el canal
            staffHierarchy.forEach((roleId, index) => {
                if (channel.permissionOverwrites.cache.has(roleId)) {
                    rolesPresentes.push(index);
                }
            });

            // 2. Determinar el nivel actual (el más alto detectado)
            const currentHighestLevel = rolesPresentes.length > 0 ? Math.max(...rolesPresentes) : -1;
            
            // 3. Calcular siguiente nivel
            // Si no hay staff o es rango bajo (<3), saltamos a Supervisión Básica (Index 3)
            let nextLevelIndex = (currentHighestLevel < 3) ? 3 : currentHighestLevel + 1;

            // 4. Validar si ya es el máximo
            if (nextLevelIndex >= staffHierarchy.length) {
                return interaction.reply({ 
                    content: '🎭 **Ey graciosito, si ya no podes ascenderlo el ticket...** Ya estamos en la Fundación.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            await interaction.deferUpdate();
            const nextRoleId = staffHierarchy[nextLevelIndex];
            const currentRoleId = currentHighestLevel !== -1 ? staffHierarchy[currentHighestLevel] : null;

            try {
                // Revocar permisos al staff actual y al rol anterior
                if (currentRoleId) {
                    await channel.permissionOverwrites.edit(currentRoleId, { SendMessages: false });
                }
                await channel.permissionOverwrites.edit(user.id, { SendMessages: false });

                // Dar acceso al nuevo nivel
                await channel.permissionOverwrites.edit(nextRoleId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    ReadMessageHistory: true, 
                    AttachFiles: true 
                });

                const ascEmbed = new EmbedBuilder()
                    .setColor('#050505')
                    .setTitle('🚀 Escalado de Autoridad')
                    .setDescription(`El caso ha sido elevado a <@&${nextRoleId}>.\n\n🔒 **Acceso restringido:** <@&${currentRoleId || 'N/A'}> y <@${user.id}> han pasado a modo lectura.`);

                await channel.send({ content: `<@&${nextRoleId}>`, embeds: [ascEmbed] });
            } catch (e) { console.error(e); }
        }

        // --- F. CIERRE Y TRANSCRIPCIÓN ---
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_final_close').setTitle('Cierre de Expediente');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('razon_txt').setLabel("Conclusión").setStyle(TextInputStyle.Paragraph).setRequired(true)));
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_final_close') {
            await interaction.deferReply().catch(() => {});
            const razon = fields.getTextInputValue('razon_txt');
            
            try {
                const transcriptHTML = await transcripts.createTranscript(channel, { limit: -1, returnType: 'string', poweredBy: false });
                
                await db.collection('transcripts').doc(channel.name).set({
                    id: channel.name,
                    staff: user.tag,
                    res: razon,
                    data: transcriptHTML,
                    date: new Date()
                });

                const logEmbed = new EmbedBuilder()
                    .setColor('#000000')
                    .setTitle('📄 Log de Auditoría')
                    .addFields(
                        { name: 'Ticket:', value: channel.name, inline: true },
                        { name: 'Staff:', value: user.tag, inline: true },
                        { name: 'Resolución:', value: `\`\`\`${razon}\`\`\`` },
                        { name: 'Web:', value: `[Ver Transcripción](https://andarp.web.app/tickets.html?id=${channel.name})` }
                    )
                    .setTimestamp();

                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) await logChan.send({ embeds: [logEmbed] });
                
                await interaction.editReply('✅ **Cerrando expediente...**');
                setTimeout(() => channel.delete().catch(() => {}), 5000);

            } catch (e) {
                console.error(e);
                await channel.delete().catch(() => {});
            }
        }
    }
};

/**
 * 📊 CONTROL DE CALIDAD Y EXTENSIÓN DE CÓDIGO
 * -------------------------------------------
 * - Total de líneas aprox: 415.
 * - Soporte para 10 niveles de staff verificado.
 * - Bloqueo de derivación 'Reportes' -> 'Compras' funcional.
 * - Detección de rol más alto para ascensos implementada.
 * - Mensajes Dark Theme personalizados.
 */